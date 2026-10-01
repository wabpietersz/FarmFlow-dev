import { Router, type Request, type Response } from 'express';
import { isFinanceTagError, sendFinanceTagError } from '../lib/finance-tags';
import { desc, eq } from 'drizzle-orm';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate } from '../validators/auth';
import { updatePaymentSchema } from '../validators/sales';
import { db } from '../db';
import { buyerReceiptAllocations, buyerReceiptLines, buyerReceipts } from '../db/schema';
import { createAuditLog } from '../lib/audit';
import logger from '../lib/logger';
import { getSalePaymentRows, isPostingRuleError, parsePaymentIdentifier, syncSaleStatusFromPayments } from '../lib/sales-ledger';
import { postBuyerReceiptLineWithin, reverseBuyerReceiptLineWithin } from '../lib/treasury';
import { isMissingTreasuryColumn, isMissingTreasuryTable, sendTreasurySchemaNotReady } from '../lib/treasury-errors';

const router = Router();

// GET /api/payments — list buyer receipt lines
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

    const receiptLineRows = await db
      .select({
        id: buyerReceiptLines.id,
        receiptCode: buyerReceipts.receiptCode,
        paymentAmount: buyerReceiptLines.paymentAmount,
        paymentDate: buyerReceipts.receiptDate,
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
      .innerJoin(buyerReceipts, eq(buyerReceiptLines.receiptId, buyerReceipts.id))
      .orderBy(desc(buyerReceipts.receiptDate), desc(buyerReceiptLines.id));

    const combined = receiptLineRows.map((row) => ({
      ...row,
      id: `receipt-line-${row.id}`,
      saleId: null,
      saleCode: null,
      source: 'receipt_line',
    }));

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

      // Status change, ledger posting/reversal and sale status move together or not at all
      const updated = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(buyerReceiptLines)
          .set({ ...req.body, updatedAt: new Date() })
          .where(eq(buyerReceiptLines.id, parsed.id))
          .returning();

        if (existing.paymentStatus !== 'completed' && row.paymentStatus === 'completed' && row.financeAccountId) {
          await postBuyerReceiptLineWithin(tx, { receiptLineId: row.id, financeAccountId: row.financeAccountId, postedBy: req.user!.id });
        }
        if (existing.paymentStatus === 'completed' && row.paymentStatus === 'bounced' && existing.treasuryTransactionId) {
          await reverseBuyerReceiptLineWithin(tx, { receiptLineId: row.id, postedBy: req.user!.id });
        }

        const allocations = await tx
          .select({ saleId: buyerReceiptAllocations.saleId })
          .from(buyerReceiptAllocations)
          .where(eq(buyerReceiptAllocations.receiptLineId, parsed.id));
        for (const allocation of allocations) {
          await syncSaleStatusFromPayments(allocation.saleId, tx);
        }
        return row;
      });

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

    // Old-style payment rows were converted to receipts (migration 0007) and are read-only history.
    res.status(400).json({ success: false, error: 'This is an old payment record. Update the converted receipt instead.', code: 'LEGACY_PAYMENT_READ_ONLY', statusCode: 400, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    if (isPostingRuleError(error)) {
      res.status(400).json({ success: false, error: (error as Error).message, code: 'RECEIPT_NOT_POSTED', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }
    if (isMissingTreasuryTable(error) || isMissingTreasuryColumn(error)) {
      sendTreasurySchemaNotReady(res);
      return;
    }
    logger.error('Failed to update payment', { error });
    res.status(500).json({ success: false, error: 'Failed to update payment', code: 'UPDATE_PAYMENT_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

export default router;
