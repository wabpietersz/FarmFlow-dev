import { Router, type Request, type Response } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import { db } from '../db';
import { batches, dailyRecords, sales, payments, buyers, sites, feedInventory } from '../db/schema';
import { eq, sql, and, gte, lte, desc, type SQL } from 'drizzle-orm';
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
            pricePerBird: sales.pricePerBird,
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
          pricePerBird: row.pricePerBird,
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

      default:
        res.status(400).json({ success: false, error: `Invalid reportType: ${reportType}. Must be one of: batch-performance, sales-summary, mortality-trends, feed-consumption`, code: 'INVALID_REPORT_TYPE', statusCode: 400, timestamp: new Date().toISOString() });
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
