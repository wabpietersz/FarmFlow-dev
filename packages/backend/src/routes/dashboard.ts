import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/auth';
import { db } from '../db';
import { batches, dailyRecords, sales, payments, employees } from '../db/schema';
import { eq, sql, and, gte } from 'drizzle-orm';
import logger from '../lib/logger';

const router = Router();

router.get('/summary', authenticate, async (req: Request, res: Response) => {
  try {
    const userSiteId = req.user?.siteId ?? null;

    // Active batches
    const batchConditions = [
      sql`${batches.status} IN ('placement', 'growing', 'ready_for_sale')`,
    ];
    if (userSiteId) {
      batchConditions.push(eq(batches.siteId, userSiteId));
    }
    const activeBatchesResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(batches)
      .where(and(...batchConditions));

    // Mortality last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateStr = sevenDaysAgo.toISOString().split('T')[0];

    let mortalityQuery = db
      .select({ total: sql<number>`COALESCE(sum(${dailyRecords.mortalityCount}), 0)::int` })
      .from(dailyRecords)
      .where(gte(dailyRecords.recordDate, dateStr));
    if (userSiteId) {
      mortalityQuery = db
        .select({ total: sql<number>`COALESCE(sum(${dailyRecords.mortalityCount}), 0)::int` })
        .from(dailyRecords)
        .innerJoin(batches, eq(dailyRecords.batchId, batches.id))
        .where(and(gte(dailyRecords.recordDate, dateStr), eq(batches.siteId, userSiteId)));
    }
    const mortalityResult = await mortalityQuery;

    // Outstanding payments
    const outstandingResult = await db
      .select({ total: sql<number>`COALESCE(sum(${sales.totalAmount}::numeric), 0)::float` })
      .from(sales)
      .where(eq(sales.status, 'pending'));

    const paidResult = await db
      .select({ total: sql<number>`COALESCE(sum(${payments.paymentAmount}::numeric), 0)::float` })
      .from(payments)
      .innerJoin(sales, eq(payments.saleId, sales.id))
      .where(and(eq(sales.status, 'pending'), eq(payments.paymentStatus, 'completed')));

    // Total active employees
    const empConditions = [eq(employees.status, 'active')];
    if (userSiteId) {
      empConditions.push(eq(employees.siteId, userSiteId));
    }
    const employeesResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(employees)
      .where(and(...empConditions));

    // Recent sales (7 days)
    const recentSalesResult = await db
      .select({
        count: sql<number>`count(*)::int`,
        total: sql<number>`COALESCE(sum(${sales.totalAmount}::numeric), 0)::float`,
      })
      .from(sales)
      .where(gte(sales.saleDate, dateStr));

    res.json({
      success: true,
      data: {
        activeBatches: activeBatchesResult[0]?.count ?? 0,
        averageFcr: 0,
        mortalityLast7Days: mortalityResult[0]?.total ?? 0,
        outstandingPayments:
          (outstandingResult[0]?.total ?? 0) - (paidResult[0]?.total ?? 0),
        totalEmployees: employeesResult[0]?.count ?? 0,
        recentSales: {
          count: recentSalesResult[0]?.count ?? 0,
          totalAmount: recentSalesResult[0]?.total ?? 0,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch dashboard summary', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard summary',
      code: 'DASHBOARD_SUMMARY_FAILED',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
