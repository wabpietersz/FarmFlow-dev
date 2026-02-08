import { Router, type Request, type Response } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate } from '../validators/auth';
import { createSaleSchema, updateSaleSchema, createPaymentSchema } from '../validators/sales';
import { db } from '../db';
import { sales, buyers, batches, payments, sites } from '../db/schema';
import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { createAuditLog } from '../lib/audit';
import logger from '../lib/logger';

const router = Router();

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
        pricePerBird: sales.pricePerBird,
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
      conditions.push(eq(sales.status, status as string));
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

    // Site restriction for farm managers
    if (req.user!.siteId) {
      conditions.push(eq(batches.siteId, req.user!.siteId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query
      .orderBy(desc(sales.createdAt))
      .limit(limitNum)
      .offset(offset);

    // Count query — needs same joins for site filtering
    let countQuery = db
      .select({ total: sql<number>`count(*)::int` })
      .from(sales)
      .leftJoin(batches, eq(sales.batchId, batches.id))
      .$dynamic();
    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions));
    }
    const [{ total }] = await countQuery;

    res.json({
      success: true,
      data: results,
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

// GET /api/sales/:id — sale detail with buyer, batch, payments, outstanding
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
        pricePerBird: sales.pricePerBird,
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

    // Get buyer details
    const [buyer] = await db.select().from(buyers).where(eq(buyers.id, sale.buyerId)).limit(1);

    // Get payments
    const salePayments = await db
      .select()
      .from(payments)
      .where(eq(payments.saleId, saleId))
      .orderBy(desc(payments.paymentDate));

    // Calculate outstanding balance
    const totalPaid = salePayments
      .filter((p) => p.paymentStatus === 'completed')
      .reduce((sum, p) => sum + Number(p.paymentAmount), 0);
    const outstandingBalance = Number(sale.totalAmount) - totalPaid;

    res.json({
      success: true,
      data: {
        sale,
        buyer,
        payments: salePayments,
        totalPaid,
        outstandingBalance,
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
    const { batchId, buyerId, saleDate, totalBirds, pricePerBird, notes } = req.body;

    // Validate batch exists and is ready
    const [batch] = await db.select().from(batches).where(eq(batches.id, batchId)).limit(1);
    if (!batch) {
      res.status(400).json({ success: false, error: 'Batch not found', code: 'BATCH_NOT_FOUND', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }
    if (!['ready_for_sale', 'growing'].includes(batch.status)) {
      res.status(400).json({ success: false, error: 'Batch is not ready for sale', code: 'BATCH_NOT_READY', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    // Site restriction for farm managers
    if (req.user!.siteId && batch.siteId !== req.user!.siteId) {
      res.status(403).json({ success: false, error: 'You can only create sales for your own site', code: 'FORBIDDEN', statusCode: 403, timestamp: new Date().toISOString() });
      return;
    }

    // Validate buyer exists and is active
    const [buyer] = await db.select().from(buyers).where(eq(buyers.id, buyerId)).limit(1);
    if (!buyer) {
      res.status(400).json({ success: false, error: 'Buyer not found', code: 'BUYER_NOT_FOUND', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }
    if (buyer.status === 'inactive') {
      res.status(400).json({ success: false, error: 'Buyer is inactive', code: 'BUYER_INACTIVE', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    // Auto-generate saleCode: SALE-YYYYMMDD-XXX
    const dateStr = saleDate.replace(/-/g, '');
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sales)
      .where(sql`${sales.saleCode} LIKE ${'SALE-' + dateStr + '-%'}`);
    const seq = String((countResult.count ?? 0) + 1).padStart(3, '0');
    const saleCode = `SALE-${dateStr}-${seq}`;

    // Calculate totalAmount
    const totalAmount = (totalBirds * pricePerBird).toFixed(2);

    const [newSale] = await db
      .insert(sales)
      .values({
        saleCode,
        batchId,
        buyerId,
        saleDate,
        totalBirds,
        pricePerBird: pricePerBird.toFixed(2),
        totalAmount,
        status: 'pending',
        notes: notes || null,
      })
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'sale_created',
      entityType: 'sale',
      entityId: newSale.id,
      changes: { saleCode, batchId, buyerId, totalBirds, pricePerBird, totalAmount },
    });

    res.status(201).json({ success: true, data: newSale, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to create sale', { error });
    res.status(500).json({ success: false, error: 'Failed to create sale', code: 'CREATE_SALE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
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

    // If cancelling, check for completed payments
    if (req.body.status === 'cancelled') {
      const [completedPayment] = await db
        .select({ id: payments.id })
        .from(payments)
        .where(and(eq(payments.saleId, saleId), eq(payments.paymentStatus, 'completed')))
        .limit(1);

      if (completedPayment) {
        res.status(400).json({ success: false, error: 'Cannot cancel a sale with completed payments', code: 'SALE_HAS_PAYMENTS', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }
    }

    const [updated] = await db
      .update(sales)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(sales.id, saleId))
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'sale_updated',
      entityType: 'sale',
      entityId: saleId,
      changes: { before: { status: existing.status }, after: { status: updated.status } },
    });

    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
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

    // Check for any payments
    const [existingPayment] = await db
      .select({ id: payments.id })
      .from(payments)
      .where(eq(payments.saleId, saleId))
      .limit(1);

    if (existingPayment) {
      res.status(400).json({ success: false, error: 'Cannot delete a sale with payments', code: 'SALE_HAS_PAYMENTS', statusCode: 400, timestamp: new Date().toISOString() });
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

// POST /api/sales/:saleId/payments — add payment to a sale
router.post('/:saleId/payments', authenticate, requirePermission('payments:create'), validate(createPaymentSchema), async (req: Request, res: Response) => {
  try {
    const saleId = Number(req.params.saleId as string);

    // Validate sale exists and is pending
    const [sale] = await db.select().from(sales).where(eq(sales.id, saleId)).limit(1);
    if (!sale) {
      res.status(404).json({ success: false, error: 'Sale not found', code: 'SALE_NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }
    if (sale.status !== 'pending') {
      res.status(400).json({ success: false, error: 'Payments can only be added to pending sales', code: 'SALE_NOT_PENDING', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    // Calculate outstanding balance
    const [paidResult] = await db
      .select({ total: sql<number>`COALESCE(sum(${payments.paymentAmount}::numeric), 0)::float` })
      .from(payments)
      .where(and(eq(payments.saleId, saleId), eq(payments.paymentStatus, 'completed')));
    const totalPaid = paidResult?.total ?? 0;
    const outstanding = Number(sale.totalAmount) - totalPaid;

    // Validate payment does not exceed outstanding
    if (req.body.paymentAmount > outstanding + 0.01) {
      res.status(400).json({
        success: false,
        error: `Payment amount exceeds outstanding balance of ${outstanding.toFixed(2)}`,
        code: 'PAYMENT_EXCEEDS_BALANCE',
        statusCode: 400,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Cheque payments default to 'pending', cash/bank_transfer to 'completed'
    const paymentStatus = req.body.paymentMethod === 'cheque' ? 'pending' : 'completed';

    const [newPayment] = await db
      .insert(payments)
      .values({
        saleId,
        paymentAmount: req.body.paymentAmount.toFixed(2),
        paymentDate: req.body.paymentDate,
        paymentMethod: req.body.paymentMethod,
        chequeNumber: req.body.chequeNumber || null,
        chequeDate: req.body.chequeDate || null,
        bankName: req.body.bankName || null,
        paymentStatus,
        notes: req.body.notes || null,
        recordedBy: req.user!.id,
      })
      .returning();

    // Auto-complete sale if fully paid
    const newTotalPaid = totalPaid + (paymentStatus === 'completed' ? req.body.paymentAmount : 0);
    if (newTotalPaid >= Number(sale.totalAmount) - 0.01) {
      await db.update(sales).set({ status: 'completed', updatedAt: new Date() }).where(eq(sales.id, saleId));
    }

    createAuditLog({
      userId: req.user!.id,
      action: 'payment_recorded',
      entityType: 'payment',
      entityId: newPayment.id,
      changes: { saleId, paymentAmount: req.body.paymentAmount, paymentMethod: req.body.paymentMethod, paymentStatus },
    });

    res.status(201).json({ success: true, data: newPayment, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to create payment', { error });
    res.status(500).json({ success: false, error: 'Failed to create payment', code: 'CREATE_PAYMENT_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

export default router;
