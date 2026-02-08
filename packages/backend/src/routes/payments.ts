import { Router, type Request, type Response } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate } from '../validators/auth';
import { updatePaymentSchema } from '../validators/sales';
import { db } from '../db';
import { payments, sales } from '../db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { createAuditLog } from '../lib/audit';
import logger from '../lib/logger';

const router = Router();

// GET /api/payments — list payments (with optional saleId filter)
router.get('/', authenticate, requirePermission('payments:read'), async (req: Request, res: Response) => {
  try {
    const { saleId, paymentStatus, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    let query = db
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
        recordedBy: payments.recordedBy,
        createdAt: payments.createdAt,
        updatedAt: payments.updatedAt,
      })
      .from(payments)
      .leftJoin(sales, eq(payments.saleId, sales.id))
      .$dynamic();

    const conditions = [];
    if (saleId) {
      conditions.push(eq(payments.saleId, Number(saleId)));
    }
    if (paymentStatus && paymentStatus !== 'all') {
      conditions.push(eq(payments.paymentStatus, paymentStatus as string));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query
      .orderBy(desc(payments.paymentDate))
      .limit(limitNum)
      .offset(offset);

    let countQuery = db.select({ total: sql<number>`count(*)::int` }).from(payments).$dynamic();
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
    logger.error('Failed to fetch payments', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch payments', code: 'PAYMENTS_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// PUT /api/payments/:id — update payment status (cheque clearing)
router.put('/:id', authenticate, requirePermission('payments:update'), validate(updatePaymentSchema), async (req: Request, res: Response) => {
  try {
    const paymentId = Number(req.params.id as string);

    const [existing] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Payment not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const [updated] = await db
      .update(payments)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(payments.id, paymentId))
      .returning();

    // Recalculate sale status based on payments
    if (req.body.paymentStatus) {
      const saleId = existing.saleId;
      const [sale] = await db.select().from(sales).where(eq(sales.id, saleId)).limit(1);

      if (sale) {
        const [paidResult] = await db
          .select({ total: sql<number>`COALESCE(sum(${payments.paymentAmount}::numeric), 0)::float` })
          .from(payments)
          .where(and(eq(payments.saleId, saleId), eq(payments.paymentStatus, 'completed')));
        const totalPaid = paidResult?.total ?? 0;

        if (totalPaid >= Number(sale.totalAmount) - 0.01) {
          // Fully paid — mark as completed
          await db.update(sales).set({ status: 'completed', updatedAt: new Date() }).where(eq(sales.id, saleId));
        } else if (sale.status === 'completed') {
          // Was completed but a payment bounced — revert to pending
          await db.update(sales).set({ status: 'pending', updatedAt: new Date() }).where(eq(sales.id, saleId));
        }
      }
    }

    createAuditLog({
      userId: req.user!.id,
      action: 'payment_updated',
      entityType: 'payment',
      entityId: paymentId,
      changes: { before: { paymentStatus: existing.paymentStatus }, after: { paymentStatus: updated.paymentStatus } },
    });

    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to update payment', { error });
    res.status(500).json({ success: false, error: 'Failed to update payment', code: 'UPDATE_PAYMENT_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

export default router;
