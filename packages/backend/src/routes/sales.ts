import { Router, type Request, type Response } from 'express';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate } from '../validators/auth';
import { createPaymentSchema, createSaleSchema, updateSaleSchema } from '../validators/sales';
import { db } from '../db';
import { batches, buyers, buyerReceiptAllocations, payments, saleLorries, sales, sites } from '../db/schema';
import { createAuditLog } from '../lib/audit';
import logger from '../lib/logger';
import {
  autoApplyBuyerCreditToSale,
  createBuyerReceiptForSale,
  getBuyerBalanceSummary,
  getSaleFinancialSummary,
  listSaleLorries,
  normalizeSaleLorries,
} from '../lib/sales-ledger';
import { postBuyerReceiptLineToTreasury } from '../lib/treasury';
import { isMissingTreasuryColumn, isMissingTreasuryTable, sendTreasurySchemaNotReady } from '../lib/treasury-errors';

const router = Router();

function normalizeSaleWorkflowStatus(status: string) {
  return status === 'pending' ? 'reviewed' : status;
}

function canTakeReceipts(status: string) {
  return ['reviewed', 'pending', 'completed'].includes(status);
}

type EditableLorryLine = {
  lorryNumber: string;
  birdsCount: number;
  previousWeight: number;
  loadedWeight: number;
  notes?: string | null;
};

// GET /api/sales — list all sales
router.get('/', authenticate, requirePermission('sales:read'), async (req: Request, res: Response) => {
  try {
    const { status, buyerId, batchId, startDate, endDate, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    let query = db
      .select({
        id: sales.id,
        saleCode: sales.saleCode,
        batchId: sales.batchId,
        batchCode: batches.batchCode,
        buyerId: sales.buyerId,
        buyerName: buyers.buyerName,
        saleDate: sales.saleDate,
        totalBirds: sales.totalBirds,
        totalWeight: sales.totalWeight,
        pricePerKg: sales.pricePerKg,
        totalAmount: sales.totalAmount,
        status: sales.status,
        notes: sales.notes,
        createdAt: sales.createdAt,
        updatedAt: sales.updatedAt,
      })
      .from(sales)
      .leftJoin(buyers, eq(sales.buyerId, buyers.id))
      .leftJoin(batches, eq(sales.batchId, batches.id))
      .$dynamic();

    const conditions = [];
    if (status && status !== 'all') {
      if (status === 'reviewed') {
        conditions.push(sql`${sales.status} IN ('reviewed', 'pending')`);
      } else {
        conditions.push(eq(sales.status, status as string));
      }
    }
    if (buyerId) {
      conditions.push(eq(sales.buyerId, Number(buyerId)));
    }
    if (batchId) {
      conditions.push(eq(sales.batchId, Number(batchId)));
    }
    if (startDate) {
      conditions.push(gte(sales.saleDate, startDate as string));
    }
    if (endDate) {
      conditions.push(lte(sales.saleDate, endDate as string));
    }
    if (req.user!.siteId) {
      conditions.push(eq(batches.siteId, req.user!.siteId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query.orderBy(desc(sales.createdAt)).limit(limitNum).offset(offset);

    let countQuery = db
      .select({ total: sql<number>`count(*)::int` })
      .from(sales)
      .leftJoin(batches, eq(sales.batchId, batches.id))
      .$dynamic();
    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions));
    }
    const [{ total }] = await countQuery;

    const enrichedResults = await Promise.all(
      results.map(async (sale) => {
        const [financial, buyerSummary] = await Promise.all([
          getSaleFinancialSummary(sale.id, Number(sale.totalAmount)),
          getBuyerBalanceSummary(sale.buyerId),
        ]);
        return {
          ...sale,
          status: normalizeSaleWorkflowStatus(sale.status),
          totalPaid: financial.totalPaid,
          outstandingBalance: financial.outstandingBalance,
          settlementStatus: financial.settlementStatus,
          buyerAdvanceCredit: buyerSummary.advanceCredit,
          buyerNetBalance: buyerSummary.netBalance,
        };
      }),
    );

    res.json({
      success: true,
      data: enrichedResults,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch sales', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch sales', code: 'SALES_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// GET /api/sales/:id — sale detail with buyer, lorries, receipts, and balances
router.get('/:id', authenticate, requirePermission('sales:read'), async (req: Request, res: Response) => {
  try {
    const saleId = Number(req.params.id as string);

    const [sale] = await db
      .select({
        id: sales.id,
        saleCode: sales.saleCode,
        batchId: sales.batchId,
        batchCode: batches.batchCode,
        siteName: sites.siteName,
        buyerId: sales.buyerId,
        buyerName: buyers.buyerName,
        saleDate: sales.saleDate,
        totalBirds: sales.totalBirds,
        totalWeight: sales.totalWeight,
        pricePerKg: sales.pricePerKg,
        totalAmount: sales.totalAmount,
        status: sales.status,
        notes: sales.notes,
        createdAt: sales.createdAt,
        updatedAt: sales.updatedAt,
      })
      .from(sales)
      .leftJoin(buyers, eq(sales.buyerId, buyers.id))
      .leftJoin(batches, eq(sales.batchId, batches.id))
      .leftJoin(sites, eq(batches.siteId, sites.id))
      .where(eq(sales.id, saleId))
      .limit(1);

    if (!sale) {
      res.status(404).json({ success: false, error: 'Sale not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const [buyer, lorryLines, financial, buyerSummary] = await Promise.all([
      db.select().from(buyers).where(eq(buyers.id, sale.buyerId)).limit(1).then((rows) => rows[0] ?? null),
      listSaleLorries(saleId),
      getSaleFinancialSummary(saleId, Number(sale.totalAmount)),
      getBuyerBalanceSummary(sale.buyerId),
    ]);

    res.json({
      success: true,
      data: {
        sale: {
          ...sale,
          status: normalizeSaleWorkflowStatus(sale.status),
          settlementStatus: financial.settlementStatus,
          totalPaid: financial.totalPaid,
          outstandingBalance: financial.outstandingBalance,
        },
        buyer: buyer
          ? {
              ...buyer,
              ...buyerSummary,
            }
          : null,
        lorryLines,
        payments: financial.payments,
        totalPaid: financial.totalPaid,
        outstandingBalance: financial.outstandingBalance,
        availableBuyerCredit: buyerSummary.advanceCredit,
        buyerBalance: buyerSummary,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch sale detail', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch sale detail', code: 'SALE_DETAIL_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// POST /api/sales — create sale with auto-generated saleCode
router.post('/', authenticate, requirePermission('sales:create'), validate(createSaleSchema), async (req: Request, res: Response) => {
  try {
    const { batchId, buyerId, saleDate, totalBirds: requestedBirds, totalWeight: requestedWeight, pricePerKg, lorries, notes } = req.body;

    const [batch] = await db.select().from(batches).where(eq(batches.id, batchId)).limit(1);
    if (!batch) {
      res.status(400).json({ success: false, error: 'Batch not found', code: 'BATCH_NOT_FOUND', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }
    if (!['ready_for_sale', 'growing'].includes(batch.status)) {
      res.status(400).json({ success: false, error: 'Batch is not ready for sale', code: 'BATCH_NOT_READY', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }
    if (req.user!.siteId && batch.siteId !== req.user!.siteId) {
      res.status(403).json({ success: false, error: 'You can only create sales for your own site', code: 'FORBIDDEN', statusCode: 403, timestamp: new Date().toISOString() });
      return;
    }

    const [buyer] = await db.select().from(buyers).where(eq(buyers.id, buyerId)).limit(1);
    if (!buyer) {
      res.status(400).json({ success: false, error: 'Buyer not found', code: 'BUYER_NOT_FOUND', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }
    if (buyer.status === 'inactive') {
      res.status(400).json({ success: false, error: 'Buyer is inactive', code: 'BUYER_INACTIVE', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    const totals = lorries?.length
      ? normalizeSaleLorries(lorries)
      : {
          lines: [] as Array<{
            lineSequence: number;
            lorryNumber: string;
            birdsCount: number;
            previousWeight: number;
            loadedWeight: number;
            netWeight: number;
            notes: string | null;
          }>,
          totalBirds: requestedBirds,
          totalWeight: requestedWeight,
        };

    if (totals.totalBirds > batch.chicksPlaced) {
      res.status(400).json({ success: false, error: 'Sale birds cannot exceed birds placed in the batch', code: 'SALE_BIRDS_EXCEED_BATCH', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    const dateStr = saleDate.replace(/-/g, '');
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sales)
      .where(sql`${sales.saleCode} LIKE ${'SALE-' + dateStr + '-%'}`);
    const seq = String((countResult.count ?? 0) + 1).padStart(3, '0');
    const saleCode = `SALE-${dateStr}-${seq}`;
    const totalAmount = (totals.totalWeight * pricePerKg).toFixed(2);

    const [newSale] = await db
      .insert(sales)
      .values({
        saleCode,
        batchId,
        buyerId,
        saleDate,
        totalBirds: totals.totalBirds,
        totalWeight: totals.totalWeight.toFixed(2),
        pricePerKg: pricePerKg.toFixed(2),
        totalAmount,
        status: 'draft',
        notes: notes || null,
      })
      .returning();

    if (totals.lines.length > 0) {
      await db.insert(saleLorries).values(
        totals.lines.map((line) => ({
          saleId: newSale.id,
          lineSequence: line.lineSequence,
          lorryNumber: line.lorryNumber,
          birdsCount: line.birdsCount,
          previousWeight: line.previousWeight.toFixed(2),
          loadedWeight: line.loadedWeight.toFixed(2),
          netWeight: line.netWeight.toFixed(2),
          notes: line.notes,
        })),
      );
    }

    const [createdSale] = await db.select().from(sales).where(eq(sales.id, newSale.id)).limit(1);

    createAuditLog({
      userId: req.user!.id,
      action: 'sale_created',
      entityType: 'sale',
      entityId: newSale.id,
      changes: {
        saleCode,
        batchId,
        buyerId,
        totalBirds: totals.totalBirds,
        totalWeight: totals.totalWeight,
        pricePerKg,
        totalAmount,
        lorryCount: totals.lines.length,
      },
    });

    res.status(201).json({ success: true, data: createdSale, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to create sale', { error });
    const message = error instanceof Error ? error.message : 'Failed to create sale';
    res.status(500).json({ success: false, error: message, code: 'CREATE_SALE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// PUT /api/sales/:id — update sale status
router.put('/:id', authenticate, requirePermission('sales:update'), validate(updateSaleSchema), async (req: Request, res: Response) => {
  try {
    const saleId = Number(req.params.id as string);

    const [existing] = await db.select().from(sales).where(eq(sales.id, saleId)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Sale not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const hasDraftDetailUpdates =
      req.body.pricePerKg !== undefined ||
      req.body.lorries !== undefined;

    const updatePayload: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (req.body.notes !== undefined) {
      updatePayload.notes = req.body.notes;
    }

    if (hasDraftDetailUpdates) {
      if (existing.status !== 'draft') {
        res.status(400).json({ success: false, error: 'Lorries and pricing can only be edited while the sale is in draft', code: 'SALE_NOT_DRAFT', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }

      const effectivePricePerKg = req.body.pricePerKg ?? Number(existing.pricePerKg);
      const lorryLines: EditableLorryLine[] = req.body.lorries ?? (await listSaleLorries(saleId));
      const totals = normalizeSaleLorries(
        lorryLines.map((line: EditableLorryLine) => ({
          lorryNumber: line.lorryNumber,
          birdsCount: Number(line.birdsCount),
          previousWeight: Number(line.previousWeight),
          loadedWeight: Number(line.loadedWeight),
          notes: line.notes ?? undefined,
        })),
      );

      const [batch] = await db.select().from(batches).where(eq(batches.id, existing.batchId)).limit(1);
      if (!batch) {
        res.status(400).json({ success: false, error: 'Batch not found for sale', code: 'BATCH_NOT_FOUND', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }
      if (totals.totalBirds > batch.chicksPlaced) {
        res.status(400).json({ success: false, error: 'Sale birds cannot exceed birds placed in the batch', code: 'SALE_BIRDS_EXCEED_BATCH', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }

      updatePayload.pricePerKg = effectivePricePerKg.toFixed(2);
      updatePayload.totalBirds = totals.totalBirds;
      updatePayload.totalWeight = totals.totalWeight.toFixed(2);
      updatePayload.totalAmount = (totals.totalWeight * effectivePricePerKg).toFixed(2);

      await db.delete(saleLorries).where(eq(saleLorries.saleId, saleId));
      await db.insert(saleLorries).values(
        totals.lines.map((line) => ({
          saleId,
          lineSequence: line.lineSequence,
          lorryNumber: line.lorryNumber,
          birdsCount: line.birdsCount,
          previousWeight: line.previousWeight.toFixed(2),
          loadedWeight: line.loadedWeight.toFixed(2),
          netWeight: line.netWeight.toFixed(2),
          notes: line.notes,
        })),
      );
    }

    const existingWorkflowStatus = normalizeSaleWorkflowStatus(existing.status);
    const requestedStatus = req.body.status ? normalizeSaleWorkflowStatus(req.body.status) : undefined;

    if (requestedStatus === 'cancelled') {
      const [legacyPayment] = await db.select({ id: payments.id }).from(payments).where(eq(payments.saleId, saleId)).limit(1);
      const [allocatedReceipt] = await db
        .select({ id: buyerReceiptAllocations.id })
        .from(buyerReceiptAllocations)
        .where(eq(buyerReceiptAllocations.saleId, saleId))
        .limit(1);

      if (legacyPayment || allocatedReceipt) {
        res.status(400).json({ success: false, error: 'Cannot cancel a sale with payments or receipt allocations', code: 'SALE_HAS_PAYMENTS', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }
    }

    if (requestedStatus === 'reviewed') {
      if (!['draft', 'reviewed'].includes(existingWorkflowStatus)) {
        res.status(400).json({ success: false, error: 'Only draft sales can be moved to reviewed', code: 'INVALID_STATUS_TRANSITION', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }

      const effectiveLorries: EditableLorryLine[] = req.body.lorries ? req.body.lorries : await listSaleLorries(saleId);
      if (!effectiveLorries.length) {
        res.status(400).json({ success: false, error: 'Add at least one lorry before reviewing the sale', code: 'SALE_REQUIRES_LORRIES', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }

      const normalized = normalizeSaleLorries(
        effectiveLorries.map((line: EditableLorryLine) => ({
          lorryNumber: line.lorryNumber,
          birdsCount: Number(line.birdsCount),
          previousWeight: Number(line.previousWeight),
          loadedWeight: Number(line.loadedWeight),
          notes: line.notes ?? undefined,
        })),
      );
      if (normalized.totalWeight <= 0 || normalized.totalBirds <= 0) {
        res.status(400).json({ success: false, error: 'Sale must have valid lorry totals before review', code: 'SALE_INVALID_TOTALS', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }

      updatePayload.status = 'reviewed';
    } else if (requestedStatus === 'completed') {
      if (!['reviewed', 'completed'].includes(existingWorkflowStatus)) {
        res.status(400).json({ success: false, error: 'Only reviewed sales can be moved to completed', code: 'INVALID_STATUS_TRANSITION', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }

      const financial = await getSaleFinancialSummary(saleId, Number(updatePayload.totalAmount ?? existing.totalAmount));
      if (financial.outstandingBalance > 0.01) {
        res.status(400).json({ success: false, error: 'Fully settle the sale before marking it completed', code: 'SALE_HAS_OUTSTANDING_BALANCE', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }

      updatePayload.status = 'completed';
    } else if (requestedStatus !== undefined) {
      updatePayload.status = requestedStatus;
    }

    const [updated] = await db
      .update(sales)
      .set(updatePayload)
      .where(eq(sales.id, saleId))
      .returning();

    if (requestedStatus === 'reviewed' && existingWorkflowStatus === 'draft') {
      await autoApplyBuyerCreditToSale(existing.buyerId, saleId, Number(updated.totalAmount));
    }

    createAuditLog({
      userId: req.user!.id,
      action: 'sale_updated',
      entityType: 'sale',
      entityId: saleId,
      changes: { before: { status: existing.status, totalAmount: existing.totalAmount }, after: updatePayload },
    });

    res.json({
      success: true,
      data: {
        ...updated,
        status: normalizeSaleWorkflowStatus(updated.status),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to update sale', { error });
    res.status(500).json({ success: false, error: 'Failed to update sale', code: 'UPDATE_SALE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// DELETE /api/sales/:id — soft delete (set status to cancelled)
router.delete('/:id', authenticate, requirePermission('sales:delete'), async (req: Request, res: Response) => {
  try {
    const saleId = Number(req.params.id as string);

    const [existing] = await db.select().from(sales).where(eq(sales.id, saleId)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Sale not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const [legacyPayment] = await db.select({ id: payments.id }).from(payments).where(eq(payments.saleId, saleId)).limit(1);
    const [allocatedReceipt] = await db
      .select({ id: buyerReceiptAllocations.id })
      .from(buyerReceiptAllocations)
      .where(eq(buyerReceiptAllocations.saleId, saleId))
      .limit(1);

    if (legacyPayment || allocatedReceipt) {
      res.status(400).json({ success: false, error: 'Cannot delete a sale with payments or receipt allocations', code: 'SALE_HAS_PAYMENTS', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    const [updated] = await db
      .update(sales)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(sales.id, saleId))
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'sale_deleted',
      entityType: 'sale',
      entityId: saleId,
      changes: { before: { status: existing.status }, after: { status: 'cancelled' } },
    });

    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to delete sale', { error });
    res.status(500).json({ success: false, error: 'Failed to delete sale', code: 'DELETE_SALE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// POST /api/sales/:saleId/payments — add a buyer receipt allocated to a sale
router.post('/:saleId/payments', authenticate, requirePermission('payments:create'), validate(createPaymentSchema), async (req: Request, res: Response) => {
  try {
    const saleId = Number(req.params.saleId as string);

    const [sale] = await db.select().from(sales).where(eq(sales.id, saleId)).limit(1);
    if (!sale) {
      res.status(404).json({ success: false, error: 'Sale not found', code: 'SALE_NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }
    if (sale.status === 'cancelled') {
      res.status(400).json({ success: false, error: 'Payments cannot be added to cancelled sales', code: 'SALE_CANCELLED', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }
    if (!canTakeReceipts(sale.status)) {
      res.status(400).json({ success: false, error: 'Review the sale before recording receipts', code: 'SALE_NOT_REVIEWED', statusCode: 400, timestamp: new Date().toISOString() });
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
      buyerId: sale.buyerId,
      saleId,
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
        saleId,
        buyerId: sale.buyerId,
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
    if (isMissingTreasuryTable(error) || isMissingTreasuryColumn(error)) {
      sendTreasurySchemaNotReady(res);
      return;
    }
    logger.error('Failed to create buyer receipt', { error });
    res.status(500).json({ success: false, error: 'Failed to create payment receipt', code: 'CREATE_PAYMENT_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

export default router;
