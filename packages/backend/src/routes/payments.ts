import { Router, type Request, type Response } from 'express';
import { isFinanceTagError, sendFinanceTagError } from '../lib/finance-tags';
import { and, desc, eq } from 'drizzle-orm';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate } from '../validators/auth';
import { updatePaymentSchema } from '../validators/sales';
import { db } from '../db';
import { buyerReceiptAllocations, buyerReceiptLines, payments, sales } from '../db/schema';
import { createAuditLog } from '../lib/audit';
import logger from '../lib/logger';
import { getSalePaymentRows, parsePaymentIdentifier, syncSaleStatusFromPayments } from '../lib/sales-ledger';
import { postBuyerReceiptLineToTreasury, reverseBuyerReceiptLineTreasuryPosting } from '../lib/treasury';
import { isMissingTreasuryColumn, isMissingTreasuryTable, sendTreasurySchemaNotReady } from '../lib/treasury-errors';

const router = Router();

// GET /api/payments — list payments (supports receipt lines and legacy payments)
router.get('/', authenticate, requirePermission('payments:read'), async (req: Request, res: Response) => {
  try {
    const { saleId, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));

    if (saleId) {
      const rows = await getSalePaymentRows(Number(saleId));
      const start = (pageNum - 1) * limitNum;
      const pagedRows = rows.slice(start, start + limitNum);
      res.json({
        success: true,
        data: pagedRows,
        total: rows.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(rows.length / limitNum),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const legacyRows = await db
      .select({
        id: payments.id,
        saleId: payments.saleId,
        saleCode: sales.saleCode,
        paymentAmount: payments.paymentAmount,
        paymentDate: payments.paymentDate,
        paymentMethod: payments.paymentMethod,
        chequeNumber: payments.chequeNumber,
        chequeDate: payments.chequeDate,
        bankName: payments.bankName,
        paymentStatus: payments.paymentStatus,
        notes: payments.notes,
        createdAt: payments.createdAt,
        updatedAt: payments.updatedAt,
      })
      .from(payments)
      .leftJoin(sales, eq(payments.saleId, sales.id))
      .orderBy(desc(payments.paymentDate));

    const receiptLineRows = await db
      .select({
        id: buyerReceiptLines.id,
        paymentAmount: buyerReceiptLines.paymentAmount,
        paymentDate: buyerReceiptLines.createdAt,
        paymentMethod: buyerReceiptLines.paymentMethod,
        chequeNumber: buyerReceiptLines.chequeNumber,
        chequeDate: buyerReceiptLines.chequeDate,
        bankName: buyerReceiptLines.bankName,
        paymentStatus: buyerReceiptLines.paymentStatus,
        notes: buyerReceiptLines.notes,
        createdAt: buyerReceiptLines.createdAt,
        updatedAt: buyerReceiptLines.updatedAt,
      })
      .from(buyerReceiptLines)
      .orderBy(desc(buyerReceiptLines.createdAt));

    const combined = [
      ...legacyRows.map((row) => ({
        ...row,
        id: `legacy-${row.id}`,
        source: 'legacy',
      })),
      ...receiptLineRows.map((row) => ({
        ...row,
        id: `receipt-line-${row.id}`,
        saleId: null,
        saleCode: null,
        paymentDate: row.paymentDate.toISOString().split('T')[0],
        source: 'receipt_line',
      })),
    ].sort((a, b) => new Date(String(b.paymentDate)).getTime() - new Date(String(a.paymentDate)).getTime());

    const start = (pageNum - 1) * limitNum;
    const pagedRows = combined.slice(start, start + limitNum);

    res.json({
      success: true,
      data: pagedRows,
      total: combined.length,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(combined.length / limitNum),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to fetch payments', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch payments', code: 'PAYMENTS_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// PUT /api/payments/:id — update payment status (cheque clearing)
router.put('/:id', authenticate, requirePermission('payments:update'), validate(updatePaymentSchema), async (req: Request, res: Response) => {
  try {
    const paymentId = req.params.id as string;
    const parsed = parsePaymentIdentifier(paymentId);

    if (parsed.source === 'receipt_line') {
      const [existing] = await db.select().from(buyerReceiptLines).where(eq(buyerReceiptLines.id, parsed.id)).limit(1);
      if (!existing) {
        res.status(404).json({ success: false, error: 'Payment not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
        return;
      }

      if (existing.treasuryReversalTransactionId && req.body.paymentStatus === 'completed') {
        res.status(400).json({ success: false, error: 'This receipt line was already reversed in treasury and cannot be completed again', code: 'TREASURY_RECEIPT_ALREADY_REVERSED', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }

      if (
        existing.treasuryTransactionId
        && req.body.financeAccountId
        && req.body.financeAccountId !== existing.financeAccountId
      ) {
        res.status(400).json({
          success: false,
          error: 'Treasury-linked receipt lines cannot be moved to a different account without reversal',
          code: 'TREASURY_ACCOUNT_CHANGE_REQUIRES_REVERSAL',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const targetFinanceAccountId = req.body.financeAccountId ?? existing.financeAccountId;
      if (existing.paymentStatus !== 'completed' && req.body.paymentStatus === 'completed' && !targetFinanceAccountId) {
        res.status(400).json({
          success: false,
          error: 'Treasury account is required before clearing this receipt line',
          code: 'TREASURY_ACCOUNT_REQUIRED',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const [updated] = await db
        .update(buyerReceiptLines)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(buyerReceiptLines.id, parsed.id))
        .returning();

      if (existing.paymentStatus !== 'completed' && updated.paymentStatus === 'completed' && updated.financeAccountId) {
        await postBuyerReceiptLineToTreasury({
          receiptLineId: updated.id,
          financeAccountId: updated.financeAccountId,
          postedBy: req.user!.id,
        });
      }

      if (existing.paymentStatus === 'completed' && updated.paymentStatus === 'bounced' && existing.treasuryTransactionId) {
        await reverseBuyerReceiptLineTreasuryPosting({
          receiptLineId: updated.id,
          postedBy: req.user!.id,
        });
      }

      const allocations = await db
        .select({ saleId: buyerReceiptAllocations.saleId })
        .from(buyerReceiptAllocations)
        .where(eq(buyerReceiptAllocations.receiptLineId, parsed.id));

      for (const allocation of allocations) {
        await syncSaleStatusFromPayments(allocation.saleId);
      }

      createAuditLog({
        userId: req.user!.id,
        action: 'payment_updated',
        entityType: 'buyer_receipt_line',
        entityId: parsed.id,
        changes: { before: { paymentStatus: existing.paymentStatus }, after: { paymentStatus: updated.paymentStatus } },
      });

      res.json({
        success: true,
        data: {
          ...updated,
          id: `receipt-line-${updated.id}`,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const [existing] = await db.select().from(payments).where(eq(payments.id, parsed.id)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Payment not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const [updated] = await db
      .update(payments)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(payments.id, parsed.id))
      .returning();

    if (req.body.paymentStatus) {
      await syncSaleStatusFromPayments(existing.saleId);
    }

    createAuditLog({
      userId: req.user!.id,
      action: 'payment_updated',
      entityType: 'payment',
      entityId: parsed.id,
      changes: { before: { paymentStatus: existing.paymentStatus }, after: { paymentStatus: updated.paymentStatus } },
    });

    res.json({
      success: true,
      data: {
        ...updated,
        id: `legacy-${updated.id}`,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    if (isMissingTreasuryTable(error) || isMissingTreasuryColumn(error)) {
      sendTreasurySchemaNotReady(res);
      return;
    }
    logger.error('Failed to update payment', { error });
    res.status(500).json({ success: false, error: 'Failed to update payment', code: 'UPDATE_PAYMENT_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

export default router;
