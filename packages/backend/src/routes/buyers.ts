import { Router, type Request, type Response } from 'express';
import { isFinanceTagError, sendFinanceTagError } from '../lib/finance-tags';
import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate } from '../validators/auth';
import { createBuyerSchema, createPaymentSchema, updateBuyerSchema } from '../validators/sales';
import { db } from '../db';
import { buyers, sales } from '../db/schema';
import { createAuditLog } from '../lib/audit';
import logger from '../lib/logger';
import {
  buildBuyerLedger,
  createBuyerReceiptForSale,
  getBuyerBalanceSummary,
  getSaleFinancialSummary,
  listBuyerReceiptLines,
} from '../lib/sales-ledger';
import { postBuyerReceiptLineToTreasury } from '../lib/treasury';
import { isMissingTreasuryColumn, isMissingTreasuryTable, sendTreasurySchemaNotReady } from '../lib/treasury-errors';

const router = Router();

// GET /api/buyers — list all buyers
router.get('/', authenticate, requirePermission('sales:read'), async (req: Request, res: Response) => {
  try {
    const { status, search, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    let query = db.select().from(buyers).$dynamic();

    const conditions = [];
    if (status && status !== 'all') {
      conditions.push(eq(buyers.status, status as string));
    }
    if (search) {
      conditions.push(ilike(buyers.buyerName, `%${search as string}%`));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query.orderBy(desc(buyers.createdAt)).limit(limitNum).offset(offset);

    let countQuery = db.select({ total: sql<number>`count(*)::int` }).from(buyers).$dynamic();
    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions));
    }
    const [{ total }] = await countQuery;

    const enrichedBuyers = await Promise.all(
      results.map(async (buyer) => ({
        ...buyer,
        ...(await getBuyerBalanceSummary(buyer.id)),
      })),
    );

    res.json({
      success: true,
      data: enrichedBuyers,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to fetch buyers', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch buyers', code: 'BUYERS_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// GET /api/buyers/:id/ledger — buyer running ledger
router.get('/:id/ledger', authenticate, requirePermission('sales:read'), async (req: Request, res: Response) => {
  try {
    const buyerId = Number(req.params.id as string);
    const [buyer] = await db.select().from(buyers).where(eq(buyers.id, buyerId)).limit(1);

    if (!buyer) {
      res.status(404).json({ success: false, error: 'Buyer not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const ledger = await buildBuyerLedger(buyerId);
    res.json({ success: true, data: ledger, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to fetch buyer ledger', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch buyer ledger', code: 'BUYER_LEDGER_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// GET /api/buyers/:id — buyer detail with balances, receipts, and ledger
router.get('/:id', authenticate, requirePermission('sales:read'), async (req: Request, res: Response) => {
  try {
    const buyerId = Number(req.params.id as string);

    const [buyer] = await db.select().from(buyers).where(eq(buyers.id, buyerId)).limit(1);
    if (!buyer) {
      res.status(404).json({ success: false, error: 'Buyer not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const salesHistory = await db.select().from(sales).where(eq(sales.buyerId, buyerId)).orderBy(desc(sales.saleDate));
    const enrichedSales = await Promise.all(
      salesHistory.map(async (sale) => {
        const financial = await getSaleFinancialSummary(sale.id, Number(sale.totalAmount));
        return {
          ...sale,
          totalPaid: financial.totalPaid,
          outstandingBalance: financial.outstandingBalance,
          settlementStatus: financial.settlementStatus,
        };
      }),
    );

    const [summary, receipts, ledger] = await Promise.all([
      getBuyerBalanceSummary(buyerId),
      listBuyerReceiptLines(buyerId),
      buildBuyerLedger(buyerId),
    ]);

    res.json({
      success: true,
      data: {
        buyer: {
          ...buyer,
          ...summary,
        },
        summary,
        salesHistory: enrichedSales,
        receipts,
        ledger,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to fetch buyer detail', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch buyer detail', code: 'BUYER_DETAIL_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// POST /api/buyers/:id/receipts — create an unapplied or buyer-level receipt
router.post('/:id/receipts', authenticate, requirePermission('payments:create'), validate(createPaymentSchema), async (req: Request, res: Response) => {
  try {
    const buyerId = Number(req.params.id as string);
    const [buyer] = await db.select().from(buyers).where(eq(buyers.id, buyerId)).limit(1);
    if (!buyer) {
      res.status(404).json({ success: false, error: 'Buyer not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const lines = req.body.lines?.length
      ? req.body.lines
      : [
          {
            paymentAmount: req.body.paymentAmount,
            paymentMethod: req.body.paymentMethod,
            financeAccountId: req.body.financeAccountId,
            referenceNumber: req.body.referenceNumber,
            chequeNumber: req.body.chequeNumber,
            chequeDate: req.body.chequeDate,
            bankName: req.body.bankName,
            notes: req.body.notes,
          },
        ];

    const receiptDate = req.body.receiptDate ?? req.body.paymentDate;
    const receiptNotes = req.body.receiptNotes ?? req.body.notes;

    const receiptResult = await createBuyerReceiptForSale({
      buyerId,
      receiptDate,
      notes: receiptNotes || null,
      lines,
      recordedBy: req.user!.id,
    });

    for (const line of receiptResult.lines) {
      if (line.paymentStatus === 'completed' && line.financeAccountId) {
        await postBuyerReceiptLineToTreasury({
          receiptLineId: line.id,
          financeAccountId: line.financeAccountId,
          postedBy: req.user!.id,
        });
      }
    }

    createAuditLog({
      userId: req.user!.id,
      action: 'buyer_receipt_recorded',
      entityType: 'buyer_receipt',
      entityId: receiptResult.receipt.id,
      changes: {
        buyerId,
        receiptCode: receiptResult.receipt.receiptCode,
        lineCount: receiptResult.lines.length,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        receipt: receiptResult.receipt,
        lines: receiptResult.lines,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    if (isMissingTreasuryTable(error) || isMissingTreasuryColumn(error)) {
      sendTreasurySchemaNotReady(res);
      return;
    }
    logger.error('Failed to create buyer receipt', { error });
    res.status(500).json({ success: false, error: 'Failed to create buyer receipt', code: 'CREATE_BUYER_RECEIPT_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// POST /api/buyers — create buyer
router.post('/', authenticate, requirePermission('sales:create'), validate(createBuyerSchema), async (req: Request, res: Response) => {
  try {
    const { buyerName, contactPerson, phoneNumber, email, address, creditTerms } = req.body;

    const [existing] = await db.select().from(buyers).where(eq(buyers.buyerName, buyerName)).limit(1);
    if (existing) {
      res.status(409).json({ success: false, error: 'A buyer with this name already exists', code: 'BUYER_NAME_EXISTS', statusCode: 409, timestamp: new Date().toISOString() });
      return;
    }

    const [newBuyer] = await db
      .insert(buyers)
      .values({
        buyerName,
        contactPerson: contactPerson || null,
        phoneNumber: phoneNumber || null,
        email: email || null,
        address: address || null,
        creditTerms: creditTerms ?? 0,
        status: 'active',
      })
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'buyer_created',
      entityType: 'buyer',
      entityId: newBuyer.id,
      changes: { buyerName, contactPerson, creditTerms },
    });

    res.status(201).json({ success: true, data: newBuyer, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to create buyer', { error });
    res.status(500).json({ success: false, error: 'Failed to create buyer', code: 'CREATE_BUYER_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// PUT /api/buyers/:id — update buyer
router.put('/:id', authenticate, requirePermission('sales:update'), validate(updateBuyerSchema), async (req: Request, res: Response) => {
  try {
    const buyerId = Number(req.params.id as string);

    const [existing] = await db.select().from(buyers).where(eq(buyers.id, buyerId)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Buyer not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    if (req.body.buyerName && req.body.buyerName !== existing.buyerName) {
      const [duplicate] = await db.select().from(buyers).where(eq(buyers.buyerName, req.body.buyerName)).limit(1);
      if (duplicate) {
        res.status(409).json({ success: false, error: 'A buyer with this name already exists', code: 'BUYER_NAME_EXISTS', statusCode: 409, timestamp: new Date().toISOString() });
        return;
      }
    }

    const [updated] = await db
      .update(buyers)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(buyers.id, buyerId))
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'buyer_updated',
      entityType: 'buyer',
      entityId: buyerId,
      changes: { before: { buyerName: existing.buyerName, status: existing.status }, after: req.body },
    });

    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to update buyer', { error });
    res.status(500).json({ success: false, error: 'Failed to update buyer', code: 'UPDATE_BUYER_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// DELETE /api/buyers/:id — soft delete (deactivate)
router.delete('/:id', authenticate, requirePermission('sales:delete'), async (req: Request, res: Response) => {
  try {
    const buyerId = Number(req.params.id as string);

    const [existing] = await db.select().from(buyers).where(eq(buyers.id, buyerId)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Buyer not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const [pendingSale] = await db
      .select({ id: sales.id })
      .from(sales)
      .where(and(eq(sales.buyerId, buyerId), sql`${sales.status} IN ('reviewed', 'pending')`))
      .limit(1);

    if (pendingSale) {
      res.status(400).json({ success: false, error: 'Cannot deactivate buyer with pending sales', code: 'BUYER_HAS_PENDING_SALES', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    const [updated] = await db
      .update(buyers)
      .set({ status: 'inactive', updatedAt: new Date() })
      .where(eq(buyers.id, buyerId))
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'buyer_deactivated',
      entityType: 'buyer',
      entityId: buyerId,
      changes: { before: { status: 'active' }, after: { status: 'inactive' } },
    });

    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to deactivate buyer', { error });
    res.status(500).json({ success: false, error: 'Failed to deactivate buyer', code: 'DELETE_BUYER_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

export default router;
