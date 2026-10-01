import { Router, type Request, type Response } from 'express';
import { hasPermission } from '../lib/permissions';
import { buildHomeDashboard } from '../lib/home-dashboard';
import { authenticate } from '../middleware/auth';
import { db } from '../db';
import { batches, buyerReceiptAllocations, buyerReceiptLines, buyerReceipts, buyers, chickPlacements, dailyRecords, employees, feedInventory, financeAccounts, financeReconciliations, inventoryLots, operationalExpenses, payroll, sales, serviceWorkOrders, supplierContracts, supplierInvoices, supplierPaymentAllocations, supplierPayments, treasuryTransactionEntries, treasuryTransactions, attendance, auditLogs } from '../db/schema';
import { eq, sql, and, gte, lte, desc, or } from 'drizzle-orm';
import logger from '../lib/logger';
import type { DashboardPeriod } from '@farmflow/shared';
import { buildBatchCostSummaries } from '../lib/batch-costs';

const router = Router();

// GET /api/dashboard/home — the Home screen: cash, this month's money, live batches, things to do today
router.get('/home', authenticate, async (req: Request, res: Response) => {
  try {
    const data = await buildHomeDashboard({
      can: (permission: string) => hasPermission(req.user!.userRole, permission),
      siteScope: req.user!.siteId ?? null,
    });
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to build home dashboard', { error });
    res.status(500).json({ success: false, error: 'Failed to load the home screen', code: 'HOME_DASHBOARD_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

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
      .where(sql`${sales.status} IN ('reviewed', 'pending')`);

    const paidResult = await db
      .select({ total: sql<number>`COALESCE(sum(${buyerReceiptAllocations.allocatedAmount}::numeric), 0)::float` })
      .from(buyerReceiptAllocations)
      .innerJoin(buyerReceiptLines, eq(buyerReceiptAllocations.receiptLineId, buyerReceiptLines.id))
      .innerJoin(sales, eq(buyerReceiptAllocations.saleId, sales.id))
      .where(and(sql`${sales.status} IN ('reviewed', 'pending')`, eq(buyerReceiptLines.paymentStatus, 'completed')));

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
      .where(sql`${sales.status} IN ('reviewed', 'pending')`);

    const paidResult = await db
      .select({ total: sql<number>`COALESCE(sum(${buyerReceiptAllocations.allocatedAmount}::numeric), 0)::float` })
      .from(buyerReceiptAllocations)
      .innerJoin(buyerReceiptLines, eq(buyerReceiptAllocations.receiptLineId, buyerReceiptLines.id))
      .innerJoin(sales, eq(buyerReceiptAllocations.saleId, sales.id))
      .where(and(sql`${sales.status} IN ('reviewed', 'pending')`, eq(buyerReceiptLines.paymentStatus, 'completed')));

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

router.get('/executive', authenticate, async (_req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [accountRows, pendingApprovals, pendingCheques, recentReconciliations, activeBatchRows, revenueRows, overduePayablesRows, receivableTotals] = await Promise.all([
      db
        .select({
          id: financeAccounts.id,
          accountName: financeAccounts.accountName,
          accountType: financeAccounts.accountType,
          openingBalance: financeAccounts.openingBalance,
          movement: sql<number>`
            COALESCE(SUM(
              CASE
                WHEN ${treasuryTransactionEntries.entryDirection} = 'inflow' THEN ${treasuryTransactionEntries.amount}::numeric
                WHEN ${treasuryTransactionEntries.entryDirection} = 'outflow' THEN -${treasuryTransactionEntries.amount}::numeric
                ELSE 0
              END
            ), 0)::float
          `,
        })
        .from(financeAccounts)
        .leftJoin(treasuryTransactionEntries, eq(financeAccounts.id, treasuryTransactionEntries.financeAccountId))
        .where(eq(financeAccounts.status, 'active'))
        .groupBy(financeAccounts.id),
      Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(operationalExpenses).where(eq(operationalExpenses.status, 'pending_approval')),
        db.select({ count: sql<number>`count(*)::int` }).from(serviceWorkOrders).where(eq(serviceWorkOrders.status, 'pending_approval')),
        db.select({ count: sql<number>`count(*)::int` }).from(supplierInvoices).where(eq(supplierInvoices.status, 'recorded')),
        db.select({ count: sql<number>`count(*)::int` }).from(supplierContracts).where(eq(supplierContracts.status, 'draft')),
      ]),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(treasuryTransactions)
        .where(eq(treasuryTransactions.status, 'pending')),
      db
        .select({
          financeAccountId: financeReconciliations.financeAccountId,
          closedAt: financeReconciliations.closedAt,
        })
        .from(financeReconciliations)
        .orderBy(desc(financeReconciliations.closedAt)),
      db
        .select({
          id: batches.id,
          batchCode: batches.batchCode,
          siteId: batches.siteId,
          chicksPlaced: batches.chicksPlaced,
          placementDate: batches.placementDate,
          actualDeliveryDate: batches.actualDeliveryDate,
        })
        .from(batches)
        .where(sql`${batches.status} IN ('placement', 'growing', 'ready_for_sale')`),
      db
        .select({
          batchId: sales.batchId,
          revenue: sql<number>`COALESCE(SUM(${sales.totalAmount}::numeric), 0)::float`,
        })
        .from(sales)
        .where(sql`${sales.status} <> 'cancelled'`)
        .groupBy(sales.batchId),
      db
        .select({
          id: supplierInvoices.id,
          dueDate: supplierInvoices.dueDate,
          invoiceAmount: supplierInvoices.invoiceAmount,
          paidAmount: sql<number>`COALESCE((
            SELECT SUM(${supplierPaymentAllocations.allocatedAmount}::numeric)
            FROM ${supplierPaymentAllocations}
            INNER JOIN ${supplierPayments} ON ${supplierPayments.id} = ${supplierPaymentAllocations.supplierPaymentId}
            WHERE ${supplierPaymentAllocations.supplierInvoiceId} = ${supplierInvoices.id}
              AND ${supplierPayments.paymentStatus} IN ('pending', 'completed')
          ), 0)::float`,
        })
        .from(supplierInvoices)
        .where(sql`${supplierInvoices.status} IN ('approved', 'recorded') AND ${supplierInvoices.dueDate} < ${today}`),
      Promise.all([
        db.select({ total: sql<number>`COALESCE(SUM(${sales.totalAmount}::numeric), 0)::float` }).from(sales).where(sql`${sales.status} IN ('reviewed', 'pending')`),
        db.select({ total: sql<number>`COALESCE(SUM(${buyerReceiptAllocations.allocatedAmount}::numeric), 0)::float` }).from(buyerReceiptAllocations).innerJoin(buyerReceiptLines, eq(buyerReceiptAllocations.receiptLineId, buyerReceiptLines.id)).innerJoin(sales, eq(buyerReceiptAllocations.saleId, sales.id)).where(and(sql`${sales.status} IN ('reviewed', 'pending')`, eq(buyerReceiptLines.paymentStatus, 'completed'))),
      ]),
    ]);

    const balances = accountRows.map((row) => ({
      ...row,
      balance: Number((Number(row.openingBalance) + (row.movement ?? 0)).toFixed(2)),
    }));
    const totalCash = balances.reduce((sum, row) => sum + row.balance, 0);
    const bankCash = balances.filter((row) => ['bank', 'current'].includes(row.accountType)).reduce((sum, row) => sum + row.balance, 0);
    const onHandCash = balances.filter((row) => ['cash', 'petty_cash'].includes(row.accountType)).reduce((sum, row) => sum + row.balance, 0);

    const batchCostSummaries = await buildBatchCostSummaries(
      activeBatchRows.map((batch) => ({
        ...batch,
        placementDate: String(batch.placementDate),
        actualDeliveryDate: batch.actualDeliveryDate ? String(batch.actualDeliveryDate) : null,
      })),
    );

    const revenueByBatch = new Map(revenueRows.map((row) => [row.batchId, row.revenue ?? 0]));
    let totalProfitabilityRevenue = 0;
    let totalProfitabilityCost = 0;
    for (const batch of activeBatchRows) {
      const revenue = revenueByBatch.get(batch.id) ?? 0;
      const cost = batchCostSummaries.get(batch.id)?.totalCost ?? 0;
      totalProfitabilityRevenue += revenue;
      totalProfitabilityCost += cost;
    }

    const overduePayables = overduePayablesRows.reduce((sum, row) => {
      const balance = Number(row.invoiceAmount) - Number(row.paidAmount ?? 0);
      return balance > 0 ? sum + balance : sum;
    }, 0);

    const pendingApprovalCount = pendingApprovals.reduce((sum, rows) => sum + (rows[0]?.count ?? 0), 0);
    const lastReconciliationAt = recentReconciliations[0]?.closedAt
      ? new Date(recentReconciliations[0].closedAt).toISOString()
      : null;

    res.json({
      success: true,
      data: {
        cash: {
          totalBookBalance: Number(totalCash.toFixed(2)),
          bankBalance: Number(bankCash.toFixed(2)),
          onHandBalance: Number(onHandCash.toFixed(2)),
          pendingCheques: pendingCheques[0]?.count ?? 0,
          lastReconciliationAt,
        },
        payables: {
          overdueAmount: Number(overduePayables.toFixed(2)),
          pendingApprovalCount,
        },
        receivables: {
          outstandingAmount: Number((((receivableTotals[0]?.[0]?.total ?? 0) - (receivableTotals[1]?.[0]?.total ?? 0))).toFixed(2)),
        },
        profitability: {
          activeBatchCount: activeBatchRows.length,
          totalRevenue: Number(totalProfitabilityRevenue.toFixed(2)),
          totalCost: Number(totalProfitabilityCost.toFixed(2)),
          grossMargin: Number((totalProfitabilityRevenue - totalProfitabilityCost).toFixed(2)),
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch executive dashboard', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch executive dashboard',
      code: 'EXECUTIVE_DASHBOARD_FAILED',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/exceptions', authenticate, async (_req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const todayMs = new Date(today).getTime();

    const [stockRows, paymentGapRows, overduePayables, expiredContractsRows, activeBatchRows, revenueRows, overdueReceivablesRows] = await Promise.all([
      db
        .select({
          id: feedInventory.id,
          ingredientName: feedInventory.ingredientName,
          quantity: feedInventory.quantity,
          reorderLevel: feedInventory.reorderLevel,
        })
        .from(feedInventory),
      Promise.all([
        db.select({ id: supplierPayments.id, code: supplierPayments.paymentCode, date: supplierPayments.paymentDate, source: sql<string>`'supplier_payment'`, amount: supplierPayments.amount }).from(supplierPayments).where(and(sql`${supplierPayments.paymentStatus} IN ('pending', 'completed')`, sql`${supplierPayments.treasuryTransactionId} IS NULL`)),
        db.select({ id: buyerReceiptLines.id, code: buyerReceiptLines.referenceNumber, date: buyerReceipts.receiptDate, source: sql<string>`'buyer_receipt'`, amount: buyerReceiptLines.paymentAmount }).from(buyerReceiptLines).innerJoin(buyerReceipts, eq(buyerReceiptLines.receiptId, buyerReceipts.id)).where(and(eq(buyerReceiptLines.paymentStatus, 'completed'), sql`${buyerReceiptLines.treasuryTransactionId} IS NULL`)),
        db.select({ id: payroll.id, code: sql<string>`${payroll.id}::text`, date: payroll.paidDate, source: sql<string>`'payroll'`, amount: payroll.netSalary }).from(payroll).where(and(eq(payroll.status, 'paid'), sql`${payroll.treasuryTransactionId} IS NULL`)),
        db.select({ id: operationalExpenses.id, code: operationalExpenses.expenseCode, date: operationalExpenses.expenseDate, source: sql<string>`'operational_expense'`, amount: operationalExpenses.amount }).from(operationalExpenses).where(and(eq(operationalExpenses.status, 'paid'), sql`${operationalExpenses.treasuryTransactionId} IS NULL`)),
        db.select({ id: serviceWorkOrders.id, code: serviceWorkOrders.workOrderCode, date: serviceWorkOrders.serviceDate, source: sql<string>`'service_work_order'`, amount: serviceWorkOrders.totalAmount }).from(serviceWorkOrders).where(and(eq(serviceWorkOrders.status, 'paid'), sql`${serviceWorkOrders.treasuryTransactionId} IS NULL`)),
      ]),
      db
        .select({
          id: supplierInvoices.id,
          invoiceCode: supplierInvoices.invoiceCode,
          dueDate: supplierInvoices.dueDate,
          amount: supplierInvoices.invoiceAmount,
          paidAmount: sql<number>`COALESCE((
            SELECT SUM(${supplierPaymentAllocations.allocatedAmount}::numeric)
            FROM ${supplierPaymentAllocations}
            INNER JOIN ${supplierPayments} ON ${supplierPayments.id} = ${supplierPaymentAllocations.supplierPaymentId}
            WHERE ${supplierPaymentAllocations.supplierInvoiceId} = ${supplierInvoices.id}
              AND ${supplierPayments.paymentStatus} IN ('pending', 'completed')
          ), 0)::float`,
        })
        .from(supplierInvoices)
        .where(sql`${supplierInvoices.status} IN ('approved', 'recorded') AND ${supplierInvoices.dueDate} < ${today}`),
      db
        .select({
          id: supplierContracts.id,
          contractCode: supplierContracts.contractCode,
          contractTitle: supplierContracts.contractTitle,
          validTo: supplierContracts.validTo,
          status: supplierContracts.status,
        })
        .from(supplierContracts)
        .where(and(eq(supplierContracts.status, 'active'), sql`${supplierContracts.validTo} IS NOT NULL AND ${supplierContracts.validTo} < ${today}`)),
      db
        .select({
          id: batches.id,
          batchCode: batches.batchCode,
          siteId: batches.siteId,
          chicksPlaced: batches.chicksPlaced,
          placementDate: batches.placementDate,
          actualDeliveryDate: batches.actualDeliveryDate,
        })
        .from(batches)
        .where(sql`${batches.status} IN ('placement', 'growing', 'ready_for_sale')`),
      db
        .select({
          batchId: sales.batchId,
          revenue: sql<number>`COALESCE(SUM(${sales.totalAmount}::numeric), 0)::float`,
        })
        .from(sales)
        .where(sql`${sales.status} <> 'cancelled'`)
        .groupBy(sales.batchId),
      db
        .select({
          id: sales.id,
          saleCode: sales.saleCode,
          saleDate: sales.saleDate,
          buyerName: buyers.buyerName,
          totalAmount: sales.totalAmount,
          creditTerms: buyers.creditTerms,
          paidAmount: sql<number>`COALESCE((
            SELECT SUM(${buyerReceiptAllocations.allocatedAmount}::numeric)
            FROM ${buyerReceiptAllocations}
            INNER JOIN ${buyerReceiptLines} ON ${buyerReceiptLines.id} = ${buyerReceiptAllocations.receiptLineId}
            WHERE ${buyerReceiptAllocations.saleId} = ${sales.id}
              AND ${buyerReceiptLines.paymentStatus} = 'completed'
          ), 0)::float`,
        })
        .from(sales)
        .leftJoin(buyers, eq(sales.buyerId, buyers.id))
        .where(sql`${sales.status} IN ('reviewed', 'pending') AND ${sales.saleDate} < ${today}`),
    ]);

    const negativeStockRisk = stockRows
      .filter((row) => Number(row.quantity) < 0 || (row.reorderLevel != null && Number(row.quantity) <= Number(row.reorderLevel)))
      .map((row) => ({
        id: row.id,
        itemName: row.ingredientName,
        quantity: Number(row.quantity),
        reorderLevel: row.reorderLevel != null ? Number(row.reorderLevel) : null,
      }));

    const paymentWithoutTreasuryLink = paymentGapRows.flat();

    const overduePayablesList = overduePayables
      .map((row) => ({
        id: row.id,
        invoiceCode: row.invoiceCode,
        dueDate: row.dueDate,
        balanceDue: Number((Number(row.amount) - Number(row.paidAmount ?? 0)).toFixed(2)),
      }))
      .filter((row) => row.balanceDue > 0);

    const overdueReceivables = overdueReceivablesRows
      .map((row) => {
        const dueDate = new Date(String(row.saleDate));
        dueDate.setDate(dueDate.getDate() + Number(row.creditTerms ?? 0));
        return {
          id: row.id,
          saleCode: row.saleCode,
          buyerName: row.buyerName,
          dueDate: dueDate.toISOString().split('T')[0],
          balanceDue: Number((Number(row.totalAmount) - Number(row.paidAmount ?? 0)).toFixed(2)),
        };
      })
      .filter((row) => row.balanceDue > 0 && row.dueDate < today);

    const batchCostSummaries = await buildBatchCostSummaries(
      activeBatchRows.map((batch) => ({
        ...batch,
        placementDate: String(batch.placementDate),
        actualDeliveryDate: batch.actualDeliveryDate ? String(batch.actualDeliveryDate) : null,
      })),
    );
    const revenueByBatch = new Map(revenueRows.map((row) => [row.batchId, row.revenue ?? 0]));
    const missingCostComponents = activeBatchRows.map((batch) => {
      const summary = batchCostSummaries.get(batch.id);
      return {
        batchId: batch.id,
        batchCode: batch.batchCode,
        missingPlacement: !summary?.ledger.some((entry) => entry.sourceType === 'chick_placement'),
        missingFeed: (summary?.feedCost ?? 0) <= 0,
        missingLabor: (summary?.laborCost ?? 0) <= 0,
        hasRevenue: (revenueByBatch.get(batch.id) ?? 0) > 0,
      };
    }).filter((row) => row.missingPlacement || row.missingFeed || row.missingLabor);

    const chequeAgeing = await db
      .select({
        id: treasuryTransactions.id,
        referenceNumber: treasuryTransactions.referenceNumber,
        transactionDate: treasuryTransactions.transactionDate,
        status: treasuryTransactions.status,
      })
      .from(treasuryTransactions)
      .where(eq(treasuryTransactions.status, 'pending'));

    const agedCheques = chequeAgeing
      .map((row) => ({
        ...row,
        ageDays: Math.floor((todayMs - new Date(String(row.transactionDate)).getTime()) / (1000 * 60 * 60 * 24)),
      }))
      .filter((row) => row.ageDays >= 7);

    const unreconciledBalances = await db
      .select({
        financeAccountId: financeAccounts.id,
        accountName: financeAccounts.accountName,
        unclearedCount: sql<number>`COALESCE(COUNT(${treasuryTransactionEntries.id}), 0)::int`,
      })
      .from(financeAccounts)
      .leftJoin(treasuryTransactionEntries, and(eq(financeAccounts.id, treasuryTransactionEntries.financeAccountId), sql`${treasuryTransactionEntries.clearedAt} IS NULL`))
      .where(eq(financeAccounts.status, 'active'))
      .groupBy(financeAccounts.id);

    res.json({
      success: true,
      data: {
        summary: {
          negativeStockRisk: negativeStockRisk.length,
          paymentWithoutTreasuryLink: paymentWithoutTreasuryLink.length,
          chequeAgeing: agedCheques.length,
          unreconciledBalances: unreconciledBalances.filter((row) => row.unclearedCount > 0).length,
          overduePayables: overduePayablesList.length,
          overdueReceivables: overdueReceivables.length,
          expiredContracts: expiredContractsRows.length,
          missingCostComponents: missingCostComponents.length,
        },
        negativeStockRisk,
        paymentWithoutTreasuryLink,
        chequeAgeing: agedCheques,
        unreconciledBalances: unreconciledBalances.filter((row) => row.unclearedCount > 0),
        overduePayables: overduePayablesList,
        overdueReceivables,
        expiredContracts: expiredContractsRows,
        missingCostComponents,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch dashboard exceptions', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard exceptions',
      code: 'DASHBOARD_EXCEPTIONS_FAILED',
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
