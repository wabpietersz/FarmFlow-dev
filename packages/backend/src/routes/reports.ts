import { Router, type Request, type Response } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import { db } from '../db';
import {
  batches, dailyRecords, sales, payments, buyers, sites, feedInventory,
  feedProductionBatches, feedRecipes, feedDistributions,
  attendance, leaveBalances, payroll, employees,
} from '../db/schema';
import { eq, sql, and, gte, lte, desc, inArray, type SQL } from 'drizzle-orm';
import logger from '../lib/logger';

const router = Router();

// ---------------------------------------------------------------------------
// Helper: Convert array of objects to CSV string
// ---------------------------------------------------------------------------
function arrayToCsv(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers
      .map((h) => {
        const val = row[h];
        const str = val === null || val === undefined ? '' : String(val);
        // Escape double quotes and wrap in quotes if value contains comma, quote, or newline
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(','),
  );
  return [headers.join(','), ...rows].join('\n');
}

// ---------------------------------------------------------------------------
// GET /api/reports/batch-performance
// ---------------------------------------------------------------------------
router.get('/batch-performance', authenticate, requirePermission('reports:read'), async (req: Request, res: Response) => {
  try {
    const { siteId, startDate, endDate, batchId } = req.query;

    const conditions = [];
    if (siteId) {
      conditions.push(eq(batches.siteId, Number(siteId)));
    }
    if (startDate) {
      conditions.push(gte(batches.placementDate, startDate as string));
    }
    if (endDate) {
      conditions.push(lte(batches.placementDate, endDate as string));
    }
    if (batchId) {
      conditions.push(eq(batches.id, Number(batchId)));
    }

    // Fetch batches with site name
    let batchQuery = db
      .select({
        id: batches.id,
        batchCode: batches.batchCode,
        siteId: batches.siteId,
        siteName: sites.siteName,
        chicksPlaced: batches.chicksPlaced,
        placementDate: batches.placementDate,
        status: batches.status,
      })
      .from(batches)
      .leftJoin(sites, eq(batches.siteId, sites.id))
      .$dynamic();

    if (conditions.length > 0) {
      batchQuery = batchQuery.where(and(...conditions));
    }

    const batchRows = await batchQuery.orderBy(desc(batches.placementDate));

    // For each batch, aggregate daily record data
    const results = await Promise.all(
      batchRows.map(async (batch) => {
        // Aggregate mortality and feed consumption
        const [agg] = await db
          .select({
            totalMortality: sql<number>`COALESCE(sum(${dailyRecords.mortalityCount}), 0)::int`,
            totalFeedConsumed: sql<number>`COALESCE(sum(${dailyRecords.feedConsumption}::numeric), 0)::float`,
          })
          .from(dailyRecords)
          .where(eq(dailyRecords.batchId, batch.id));

        // Latest daily record for current bird count and average weight
        const [latest] = await db
          .select({
            birdCount: dailyRecords.birdCount,
            averageWeight: dailyRecords.averageWeight,
          })
          .from(dailyRecords)
          .where(eq(dailyRecords.batchId, batch.id))
          .orderBy(desc(dailyRecords.recordDate))
          .limit(1);

        const currentBirdCount = latest?.birdCount ?? batch.chicksPlaced;
        const averageWeight = latest?.averageWeight ? Number(latest.averageWeight) : 0;
        const totalMortality = agg?.totalMortality ?? 0;
        const totalFeedConsumed = agg?.totalFeedConsumed ?? 0;
        const mortalityRate = batch.chicksPlaced > 0 ? Number(((totalMortality / batch.chicksPlaced) * 100).toFixed(2)) : 0;

        // FCR = totalFeed(kg) / (avgWeight(kg) * birdCount)
        // feedConsumption is stored in kg, averageWeight in grams — convert weight to kg
        const totalWeightKg = (averageWeight / 1000) * currentBirdCount;
        const fcr = totalWeightKg > 0 ? Number((totalFeedConsumed / totalWeightKg).toFixed(3)) : 0;

        // Batch age in days
        const placementMs = new Date(batch.placementDate).getTime();
        const nowMs = Date.now();
        const batchAge = Math.floor((nowMs - placementMs) / (1000 * 60 * 60 * 24));

        return {
          batchId: batch.id,
          batchCode: batch.batchCode,
          siteId: batch.siteId,
          siteName: batch.siteName,
          chicksPlaced: batch.chicksPlaced,
          currentBirdCount,
          totalMortality,
          mortalityRate,
          totalFeedConsumed,
          averageWeight,
          fcr,
          batchAge,
          status: batch.status,
          placementDate: batch.placementDate,
        };
      }),
    );

    res.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch batch performance report', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch batch performance report', code: 'BATCH_PERFORMANCE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// ---------------------------------------------------------------------------
// GET /api/reports/sales-summary
// ---------------------------------------------------------------------------
router.get('/sales-summary', authenticate, requirePermission('reports:read'), async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, buyerId } = req.query;

    const conditions: SQL[] = [];
    if (startDate) {
      conditions.push(gte(sales.saleDate, startDate as string));
    }
    if (endDate) {
      conditions.push(lte(sales.saleDate, endDate as string));
    }
    if (buyerId) {
      conditions.push(eq(sales.buyerId, Number(buyerId)));
    }

    // Overall aggregates
    let summaryQuery = db
      .select({
        totalSales: sql<number>`count(*)::int`,
        totalRevenue: sql<number>`COALESCE(sum(${sales.totalAmount}::numeric), 0)::float`,
        totalBirds: sql<number>`COALESCE(sum(${sales.totalBirds}), 0)::int`,
      })
      .from(sales)
      .$dynamic();

    if (conditions.length > 0) {
      summaryQuery = summaryQuery.where(and(...conditions));
    }

    const [summary] = await summaryQuery;

    const totalSales = summary?.totalSales ?? 0;
    const totalRevenue = summary?.totalRevenue ?? 0;
    const totalBirds = summary?.totalBirds ?? 0;
    const averagePricePerBird = totalBirds > 0 ? Number((totalRevenue / totalBirds).toFixed(2)) : 0;

    // Total paid across matching sales
    let paidQuery = db
      .select({
        totalPaid: sql<number>`COALESCE(sum(${payments.paymentAmount}::numeric), 0)::float`,
      })
      .from(payments)
      .innerJoin(sales, eq(payments.saleId, sales.id))
      .$dynamic();

    const paidConditions = [...conditions];
    paidConditions.push(eq(payments.paymentStatus, 'completed'));
    paidQuery = paidQuery.where(and(...paidConditions));

    const [paidResult] = await paidQuery;
    const totalPaid = paidResult?.totalPaid ?? 0;
    const totalOutstanding = totalRevenue - totalPaid;

    // Breakdown by buyer
    let byBuyerQuery = db
      .select({
        buyerId: sales.buyerId,
        buyerName: buyers.buyerName,
        count: sql<number>`count(*)::int`,
        revenue: sql<number>`COALESCE(sum(${sales.totalAmount}::numeric), 0)::float`,
      })
      .from(sales)
      .leftJoin(buyers, eq(sales.buyerId, buyers.id))
      .$dynamic();

    if (conditions.length > 0) {
      byBuyerQuery = byBuyerQuery.where(and(...conditions));
    }

    const byBuyerRows = await byBuyerQuery.groupBy(sales.buyerId, buyers.buyerName);

    // For each buyer, calculate paid + outstanding
    const byBuyer = await Promise.all(
      byBuyerRows.map(async (row) => {
        const buyerSaleConditions = [...conditions];
        buyerSaleConditions.push(eq(sales.buyerId, row.buyerId));

        let buyerPaidQuery = db
          .select({
            paid: sql<number>`COALESCE(sum(${payments.paymentAmount}::numeric), 0)::float`,
          })
          .from(payments)
          .innerJoin(sales, eq(payments.saleId, sales.id))
          .$dynamic();

        const buyerPaidConditions = [...buyerSaleConditions, eq(payments.paymentStatus, 'completed')];
        buyerPaidQuery = buyerPaidQuery.where(and(...buyerPaidConditions));

        const [buyerPaid] = await buyerPaidQuery;
        const paid = buyerPaid?.paid ?? 0;

        return {
          buyerId: row.buyerId,
          buyerName: row.buyerName,
          count: row.count,
          revenue: row.revenue,
          paid,
          outstanding: row.revenue - paid,
        };
      }),
    );

    // Breakdown by month
    let byMonthQuery = db
      .select({
        month: sql<string>`to_char(${sales.saleDate}::date, 'YYYY-MM')`,
        count: sql<number>`count(*)::int`,
        revenue: sql<number>`COALESCE(sum(${sales.totalAmount}::numeric), 0)::float`,
      })
      .from(sales)
      .$dynamic();

    if (conditions.length > 0) {
      byMonthQuery = byMonthQuery.where(and(...conditions));
    }

    const byMonth = await byMonthQuery
      .groupBy(sql`to_char(${sales.saleDate}::date, 'YYYY-MM')`)
      .orderBy(sql`to_char(${sales.saleDate}::date, 'YYYY-MM')`);

    res.json({
      success: true,
      data: {
        totalSales,
        totalRevenue,
        totalBirds,
        averagePricePerBird,
        totalPaid,
        totalOutstanding,
        byBuyer,
        byMonth,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch sales summary report', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch sales summary report', code: 'SALES_SUMMARY_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// ---------------------------------------------------------------------------
// GET /api/reports/mortality-trends
// ---------------------------------------------------------------------------
router.get('/mortality-trends', authenticate, requirePermission('reports:read'), async (req: Request, res: Response) => {
  try {
    const { siteId, startDate, endDate, batchId } = req.query;

    const conditions = [];
    if (batchId) {
      conditions.push(eq(dailyRecords.batchId, Number(batchId)));
    }
    if (startDate) {
      conditions.push(gte(dailyRecords.recordDate, startDate as string));
    }
    if (endDate) {
      conditions.push(lte(dailyRecords.recordDate, endDate as string));
    }
    if (siteId) {
      conditions.push(eq(batches.siteId, Number(siteId)));
    }

    let query = db
      .select({
        date: dailyRecords.recordDate,
        totalMortality: sql<number>`COALESCE(sum(${dailyRecords.mortalityCount}), 0)::int`,
      })
      .from(dailyRecords)
      .leftJoin(batches, eq(dailyRecords.batchId, batches.id))
      .$dynamic();

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const rows = await query
      .groupBy(dailyRecords.recordDate)
      .orderBy(dailyRecords.recordDate);

    // Compute cumulative mortality
    let cumulative = 0;
    const data = rows.map((row) => {
      cumulative += row.totalMortality;
      return {
        date: row.date,
        totalMortality: row.totalMortality,
        cumulativeMortality: cumulative,
      };
    });

    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch mortality trends report', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch mortality trends report', code: 'MORTALITY_TRENDS_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// ---------------------------------------------------------------------------
// GET /api/reports/feed-consumption
// ---------------------------------------------------------------------------
router.get('/feed-consumption', authenticate, requirePermission('reports:read'), async (req: Request, res: Response) => {
  try {
    const { siteId, startDate, endDate, batchId } = req.query;

    const conditions = [];
    if (batchId) {
      conditions.push(eq(dailyRecords.batchId, Number(batchId)));
    }
    if (startDate) {
      conditions.push(gte(dailyRecords.recordDate, startDate as string));
    }
    if (endDate) {
      conditions.push(lte(dailyRecords.recordDate, endDate as string));
    }
    if (siteId) {
      conditions.push(eq(batches.siteId, Number(siteId)));
    }

    let query = db
      .select({
        date: dailyRecords.recordDate,
        totalFeedConsumed: sql<number>`COALESCE(sum(${dailyRecords.feedConsumption}::numeric), 0)::float`,
        totalBirds: sql<number>`COALESCE(sum(${dailyRecords.birdCount}), 0)::int`,
      })
      .from(dailyRecords)
      .leftJoin(batches, eq(dailyRecords.batchId, batches.id))
      .$dynamic();

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const rows = await query
      .groupBy(dailyRecords.recordDate)
      .orderBy(dailyRecords.recordDate);

    const dailyData = rows.map((row) => ({
      date: row.date,
      totalFeedConsumed: row.totalFeedConsumed,
      avgFeedPerBird: row.totalBirds > 0 ? Number((row.totalFeedConsumed / row.totalBirds).toFixed(4)) : 0,
    }));

    // Feed inventory summary
    const inventory = await db
      .select({
        id: feedInventory.id,
        ingredientName: feedInventory.ingredientName,
        quantity: feedInventory.quantity,
        unit: feedInventory.unit,
        costPerUnit: feedInventory.costPerUnit,
        reorderLevel: feedInventory.reorderLevel,
        lastRestockDate: feedInventory.lastRestockDate,
      })
      .from(feedInventory);

    const inventorySummary = inventory.map((item) => ({
      id: item.id,
      ingredientName: item.ingredientName,
      quantity: Number(item.quantity),
      unit: item.unit,
      costPerUnit: Number(item.costPerUnit),
      reorderLevel: item.reorderLevel ? Number(item.reorderLevel) : null,
      lastRestockDate: item.lastRestockDate,
      lowStock: item.reorderLevel ? Number(item.quantity) < Number(item.reorderLevel) : false,
    }));

    res.json({
      success: true,
      data: {
        daily: dailyData,
        inventory: inventorySummary,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch feed consumption report', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch feed consumption report', code: 'FEED_CONSUMPTION_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// ---------------------------------------------------------------------------
// GET /api/reports/financial-overview
// ---------------------------------------------------------------------------
router.get('/financial-overview', authenticate, requirePermission('reports:financial:read'), async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    // Default to last 30 days
    const end = endDate ? (endDate as string) : new Date().toISOString().split('T')[0];
    const start = startDate
      ? (startDate as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Total revenue from sales in range
    const [revResult] = await db
      .select({
        totalRevenue: sql<number>`COALESCE(sum(${sales.totalAmount}::numeric), 0)::float`,
      })
      .from(sales)
      .where(and(gte(sales.saleDate, start), lte(sales.saleDate, end)));

    const totalRevenue = revResult?.totalRevenue ?? 0;

    // Total paid from completed payments on sales in range
    const [paidResult] = await db
      .select({
        totalPaid: sql<number>`COALESCE(sum(${payments.paymentAmount}::numeric), 0)::float`,
      })
      .from(payments)
      .innerJoin(sales, eq(payments.saleId, sales.id))
      .where(
        and(
          gte(sales.saleDate, start),
          lte(sales.saleDate, end),
          eq(payments.paymentStatus, 'completed'),
        ),
      );

    const totalPaid = paidResult?.totalPaid ?? 0;
    const totalOutstanding = totalRevenue - totalPaid;

    // Payments by method
    const paymentsByMethod = await db
      .select({
        method: payments.paymentMethod,
        total: sql<number>`COALESCE(sum(${payments.paymentAmount}::numeric), 0)::float`,
        count: sql<number>`count(*)::int`,
      })
      .from(payments)
      .innerJoin(sales, eq(payments.saleId, sales.id))
      .where(
        and(
          gte(sales.saleDate, start),
          lte(sales.saleDate, end),
          eq(payments.paymentStatus, 'completed'),
        ),
      )
      .groupBy(payments.paymentMethod);

    // Recent transactions (last 10 payments within range)
    const recentTransactions = await db
      .select({
        paymentId: payments.id,
        saleCode: sales.saleCode,
        amount: payments.paymentAmount,
        method: payments.paymentMethod,
        date: payments.paymentDate,
        status: payments.paymentStatus,
      })
      .from(payments)
      .innerJoin(sales, eq(payments.saleId, sales.id))
      .where(and(gte(sales.saleDate, start), lte(sales.saleDate, end)))
      .orderBy(desc(payments.paymentDate))
      .limit(10);

    res.json({
      success: true,
      data: {
        totalRevenue,
        totalPaid,
        totalOutstanding,
        paymentsByMethod,
        recentTransactions,
        dateRange: { start, end },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch financial overview report', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch financial overview report', code: 'FINANCIAL_OVERVIEW_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// ---------------------------------------------------------------------------
// GET /api/reports/batch-comparison?batchIds=1,2,3
// ---------------------------------------------------------------------------
router.get('/batch-comparison', authenticate, requirePermission('reports:read'), async (req: Request, res: Response) => {
  try {
    const { batchIds: batchIdsParam } = req.query;

    if (!batchIdsParam || typeof batchIdsParam !== 'string') {
      res.status(400).json({ success: false, error: 'batchIds query parameter is required (comma-separated)', code: 'MISSING_BATCH_IDS', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    const batchIdList = batchIdsParam.split(',').map(Number).filter((n) => !isNaN(n));
    if (batchIdList.length < 2 || batchIdList.length > 4) {
      res.status(400).json({ success: false, error: 'Must provide 2-4 batch IDs', code: 'INVALID_BATCH_COUNT', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    // Fetch batch details
    const batchRows = await db
      .select({
        id: batches.id,
        batchCode: batches.batchCode,
        siteName: sites.siteName,
        chicksPlaced: batches.chicksPlaced,
      })
      .from(batches)
      .leftJoin(sites, eq(batches.siteId, sites.id))
      .where(inArray(batches.id, batchIdList));

    const results = await Promise.all(
      batchRows.map(async (batch) => {
        // Get daily records ordered by age
        const records = await db
          .select({
            currentAge: dailyRecords.currentAge,
            birdCount: dailyRecords.birdCount,
            mortalityCount: dailyRecords.mortalityCount,
            feedConsumption: dailyRecords.feedConsumption,
            averageWeight: dailyRecords.averageWeight,
          })
          .from(dailyRecords)
          .where(eq(dailyRecords.batchId, batch.id))
          .orderBy(dailyRecords.currentAge);

        let cumulativeFeed = 0;
        let cumulativeMortality = 0;
        const fcrCurve: { age: number; value: number }[] = [];
        const growthCurve: { age: number; value: number }[] = [];
        const mortalityCurve: { age: number; value: number }[] = [];
        const feedEfficiencyCurve: { age: number; value: number }[] = [];

        for (const rec of records) {
          const age = rec.currentAge ?? 0;
          const birdCount = rec.birdCount ?? batch.chicksPlaced;
          const mortality = rec.mortalityCount ?? 0;
          const feed = Number(rec.feedConsumption ?? 0);
          const avgWeight = Number(rec.averageWeight ?? 0);

          cumulativeFeed += feed;
          cumulativeMortality += mortality;

          const totalWeightKg = (avgWeight / 1000) * birdCount;
          const fcr = totalWeightKg > 0 ? Number((cumulativeFeed / totalWeightKg).toFixed(3)) : 0;
          fcrCurve.push({ age, value: fcr });
          growthCurve.push({ age, value: avgWeight });
          mortalityCurve.push({ age, value: Number(((cumulativeMortality / batch.chicksPlaced) * 100).toFixed(2)) });
          feedEfficiencyCurve.push({ age, value: birdCount > 0 ? Number((feed / birdCount).toFixed(4)) : 0 });
        }

        // Latest record for current state
        const latest = records[records.length - 1];
        const currentBirdCount = latest?.birdCount ?? batch.chicksPlaced;
        const averageWeight = Number(latest?.averageWeight ?? 0);
        const totalWeightKg = (averageWeight / 1000) * currentBirdCount;
        const fcr = totalWeightKg > 0 ? Number((cumulativeFeed / totalWeightKg).toFixed(3)) : 0;

        return {
          batchId: batch.id,
          batchCode: batch.batchCode,
          siteName: batch.siteName,
          chicksPlaced: batch.chicksPlaced,
          currentBirdCount,
          mortalityRate: batch.chicksPlaced > 0 ? Number(((cumulativeMortality / batch.chicksPlaced) * 100).toFixed(2)) : 0,
          fcr,
          totalFeedConsumed: Number(cumulativeFeed.toFixed(2)),
          averageWeight,
          curves: {
            fcr: fcrCurve,
            growth: growthCurve,
            mortality: mortalityCurve,
            feedEfficiency: feedEfficiencyCurve,
          },
        };
      }),
    );

    res.json({
      success: true,
      data: { batches: results },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch batch comparison report', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch batch comparison report', code: 'BATCH_COMPARISON_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// ---------------------------------------------------------------------------
// GET /api/reports/batch-profitability
// ---------------------------------------------------------------------------
router.get('/batch-profitability', authenticate, requirePermission('reports:financial:read'), async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, siteId } = req.query;

    const conditions: SQL[] = [];
    if (startDate) conditions.push(gte(batches.placementDate, startDate as string));
    if (endDate) conditions.push(lte(batches.placementDate, endDate as string));
    if (siteId) conditions.push(eq(batches.siteId, Number(siteId)));

    let batchQuery = db
      .select({
        id: batches.id,
        batchCode: batches.batchCode,
        siteName: sites.siteName,
        chicksPlaced: batches.chicksPlaced,
      })
      .from(batches)
      .leftJoin(sites, eq(batches.siteId, sites.id))
      .$dynamic();

    if (conditions.length > 0) {
      batchQuery = batchQuery.where(and(...conditions));
    }

    const batchRows = await batchQuery.orderBy(desc(batches.placementDate));

    // Get average feed cost per kg from inventory
    const [avgFeedCost] = await db
      .select({
        avgCost: sql<number>`COALESCE(avg(${feedInventory.costPerUnit}::numeric), 0)::float`,
      })
      .from(feedInventory);
    const feedCostPerKg = avgFeedCost?.avgCost ?? 0;

    // Get total payroll cost for period and active batch count for pro-rating
    const payrollConditions: SQL[] = [];
    if (startDate) payrollConditions.push(gte(payroll.payPeriod, startDate as string));
    if (endDate) payrollConditions.push(lte(payroll.payPeriod, endDate as string));

    let payrollQuery = db
      .select({
        totalPayroll: sql<number>`COALESCE(sum(${payroll.grossSalary}::numeric), 0)::float`,
      })
      .from(payroll)
      .$dynamic();

    if (payrollConditions.length > 0) {
      payrollQuery = payrollQuery.where(and(...payrollConditions));
    }

    const [payrollResult] = await payrollQuery;
    const totalPayrollCost = payrollResult?.totalPayroll ?? 0;
    const activeBatchCount = batchRows.length || 1;
    const laborCostPerBatch = Number((totalPayrollCost / activeBatchCount).toFixed(2));

    const batchResults = await Promise.all(
      batchRows.map(async (batch) => {
        // Revenue from sales
        const [saleAgg] = await db
          .select({
            revenue: sql<number>`COALESCE(sum(${sales.totalAmount}::numeric), 0)::float`,
            birdsSold: sql<number>`COALESCE(sum(${sales.totalBirds}), 0)::int`,
          })
          .from(sales)
          .where(eq(sales.batchId, batch.id));

        // Feed cost from daily records
        const [feedAgg] = await db
          .select({
            totalFeed: sql<number>`COALESCE(sum(${dailyRecords.feedConsumption}::numeric), 0)::float`,
          })
          .from(dailyRecords)
          .where(eq(dailyRecords.batchId, batch.id));

        const revenue = saleAgg?.revenue ?? 0;
        const birdsSold = saleAgg?.birdsSold ?? 0;
        const feedCost = Number(((feedAgg?.totalFeed ?? 0) * feedCostPerKg).toFixed(2));
        const laborCost = laborCostPerBatch;
        const totalCost = feedCost + laborCost;
        const grossMargin = revenue - totalCost;
        const profitMargin = revenue > 0 ? Number(((grossMargin / revenue) * 100).toFixed(2)) : 0;
        const costPerBird = batch.chicksPlaced > 0 ? Number((totalCost / batch.chicksPlaced).toFixed(2)) : 0;

        return {
          batchId: batch.id,
          batchCode: batch.batchCode,
          siteName: batch.siteName,
          chicksPlaced: batch.chicksPlaced,
          birdsSold,
          revenue,
          feedCost,
          laborCost,
          totalCost,
          grossMargin,
          profitMargin,
          costPerBird,
        };
      }),
    );

    const totals = {
      totalRevenue: Number(batchResults.reduce((s, b) => s + b.revenue, 0).toFixed(2)),
      totalFeedCost: Number(batchResults.reduce((s, b) => s + b.feedCost, 0).toFixed(2)),
      totalLaborCost: Number(batchResults.reduce((s, b) => s + b.laborCost, 0).toFixed(2)),
      totalGrossMargin: Number(batchResults.reduce((s, b) => s + b.grossMargin, 0).toFixed(2)),
      averageProfitMargin: batchResults.length > 0
        ? Number((batchResults.reduce((s, b) => s + b.profitMargin, 0) / batchResults.length).toFixed(2))
        : 0,
    };

    res.json({
      success: true,
      data: { batches: batchResults, totals },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch batch profitability report', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch batch profitability report', code: 'BATCH_PROFITABILITY_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// ---------------------------------------------------------------------------
// GET /api/reports/hr-analytics
// ---------------------------------------------------------------------------
router.get('/hr-analytics', authenticate, requirePermission('reports:read'), async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const attendanceConditions: SQL[] = [];
    if (startDate) attendanceConditions.push(gte(attendance.attendanceDate, startDate as string));
    if (endDate) attendanceConditions.push(lte(attendance.attendanceDate, endDate as string));

    // --- Attendance rate by month ---
    let attendanceByMonthQuery = db
      .select({
        month: sql<string>`to_char(${attendance.attendanceDate}::date, 'YYYY-MM')`,
        presentCount: sql<number>`count(*) FILTER (WHERE ${attendance.status} IN ('present', 'half_day'))::int`,
        totalCount: sql<number>`count(*)::int`,
      })
      .from(attendance)
      .$dynamic();

    if (attendanceConditions.length > 0) {
      attendanceByMonthQuery = attendanceByMonthQuery.where(and(...attendanceConditions));
    }

    const attendanceByMonthRows = await attendanceByMonthQuery
      .groupBy(sql`to_char(${attendance.attendanceDate}::date, 'YYYY-MM')`)
      .orderBy(sql`to_char(${attendance.attendanceDate}::date, 'YYYY-MM')`);

    const attendanceByMonth = attendanceByMonthRows.map((r) => ({
      month: r.month,
      presentCount: r.presentCount,
      totalCount: r.totalCount,
      rate: r.totalCount > 0 ? Number(((r.presentCount / r.totalCount) * 100).toFixed(1)) : 0,
    }));

    // --- Attendance by employee ---
    let attendanceByEmpQuery = db
      .select({
        employeeId: attendance.employeeId,
        name: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
        presentDays: sql<number>`count(*) FILTER (WHERE ${attendance.status} IN ('present', 'half_day'))::int`,
        totalDays: sql<number>`count(*)::int`,
      })
      .from(attendance)
      .innerJoin(employees, eq(attendance.employeeId, employees.id))
      .$dynamic();

    if (attendanceConditions.length > 0) {
      attendanceByEmpQuery = attendanceByEmpQuery.where(and(...attendanceConditions));
    }

    const attendanceByEmpRows = await attendanceByEmpQuery
      .groupBy(attendance.employeeId, employees.firstName, employees.lastName)
      .orderBy(sql`count(*) FILTER (WHERE ${attendance.status} IN ('present', 'half_day'))::int`);

    const attendanceByEmployee = attendanceByEmpRows.map((r) => ({
      employeeId: r.employeeId,
      name: r.name,
      presentDays: r.presentDays,
      totalDays: r.totalDays,
      rate: r.totalDays > 0 ? Number(((r.presentDays / r.totalDays) * 100).toFixed(1)) : 0,
    }));

    // --- Leave utilization ---
    const currentYear = new Date().getFullYear();
    const leaveRows = await db
      .select({
        leaveType: leaveBalances.leaveType,
        totalAllocated: sql<number>`COALESCE(sum(${leaveBalances.totalDays}), 0)::int`,
        totalUsed: sql<number>`COALESCE(sum(${leaveBalances.usedDays}), 0)::int`,
      })
      .from(leaveBalances)
      .where(eq(leaveBalances.year, currentYear))
      .groupBy(leaveBalances.leaveType);

    const leaveUtilization = leaveRows.map((r) => ({
      leaveType: r.leaveType,
      totalAllocated: r.totalAllocated,
      totalUsed: r.totalUsed,
      utilizationRate: r.totalAllocated > 0 ? Number(((r.totalUsed / r.totalAllocated) * 100).toFixed(1)) : 0,
    }));

    // --- Payroll cost trends by month ---
    const payrollConditions: SQL[] = [];
    if (startDate) payrollConditions.push(gte(payroll.payPeriod, startDate as string));
    if (endDate) payrollConditions.push(lte(payroll.payPeriod, endDate as string));

    let payrollByMonthQuery = db
      .select({
        month: sql<string>`to_char(${payroll.payPeriod}::date, 'YYYY-MM')`,
        grossTotal: sql<number>`COALESCE(sum(${payroll.grossSalary}::numeric), 0)::float`,
        netTotal: sql<number>`COALESCE(sum(${payroll.netSalary}::numeric), 0)::float`,
        employeeCount: sql<number>`count(DISTINCT ${payroll.employeeId})::int`,
      })
      .from(payroll)
      .$dynamic();

    if (payrollConditions.length > 0) {
      payrollByMonthQuery = payrollByMonthQuery.where(and(...payrollConditions));
    }

    const payrollByMonth = await payrollByMonthQuery
      .groupBy(sql`to_char(${payroll.payPeriod}::date, 'YYYY-MM')`)
      .orderBy(sql`to_char(${payroll.payPeriod}::date, 'YYYY-MM')`);

    // --- Overtime analysis by month ---
    let overtimeQuery = db
      .select({
        month: sql<string>`to_char(${payroll.payPeriod}::date, 'YYYY-MM')`,
        totalHours: sql<number>`COALESCE(sum(${payroll.overtimeHours}::numeric), 0)::float`,
        avgRate: sql<number>`COALESCE(avg(${payroll.overtimeRate}::numeric), 0)::float`,
      })
      .from(payroll)
      .$dynamic();

    if (payrollConditions.length > 0) {
      overtimeQuery = overtimeQuery.where(and(...payrollConditions));
    }

    const overtimeRows = await overtimeQuery
      .groupBy(sql`to_char(${payroll.payPeriod}::date, 'YYYY-MM')`)
      .orderBy(sql`to_char(${payroll.payPeriod}::date, 'YYYY-MM')`);

    const overtimeByMonth = overtimeRows.map((r) => ({
      month: r.month,
      totalHours: Number(r.totalHours.toFixed(1)),
      avgRate: Number(r.avgRate.toFixed(2)),
      totalCost: Number((r.totalHours * r.avgRate).toFixed(2)),
    }));

    res.json({
      success: true,
      data: {
        attendanceByMonth,
        attendanceByEmployee,
        leaveUtilization,
        payrollByMonth,
        overtimeByMonth,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch HR analytics report', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch HR analytics report', code: 'HR_ANALYTICS_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// ---------------------------------------------------------------------------
// GET /api/reports/feed-analytics
// ---------------------------------------------------------------------------
router.get('/feed-analytics', authenticate, requirePermission('reports:read'), async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    // --- FCR trend by batch ---
    const batchConditions: SQL[] = [];
    if (startDate) batchConditions.push(gte(batches.placementDate, startDate as string));
    if (endDate) batchConditions.push(lte(batches.placementDate, endDate as string));

    let fcrBatchQuery = db
      .select({
        id: batches.id,
        batchCode: batches.batchCode,
        placementDate: batches.placementDate,
        chicksPlaced: batches.chicksPlaced,
      })
      .from(batches)
      .$dynamic();

    if (batchConditions.length > 0) {
      fcrBatchQuery = fcrBatchQuery.where(and(...batchConditions));
    }

    const fcrBatches = await fcrBatchQuery.orderBy(batches.placementDate);

    const fcrByBatch = await Promise.all(
      fcrBatches.map(async (batch) => {
        const [agg] = await db
          .select({
            totalFeed: sql<number>`COALESCE(sum(${dailyRecords.feedConsumption}::numeric), 0)::float`,
          })
          .from(dailyRecords)
          .where(eq(dailyRecords.batchId, batch.id));

        const [latest] = await db
          .select({
            birdCount: dailyRecords.birdCount,
            averageWeight: dailyRecords.averageWeight,
          })
          .from(dailyRecords)
          .where(eq(dailyRecords.batchId, batch.id))
          .orderBy(desc(dailyRecords.recordDate))
          .limit(1);

        const avgWeight = Number(latest?.averageWeight ?? 0);
        const birdCount = latest?.birdCount ?? batch.chicksPlaced;
        const totalWeightKg = (avgWeight / 1000) * birdCount;
        const fcr = totalWeightKg > 0 ? Number(((agg?.totalFeed ?? 0) / totalWeightKg).toFixed(3)) : 0;

        return {
          batchCode: batch.batchCode,
          placementDate: batch.placementDate,
          fcr,
        };
      }),
    );

    // --- Feed cost per bird by batch ---
    const [avgFeedCost] = await db
      .select({
        avgCost: sql<number>`COALESCE(avg(${feedInventory.costPerUnit}::numeric), 0)::float`,
      })
      .from(feedInventory);
    const feedCostPerKg = avgFeedCost?.avgCost ?? 0;

    const feedCostPerBird = await Promise.all(
      fcrBatches.map(async (batch) => {
        const [agg] = await db
          .select({
            totalFeed: sql<number>`COALESCE(sum(${dailyRecords.feedConsumption}::numeric), 0)::float`,
          })
          .from(dailyRecords)
          .where(eq(dailyRecords.batchId, batch.id));

        const totalFeedCost = (agg?.totalFeed ?? 0) * feedCostPerKg;
        const costPerBird = batch.chicksPlaced > 0 ? Number((totalFeedCost / batch.chicksPlaced).toFixed(2)) : 0;

        return {
          batchCode: batch.batchCode,
          costPerBird,
          totalFeedCost: Number(totalFeedCost.toFixed(2)),
        };
      }),
    );

    // --- Inventory turnover ---
    const inventoryItems = await db
      .select({
        id: feedInventory.id,
        ingredientName: feedInventory.ingredientName,
        quantity: feedInventory.quantity,
        reorderLevel: feedInventory.reorderLevel,
        costPerUnit: feedInventory.costPerUnit,
      })
      .from(feedInventory);

    const inventoryTurnover = await Promise.all(
      inventoryItems.map(async (item) => {
        // Total distributed from production materials
        const distConditions: SQL[] = [eq(feedDistributions.productionBatchId, item.id)];
        // Actually, distribution is by farm batch, not inventory item.
        // Use a simpler approach: total feed consumption across all batches
        const currentStock = Number(item.quantity);
        const reorderLevel = item.reorderLevel ? Number(item.reorderLevel) : null;

        // Estimate days until reorder based on avg daily usage
        // We'll use a simplified calc
        const daysUntilReorder = reorderLevel && currentStock > reorderLevel
          ? null // not low stock
          : reorderLevel
            ? 0  // already low
            : null;

        return {
          ingredientName: item.ingredientName,
          currentStock,
          totalDistributed: 0, // simplified - would need material tracking
          turnoverRate: 0,
          daysUntilReorder,
        };
      }),
    );

    // --- Production efficiency ---
    const prodConditions: SQL[] = [eq(feedProductionBatches.status, 'completed')];
    if (startDate) prodConditions.push(gte(feedProductionBatches.productionDate, startDate as string));
    if (endDate) prodConditions.push(lte(feedProductionBatches.productionDate, endDate as string));

    const prodRows = await db
      .select({
        productionCode: feedProductionBatches.productionCode,
        plannedQty: feedProductionBatches.plannedQuantity,
        actualQty: feedProductionBatches.actualQuantity,
        productionDate: feedProductionBatches.productionDate,
      })
      .from(feedProductionBatches)
      .where(and(...prodConditions))
      .orderBy(feedProductionBatches.productionDate);

    const productionEfficiency = prodRows.map((r) => {
      const planned = Number(r.plannedQty);
      const actual = Number(r.actualQty ?? 0);
      return {
        productionCode: r.productionCode,
        plannedQty: planned,
        actualQty: actual,
        efficiency: planned > 0 ? Number(((actual / planned) * 100).toFixed(1)) : 0,
        productionDate: r.productionDate,
      };
    });

    res.json({
      success: true,
      data: {
        fcrByBatch,
        feedCostPerBird,
        inventoryTurnover,
        productionEfficiency,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch feed analytics report', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch feed analytics report', code: 'FEED_ANALYTICS_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// ---------------------------------------------------------------------------
// GET /api/reports/export/csv
// ---------------------------------------------------------------------------
router.get('/export/csv', authenticate, requirePermission('reports:read'), async (req: Request, res: Response) => {
  try {
    const { reportType, siteId, startDate, endDate, batchId, buyerId } = req.query;

    if (!reportType) {
      res.status(400).json({ success: false, error: 'reportType query parameter is required', code: 'MISSING_REPORT_TYPE', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    let csvData: Record<string, unknown>[] = [];
    let filename = 'report.csv';

    switch (reportType) {
      case 'batch-performance': {
        // Reuse batch-performance logic
        const conditions = [];
        if (siteId) conditions.push(eq(batches.siteId, Number(siteId)));
        if (startDate) conditions.push(gte(batches.placementDate, startDate as string));
        if (endDate) conditions.push(lte(batches.placementDate, endDate as string));
        if (batchId) conditions.push(eq(batches.id, Number(batchId)));

        let batchQuery = db
          .select({
            id: batches.id,
            batchCode: batches.batchCode,
            siteName: sites.siteName,
            chicksPlaced: batches.chicksPlaced,
            placementDate: batches.placementDate,
            status: batches.status,
          })
          .from(batches)
          .leftJoin(sites, eq(batches.siteId, sites.id))
          .$dynamic();

        if (conditions.length > 0) {
          batchQuery = batchQuery.where(and(...conditions));
        }

        const batchRows = await batchQuery.orderBy(desc(batches.placementDate));

        csvData = await Promise.all(
          batchRows.map(async (batch) => {
            const [agg] = await db
              .select({
                totalMortality: sql<number>`COALESCE(sum(${dailyRecords.mortalityCount}), 0)::int`,
                totalFeedConsumed: sql<number>`COALESCE(sum(${dailyRecords.feedConsumption}::numeric), 0)::float`,
              })
              .from(dailyRecords)
              .where(eq(dailyRecords.batchId, batch.id));

            const [latest] = await db
              .select({
                birdCount: dailyRecords.birdCount,
                averageWeight: dailyRecords.averageWeight,
              })
              .from(dailyRecords)
              .where(eq(dailyRecords.batchId, batch.id))
              .orderBy(desc(dailyRecords.recordDate))
              .limit(1);

            const currentBirdCount = latest?.birdCount ?? batch.chicksPlaced;
            const averageWeight = latest?.averageWeight ? Number(latest.averageWeight) : 0;
            const totalMortality = agg?.totalMortality ?? 0;
            const totalFeedConsumed = agg?.totalFeedConsumed ?? 0;
            const mortalityRate = batch.chicksPlaced > 0 ? Number(((totalMortality / batch.chicksPlaced) * 100).toFixed(2)) : 0;
            const totalWeightKg = (averageWeight / 1000) * currentBirdCount;
            const fcr = totalWeightKg > 0 ? Number((totalFeedConsumed / totalWeightKg).toFixed(3)) : 0;
            const placementMs = new Date(batch.placementDate).getTime();
            const batchAge = Math.floor((Date.now() - placementMs) / (1000 * 60 * 60 * 24));

            return {
              batchCode: batch.batchCode,
              siteName: batch.siteName,
              chicksPlaced: batch.chicksPlaced,
              currentBirdCount,
              totalMortality,
              mortalityRate,
              totalFeedConsumed,
              averageWeight,
              fcr,
              batchAge,
              status: batch.status,
              placementDate: batch.placementDate,
            };
          }),
        );

        filename = `batch-performance-${new Date().toISOString().split('T')[0]}.csv`;
        break;
      }

      case 'sales-summary': {
        const conditions = [];
        if (startDate) conditions.push(gte(sales.saleDate, startDate as string));
        if (endDate) conditions.push(lte(sales.saleDate, endDate as string));
        if (buyerId) conditions.push(eq(sales.buyerId, Number(buyerId)));

        let salesQuery = db
          .select({
            saleCode: sales.saleCode,
            buyerName: buyers.buyerName,
            saleDate: sales.saleDate,
            totalBirds: sales.totalBirds,
            totalWeight: sales.totalWeight,
            pricePerKg: sales.pricePerKg,
            totalAmount: sales.totalAmount,
            status: sales.status,
          })
          .from(sales)
          .leftJoin(buyers, eq(sales.buyerId, buyers.id))
          .$dynamic();

        if (conditions.length > 0) {
          salesQuery = salesQuery.where(and(...conditions));
        }

        const salesRows = await salesQuery.orderBy(desc(sales.saleDate));

        csvData = salesRows.map((row) => ({
          saleCode: row.saleCode,
          buyerName: row.buyerName,
          saleDate: row.saleDate,
          totalBirds: row.totalBirds,
          totalWeight: row.totalWeight,
          pricePerKg: row.pricePerKg,
          totalAmount: row.totalAmount,
          status: row.status,
        }));

        filename = `sales-summary-${new Date().toISOString().split('T')[0]}.csv`;
        break;
      }

      case 'mortality-trends': {
        const conditions = [];
        if (batchId) conditions.push(eq(dailyRecords.batchId, Number(batchId)));
        if (startDate) conditions.push(gte(dailyRecords.recordDate, startDate as string));
        if (endDate) conditions.push(lte(dailyRecords.recordDate, endDate as string));
        if (siteId) conditions.push(eq(batches.siteId, Number(siteId)));

        let query = db
          .select({
            date: dailyRecords.recordDate,
            totalMortality: sql<number>`COALESCE(sum(${dailyRecords.mortalityCount}), 0)::int`,
          })
          .from(dailyRecords)
          .leftJoin(batches, eq(dailyRecords.batchId, batches.id))
          .$dynamic();

        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }

        const rows = await query
          .groupBy(dailyRecords.recordDate)
          .orderBy(dailyRecords.recordDate);

        let cumulative = 0;
        csvData = rows.map((row) => {
          cumulative += row.totalMortality;
          return {
            date: row.date,
            totalMortality: row.totalMortality,
            cumulativeMortality: cumulative,
          };
        });

        filename = `mortality-trends-${new Date().toISOString().split('T')[0]}.csv`;
        break;
      }

      case 'feed-consumption': {
        const conditions = [];
        if (batchId) conditions.push(eq(dailyRecords.batchId, Number(batchId)));
        if (startDate) conditions.push(gte(dailyRecords.recordDate, startDate as string));
        if (endDate) conditions.push(lte(dailyRecords.recordDate, endDate as string));
        if (siteId) conditions.push(eq(batches.siteId, Number(siteId)));

        let query = db
          .select({
            date: dailyRecords.recordDate,
            totalFeedConsumed: sql<number>`COALESCE(sum(${dailyRecords.feedConsumption}::numeric), 0)::float`,
            totalBirds: sql<number>`COALESCE(sum(${dailyRecords.birdCount}), 0)::int`,
          })
          .from(dailyRecords)
          .leftJoin(batches, eq(dailyRecords.batchId, batches.id))
          .$dynamic();

        if (conditions.length > 0) {
          query = query.where(and(...conditions));
        }

        const rows = await query
          .groupBy(dailyRecords.recordDate)
          .orderBy(dailyRecords.recordDate);

        csvData = rows.map((row) => ({
          date: row.date,
          totalFeedConsumed: row.totalFeedConsumed,
          avgFeedPerBird: row.totalBirds > 0 ? Number((row.totalFeedConsumed / row.totalBirds).toFixed(4)) : 0,
        }));

        filename = `feed-consumption-${new Date().toISOString().split('T')[0]}.csv`;
        break;
      }

      case 'batch-comparison': {
        const batchIdsStr = req.query.batchIds as string;
        if (!batchIdsStr) {
          res.status(400).json({ success: false, error: 'batchIds required for batch-comparison export', code: 'MISSING_BATCH_IDS', statusCode: 400, timestamp: new Date().toISOString() });
          return;
        }
        const compareIds = batchIdsStr.split(',').map(Number).filter((n) => !isNaN(n));
        const compareBatches = await db
          .select({ id: batches.id, batchCode: batches.batchCode, siteName: sites.siteName, chicksPlaced: batches.chicksPlaced })
          .from(batches)
          .leftJoin(sites, eq(batches.siteId, sites.id))
          .where(inArray(batches.id, compareIds));

        csvData = await Promise.all(
          compareBatches.map(async (batch) => {
            const [agg] = await db
              .select({
                totalMortality: sql<number>`COALESCE(sum(${dailyRecords.mortalityCount}), 0)::int`,
                totalFeed: sql<number>`COALESCE(sum(${dailyRecords.feedConsumption}::numeric), 0)::float`,
              })
              .from(dailyRecords)
              .where(eq(dailyRecords.batchId, batch.id));

            const [latest] = await db
              .select({ birdCount: dailyRecords.birdCount, averageWeight: dailyRecords.averageWeight })
              .from(dailyRecords)
              .where(eq(dailyRecords.batchId, batch.id))
              .orderBy(desc(dailyRecords.recordDate))
              .limit(1);

            const birdCount = latest?.birdCount ?? batch.chicksPlaced;
            const avgWeight = Number(latest?.averageWeight ?? 0);
            const totalWeightKg = (avgWeight / 1000) * birdCount;
            return {
              batchCode: batch.batchCode,
              siteName: batch.siteName,
              chicksPlaced: batch.chicksPlaced,
              currentBirdCount: birdCount,
              mortalityRate: batch.chicksPlaced > 0 ? ((agg?.totalMortality ?? 0) / batch.chicksPlaced * 100).toFixed(2) : '0',
              fcr: totalWeightKg > 0 ? ((agg?.totalFeed ?? 0) / totalWeightKg).toFixed(3) : '0',
              totalFeedConsumed: (agg?.totalFeed ?? 0).toFixed(2),
              averageWeight: avgWeight,
            };
          }),
        );
        filename = `batch-comparison-${new Date().toISOString().split('T')[0]}.csv`;
        break;
      }

      case 'batch-profitability': {
        const profConditions: SQL[] = [];
        if (startDate) profConditions.push(gte(batches.placementDate, startDate as string));
        if (endDate) profConditions.push(lte(batches.placementDate, endDate as string));
        if (siteId) profConditions.push(eq(batches.siteId, Number(siteId)));

        let profBatchQuery = db
          .select({ id: batches.id, batchCode: batches.batchCode, siteName: sites.siteName, chicksPlaced: batches.chicksPlaced })
          .from(batches).leftJoin(sites, eq(batches.siteId, sites.id)).$dynamic();
        if (profConditions.length > 0) profBatchQuery = profBatchQuery.where(and(...profConditions));
        const profBatches = await profBatchQuery;

        const [avgCost] = await db.select({ avgCost: sql<number>`COALESCE(avg(${feedInventory.costPerUnit}::numeric), 0)::float` }).from(feedInventory);
        const costPerKg = avgCost?.avgCost ?? 0;

        csvData = await Promise.all(
          profBatches.map(async (batch) => {
            const [saleAgg] = await db.select({ revenue: sql<number>`COALESCE(sum(${sales.totalAmount}::numeric), 0)::float`, birdsSold: sql<number>`COALESCE(sum(${sales.totalBirds}), 0)::int` }).from(sales).where(eq(sales.batchId, batch.id));
            const [feedAgg] = await db.select({ totalFeed: sql<number>`COALESCE(sum(${dailyRecords.feedConsumption}::numeric), 0)::float` }).from(dailyRecords).where(eq(dailyRecords.batchId, batch.id));
            const revenue = saleAgg?.revenue ?? 0;
            const feedCostVal = (feedAgg?.totalFeed ?? 0) * costPerKg;
            const grossMargin = revenue - feedCostVal;
            return {
              batchCode: batch.batchCode, siteName: batch.siteName, chicksPlaced: batch.chicksPlaced,
              birdsSold: saleAgg?.birdsSold ?? 0, revenue: revenue.toFixed(2),
              feedCost: feedCostVal.toFixed(2), grossMargin: grossMargin.toFixed(2),
              profitMargin: revenue > 0 ? ((grossMargin / revenue) * 100).toFixed(2) : '0',
            };
          }),
        );
        filename = `batch-profitability-${new Date().toISOString().split('T')[0]}.csv`;
        break;
      }

      case 'hr-analytics': {
        const hrConditions: SQL[] = [];
        if (startDate) hrConditions.push(gte(attendance.attendanceDate, startDate as string));
        if (endDate) hrConditions.push(lte(attendance.attendanceDate, endDate as string));

        let hrQuery = db
          .select({
            employeeId: attendance.employeeId,
            name: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
            presentDays: sql<number>`count(*) FILTER (WHERE ${attendance.status} IN ('present', 'half_day'))::int`,
            totalDays: sql<number>`count(*)::int`,
          })
          .from(attendance)
          .innerJoin(employees, eq(attendance.employeeId, employees.id))
          .$dynamic();

        if (hrConditions.length > 0) hrQuery = hrQuery.where(and(...hrConditions));
        const hrRows = await hrQuery.groupBy(attendance.employeeId, employees.firstName, employees.lastName);

        csvData = hrRows.map((r) => ({
          employeeId: r.employeeId,
          name: r.name,
          presentDays: r.presentDays,
          totalDays: r.totalDays,
          attendanceRate: r.totalDays > 0 ? ((r.presentDays / r.totalDays) * 100).toFixed(1) : '0',
        }));
        filename = `hr-analytics-${new Date().toISOString().split('T')[0]}.csv`;
        break;
      }

      case 'feed-analytics': {
        const faConditions: SQL[] = [];
        if (startDate) faConditions.push(gte(batches.placementDate, startDate as string));
        if (endDate) faConditions.push(lte(batches.placementDate, endDate as string));

        let faBatchQuery = db
          .select({ id: batches.id, batchCode: batches.batchCode, chicksPlaced: batches.chicksPlaced, placementDate: batches.placementDate })
          .from(batches).$dynamic();
        if (faConditions.length > 0) faBatchQuery = faBatchQuery.where(and(...faConditions));
        const faBatches = await faBatchQuery.orderBy(batches.placementDate);

        const [faAvgCost] = await db.select({ avgCost: sql<number>`COALESCE(avg(${feedInventory.costPerUnit}::numeric), 0)::float` }).from(feedInventory);
        const faCostPerKg = faAvgCost?.avgCost ?? 0;

        csvData = await Promise.all(
          faBatches.map(async (batch) => {
            const [agg] = await db.select({ totalFeed: sql<number>`COALESCE(sum(${dailyRecords.feedConsumption}::numeric), 0)::float` }).from(dailyRecords).where(eq(dailyRecords.batchId, batch.id));
            const [latest] = await db.select({ birdCount: dailyRecords.birdCount, averageWeight: dailyRecords.averageWeight }).from(dailyRecords).where(eq(dailyRecords.batchId, batch.id)).orderBy(desc(dailyRecords.recordDate)).limit(1);
            const avgWeight = Number(latest?.averageWeight ?? 0);
            const birdCount = latest?.birdCount ?? batch.chicksPlaced;
            const totalWeightKg = (avgWeight / 1000) * birdCount;
            const totalFeedCost = (agg?.totalFeed ?? 0) * faCostPerKg;
            return {
              batchCode: batch.batchCode, placementDate: batch.placementDate,
              fcr: totalWeightKg > 0 ? ((agg?.totalFeed ?? 0) / totalWeightKg).toFixed(3) : '0',
              feedCostPerBird: batch.chicksPlaced > 0 ? (totalFeedCost / batch.chicksPlaced).toFixed(2) : '0',
              totalFeedCost: totalFeedCost.toFixed(2),
            };
          }),
        );
        filename = `feed-analytics-${new Date().toISOString().split('T')[0]}.csv`;
        break;
      }

      default:
        res.status(400).json({ success: false, error: `Invalid reportType: ${reportType}. Must be one of: batch-performance, sales-summary, mortality-trends, feed-consumption, batch-comparison, batch-profitability, hr-analytics, feed-analytics`, code: 'INVALID_REPORT_TYPE', statusCode: 400, timestamp: new Date().toISOString() });
        return;
    }

    const csvString = arrayToCsv(csvData);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvString);
  } catch (error) {
    logger.error('Failed to export CSV report', { error });
    res.status(500).json({ success: false, error: 'Failed to export CSV report', code: 'CSV_EXPORT_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

export default router;
