import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/auth';
import { db } from '../db';
import { batches, dailyRecords, sales, payments, employees, feedInventory, payroll, attendance, auditLogs } from '../db/schema';
import { eq, sql, and, gte, lte, between, desc } from 'drizzle-orm';
import logger from '../lib/logger';
import type { DashboardPeriod } from '@farmflow/shared';

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

// ---------------------------------------------------------------------------
// GET /api/dashboard/enhanced?period=7d|30d|90d|ytd
// ---------------------------------------------------------------------------
function getPeriodDates(period: DashboardPeriod): { currentStart: Date; currentEnd: Date; previousStart: Date; previousEnd: Date; days: number } {
  const now = new Date();
  const currentEnd = new Date(now);
  let days: number;

  if (period === 'ytd') {
    const yearStart = new Date(now.getFullYear(), 0, 1);
    days = Math.floor((now.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  } else {
    days = parseInt(period);
  }

  const currentStart = period === 'ytd'
    ? new Date(now.getFullYear(), 0, 1)
    : new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const previousEnd = new Date(currentStart.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - days * 24 * 60 * 60 * 1000);

  return { currentStart, currentEnd, previousStart, previousEnd, days };
}

function computeTrend(current: number, previous: number) {
  const changePercent = previous > 0 ? Number((((current - previous) / previous) * 100).toFixed(1)) : current > 0 ? 100 : 0;
  const direction: 'up' | 'down' | 'flat' = current > previous ? 'up' : current < previous ? 'down' : 'flat';
  return { value: current, previousValue: previous, changePercent, direction };
}

router.get('/enhanced', authenticate, async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as DashboardPeriod) || '7d';
    const userSiteId = req.user?.siteId ?? null;
    const { currentStart, currentEnd, previousStart, previousEnd } = getPeriodDates(period);

    const fmtDate = (d: Date) => d.toISOString().split('T')[0];
    const curStart = fmtDate(currentStart);
    const curEnd = fmtDate(currentEnd);
    const prevStart = fmtDate(previousStart);
    const prevEnd = fmtDate(previousEnd);

    // --- Base summary (reuse existing logic) ---
    const batchConditions = [
      sql`${batches.status} IN ('placement', 'growing', 'ready_for_sale')`,
    ];
    if (userSiteId) batchConditions.push(eq(batches.siteId, userSiteId));

    const activeBatchesResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(batches)
      .where(and(...batchConditions));

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
    if (userSiteId) empConditions.push(eq(employees.siteId, userSiteId));
    const employeesResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(employees)
      .where(and(...empConditions));

    // Recent sales (current period)
    const recentSalesResult = await db
      .select({
        count: sql<number>`count(*)::int`,
        total: sql<number>`COALESCE(sum(${sales.totalAmount}::numeric), 0)::float`,
      })
      .from(sales)
      .where(gte(sales.saleDate, curStart));

    // --- Mortality trend (sparkline + comparison) ---
    const mortalitySparklineQuery = db
      .select({
        date: dailyRecords.recordDate,
        total: sql<number>`COALESCE(sum(${dailyRecords.mortalityCount}), 0)::int`,
      })
      .from(dailyRecords);

    // Always get last 7 days for sparkline regardless of period
    const sparklineStart = fmtDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    const sparklineRows = await mortalitySparklineQuery
      .where(gte(dailyRecords.recordDate, sparklineStart))
      .groupBy(dailyRecords.recordDate)
      .orderBy(dailyRecords.recordDate);

    const mortalitySparkline = sparklineRows.map((r) => r.total);

    // Current period mortality
    const [curMortality] = await db
      .select({ total: sql<number>`COALESCE(sum(${dailyRecords.mortalityCount}), 0)::int` })
      .from(dailyRecords)
      .where(and(gte(dailyRecords.recordDate, curStart), lte(dailyRecords.recordDate, curEnd)));

    // Previous period mortality
    const [prevMortality] = await db
      .select({ total: sql<number>`COALESCE(sum(${dailyRecords.mortalityCount}), 0)::int` })
      .from(dailyRecords)
      .where(and(gte(dailyRecords.recordDate, prevStart), lte(dailyRecords.recordDate, prevEnd)));

    const mortalityTrend = {
      ...computeTrend(curMortality?.total ?? 0, prevMortality?.total ?? 0),
      sparkline: mortalitySparkline,
    };

    // --- Sales trend ---
    const [curSalesTrend] = await db
      .select({ total: sql<number>`COALESCE(sum(${sales.totalAmount}::numeric), 0)::float` })
      .from(sales)
      .where(and(gte(sales.saleDate, curStart), lte(sales.saleDate, curEnd)));

    const [prevSalesTrend] = await db
      .select({ total: sql<number>`COALESCE(sum(${sales.totalAmount}::numeric), 0)::float` })
      .from(sales)
      .where(and(gte(sales.saleDate, prevStart), lte(sales.saleDate, prevEnd)));

    // Sales sparkline (last 7 days)
    const salesSparklineRows = await db
      .select({
        date: sales.saleDate,
        total: sql<number>`COALESCE(sum(${sales.totalAmount}::numeric), 0)::float`,
      })
      .from(sales)
      .where(gte(sales.saleDate, sparklineStart))
      .groupBy(sales.saleDate)
      .orderBy(sales.saleDate);

    const salesTrend = {
      ...computeTrend(curSalesTrend?.total ?? 0, prevSalesTrend?.total ?? 0),
      sparkline: salesSparklineRows.map((r) => r.total),
    };

    // --- Average FCR trend ---
    // Current period: avg FCR from daily records
    const [curFcrAgg] = await db
      .select({
        totalFeed: sql<number>`COALESCE(sum(${dailyRecords.feedConsumption}::numeric), 0)::float`,
        totalWeight: sql<number>`COALESCE(sum((${dailyRecords.averageWeight}::numeric / 1000) * ${dailyRecords.birdCount}), 0)::float`,
      })
      .from(dailyRecords)
      .where(and(gte(dailyRecords.recordDate, curStart), lte(dailyRecords.recordDate, curEnd)));

    const [prevFcrAgg] = await db
      .select({
        totalFeed: sql<number>`COALESCE(sum(${dailyRecords.feedConsumption}::numeric), 0)::float`,
        totalWeight: sql<number>`COALESCE(sum((${dailyRecords.averageWeight}::numeric / 1000) * ${dailyRecords.birdCount}), 0)::float`,
      })
      .from(dailyRecords)
      .where(and(gte(dailyRecords.recordDate, prevStart), lte(dailyRecords.recordDate, prevEnd)));

    const curFcr = (curFcrAgg?.totalWeight ?? 0) > 0 ? Number(((curFcrAgg?.totalFeed ?? 0) / (curFcrAgg?.totalWeight ?? 1)).toFixed(3)) : 0;
    const prevFcr = (prevFcrAgg?.totalWeight ?? 0) > 0 ? Number(((prevFcrAgg?.totalFeed ?? 0) / (prevFcrAgg?.totalWeight ?? 1)).toFixed(3)) : 0;

    const averageFcrTrend = {
      ...computeTrend(curFcr, prevFcr),
      sparkline: [], // FCR sparkline would be expensive; keep empty for now
    };

    // --- Feed inventory status ---
    const inventoryRows = await db
      .select({
        quantity: feedInventory.quantity,
        costPerUnit: feedInventory.costPerUnit,
        reorderLevel: feedInventory.reorderLevel,
      })
      .from(feedInventory);

    const feedInventoryStatus = {
      totalItems: inventoryRows.length,
      lowStockItems: inventoryRows.filter((i) => i.reorderLevel && Number(i.quantity) < Number(i.reorderLevel)).length,
      totalValue: Number(inventoryRows.reduce((sum, i) => sum + Number(i.quantity) * Number(i.costPerUnit), 0).toFixed(2)),
    };

    // --- Pending payroll ---
    const [pendingPayrollResult] = await db
      .select({
        count: sql<number>`count(*)::int`,
        totalAmount: sql<number>`COALESCE(sum(${payroll.netSalary}::numeric), 0)::float`,
      })
      .from(payroll)
      .where(sql`${payroll.status} IN ('draft', 'reviewed')`);

    const pendingPayroll = {
      count: pendingPayrollResult?.count ?? 0,
      totalAmount: pendingPayrollResult?.totalAmount ?? 0,
    };

    // --- Attendance rate (today) ---
    const today = fmtDate(new Date());
    const [attendanceToday] = await db
      .select({
        presentCount: sql<number>`count(*) FILTER (WHERE ${attendance.status} IN ('present', 'half_day'))::int`,
        totalCount: sql<number>`count(*)::int`,
      })
      .from(attendance)
      .where(eq(attendance.attendanceDate, today));

    const totalActiveEmployees = employeesResult[0]?.count ?? 0;
    const presentToday = attendanceToday?.presentCount ?? 0;
    const attendanceRate = {
      rate: totalActiveEmployees > 0 ? Number(((presentToday / totalActiveEmployees) * 100).toFixed(1)) : 0,
      presentToday,
      totalActive: totalActiveEmployees,
    };

    res.json({
      success: true,
      data: {
        activeBatches: activeBatchesResult[0]?.count ?? 0,
        averageFcr: curFcr,
        mortalityLast7Days: curMortality?.total ?? 0,
        outstandingPayments: (outstandingResult[0]?.total ?? 0) - (paidResult[0]?.total ?? 0),
        totalEmployees: totalActiveEmployees,
        recentSales: {
          count: recentSalesResult[0]?.count ?? 0,
          totalAmount: recentSalesResult[0]?.total ?? 0,
        },
        mortalityTrend,
        salesTrend,
        averageFcrTrend,
        feedInventoryStatus,
        pendingPayroll,
        attendanceRate,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch enhanced dashboard', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch enhanced dashboard',
      code: 'ENHANCED_DASHBOARD_FAILED',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/dashboard/recent-activity — recent audit log activity
// ---------------------------------------------------------------------------
router.get('/recent-activity', authenticate, async (req: Request, res: Response) => {
  try {
    const { limit: limitParam = '10' } = req.query;
    const limitNum = Math.min(50, Math.max(1, Number(limitParam)));

    const activities = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        timestamp: auditLogs.timestamp,
      })
      .from(auditLogs)
      .orderBy(desc(auditLogs.timestamp))
      .limit(limitNum);

    // Map audit actions to user-friendly descriptions
    const mapped = activities.map((a) => {
      const typeLabels: Record<string, string> = {
        employee: 'Employee', batch: 'Batch', sale: 'Sale',
        feed_production: 'Feed', feed_distribution: 'Feed',
        feed_inventory: 'Feed', feed_recipe: 'Feed',
        payroll: 'Payroll', attendance: 'Attendance',
        report_schedule: 'Report',
      };
      const actionLabels: Record<string, string> = {
        employee_created: 'New employee added',
        employee_updated: 'Employee updated',
        batch_created: 'New batch created',
        batch_status_updated: 'Batch status changed',
        sale_created: 'New sale recorded',
        payment_added: 'Payment received',
        production_created: 'Feed production started',
        production_completed: 'Feed production completed',
        production_qc_passed: 'QC checkpoint passed',
        distribution_created: 'Feed distributed',
        inventory_adjusted: 'Inventory adjusted',
        inventory_restocked: 'Inventory restocked',
        payroll_created: 'Payroll created',
        payroll_status_updated: 'Payroll status changed',
        attendance_created: 'Attendance recorded',
        report_schedule_created: 'Report scheduled',
        recipe_version_created: 'New recipe version',
      };

      const entityType = a.entityType || 'unknown';
      const mappedType = typeLabels[entityType] || entityType;
      const typeKey = mappedType.toLowerCase() as 'batch' | 'sale' | 'employee' | 'feed' | 'payroll' | 'attendance';

      return {
        id: a.id,
        type: typeKey,
        action: a.action,
        entityId: a.entityId || 0,
        description: actionLabels[a.action] || a.action.replace(/_/g, ' '),
        timestamp: a.timestamp ? new Date(a.timestamp).toISOString() : new Date().toISOString(),
      };
    });

    res.json({ success: true, data: mapped, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to fetch recent activity', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent activity',
      code: 'RECENT_ACTIVITY_FAILED',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
