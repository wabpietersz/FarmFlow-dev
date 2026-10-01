import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  batchCloseSnapshots,
  batches,
  chickPlacements,
  dailyRecords,
  feedDistributions,
  sales,
} from '../db/schema';
import { buildCostingModel, roundCurrency, type BatchCostSummary, type CostingModel } from './costing';
import { toIsoDate } from './bird-days';
import { startTurnaroundForBatch } from './farm-ops';

export type { BatchCostLedgerEntry, BatchCostSummary } from './costing';

type BatchRow = { id: number };

export interface BatchKpis {
  birdsPlaced: number;
  deaths: number;
  birdsSold: number;
  liveBirds: number;
  kgSold: number;
  feedKg: number;
  revenue: number;
  ageDays: number;
  averageWeightKg: number | null;
  livabilityPct: number | null;
  mortalityPct: number | null;
  fcr: number | null;
  epef: number | null;
  totalCost: number;
  costPerBirdSold: number | null;
  costPerKg: number | null;
  profit: number;
  profitPerBird: number | null;
  marginPct: number | null;
}

export interface BatchPerformance {
  batchId: number;
  status: string;
  closed: boolean;
  closedAt?: string | null;
  kpis: BatchKpis;
  costs: BatchCostSummary;
  /** For a closed batch: costs recorded after it was closed (live total − frozen total). */
  lateCosts: number;
}

/**
 * Cost summaries for the given batches. A closed batch returns its frozen close-out figures;
 * everything else is computed live from the costing model.
 */
export async function buildBatchCostSummaries(batchRows: BatchRow[], model?: CostingModel): Promise<Map<number, BatchCostSummary>> {
  const result = new Map<number, BatchCostSummary>();
  if (batchRows.length === 0) return result;
  const costing = model ?? await buildCostingModel();
  const ids = batchRows.map((batch) => batch.id);
  const snapshots = await db
    .select({ batchId: batchCloseSnapshots.batchId, costs: batchCloseSnapshots.costs })
    .from(batchCloseSnapshots)
    .where(inArray(batchCloseSnapshots.batchId, ids));
  const frozen = new Map(snapshots.map((snap) => [snap.batchId, snap.costs as BatchCostSummary]));

  for (const id of ids) {
    const summary = frozen.get(id) ?? costing.summaries.get(id);
    if (summary) result.set(id, summary);
  }
  return result;
}

export async function buildSingleBatchCostSummary(batchId: number) {
  const summaries = await buildBatchCostSummaries([{ id: batchId }]);
  return summaries.get(batchId) ?? null;
}

async function computeKpis(batchId: number, costs: BatchCostSummary, asOf: string): Promise<BatchKpis & { lastSaleDate: string | null }> {
  const [batch] = await db.select().from(batches).where(eq(batches.id, batchId)).limit(1);
  const [placement] = await db
    .select({ accepted: sql<number>`COALESCE(SUM(${chickPlacements.acceptedQuantity}), 0)::int`, count: sql<number>`count(*)::int` })
    .from(chickPlacements)
    .where(eq(chickPlacements.batchId, batchId));
  const [mortality] = await db
    .select({ deaths: sql<number>`COALESCE(SUM(${dailyRecords.mortalityCount}), 0)::int` })
    .from(dailyRecords)
    .where(eq(dailyRecords.batchId, batchId));
  const [sold] = await db
    .select({
      birds: sql<number>`COALESCE(SUM(${sales.totalBirds}), 0)::int`,
      kg: sql<number>`COALESCE(SUM(${sales.totalWeight}::numeric), 0)::float`,
      revenue: sql<number>`COALESCE(SUM(${sales.totalAmount}::numeric), 0)::float`,
      lastSale: sql<string | null>`MAX(${sales.saleDate})::text`,
    })
    .from(sales)
    .where(sql`${sales.batchId} = ${batchId} AND ${sales.status} <> 'cancelled'`);
  const [feed] = await db
    .select({ kg: sql<number>`COALESCE(SUM(${feedDistributions.quantity}::numeric), 0)::float` })
    .from(feedDistributions)
    .where(eq(feedDistributions.farmBatchId, batchId));
  const [eaten] = await db
    .select({ kg: sql<number>`COALESCE(SUM(${dailyRecords.feedConsumption}::numeric), 0)::float` })
    .from(dailyRecords)
    .where(eq(dailyRecords.batchId, batchId));

  const birdsPlaced = (placement?.count ?? 0) > 0 ? placement.accepted : batch.chicksPlaced;
  const deaths = mortality?.deaths ?? 0;
  const birdsSold = sold?.birds ?? 0;
  const kgSold = roundCurrency(sold?.kg ?? 0);
  const revenue = roundCurrency(sold?.revenue ?? 0);
  // FCR uses feed the birds ate (daily logs); if nobody logged feed, fall back to feed delivered to the batch.
  const feedKg = roundCurrency((eaten?.kg ?? 0) > 0 ? eaten.kg : feed?.kg ?? 0);
  const lastSaleDate = sold?.lastSale ?? null;
  const endDate = lastSaleDate ?? asOf;
  const ageDays = Math.max(0, Math.round((new Date(endDate).getTime() - new Date(toIsoDate(batch.placementDate)).getTime()) / 86_400_000));

  const averageWeightKg = birdsSold > 0 ? kgSold / birdsSold : null;
  const livabilityPct = birdsPlaced > 0 ? ((birdsPlaced - deaths) / birdsPlaced) * 100 : null;
  const mortalityPct = birdsPlaced > 0 ? (deaths / birdsPlaced) * 100 : null;
  const fcr = kgSold > 0 && feedKg > 0 ? feedKg / kgSold : null;
  const epef = livabilityPct != null && averageWeightKg != null && fcr && ageDays > 0
    ? (livabilityPct * averageWeightKg * 100) / (ageDays * fcr)
    : null;
  const totalCost = costs.totalCost;
  const profit = roundCurrency(revenue - totalCost);

  const round = (value: number | null, digits = 2) => (value == null ? null : Number(value.toFixed(digits)));
  return {
    birdsPlaced,
    deaths,
    birdsSold,
    liveBirds: Math.max(0, birdsPlaced - deaths - birdsSold),
    kgSold,
    feedKg,
    revenue,
    ageDays,
    averageWeightKg: round(averageWeightKg, 3),
    livabilityPct: round(livabilityPct),
    mortalityPct: round(mortalityPct),
    fcr: round(fcr, 3),
    epef: round(epef, 0),
    totalCost,
    costPerBirdSold: birdsSold > 0 ? roundCurrency(totalCost / birdsSold) : null,
    costPerKg: kgSold > 0 ? roundCurrency(totalCost / kgSold) : null,
    profit,
    profitPerBird: birdsSold > 0 ? roundCurrency(profit / birdsSold) : null,
    marginPct: revenue > 0 ? round((profit / revenue) * 100) : null,
    lastSaleDate,
  };
}

export async function getBatchPerformance(batchId: number): Promise<BatchPerformance | null> {
  const [batch] = await db.select().from(batches).where(eq(batches.id, batchId)).limit(1);
  if (!batch) return null;
  const model = await buildCostingModel();
  const live = model.summaries.get(batchId);
  if (!live) return null;

  const [snapshot] = await db.select().from(batchCloseSnapshots).where(eq(batchCloseSnapshots.batchId, batchId)).limit(1);
  if (snapshot) {
    const costs = snapshot.costs as BatchCostSummary;
    return {
      batchId,
      status: batch.status,
      closed: true,
      closedAt: snapshot.closedAt.toISOString(),
      kpis: snapshot.kpis as BatchKpis,
      costs,
      lateCosts: roundCurrency(live.totalCost - costs.totalCost),
    };
  }

  const { lastSaleDate: _lastSaleDate, ...kpis } = await computeKpis(batchId, live, toIsoDate(new Date()));
  return { batchId, status: batch.status, closed: false, kpis, costs: live, lateCosts: 0 };
}

export class BatchCloseError extends Error {
  readonly statusCode = 400;
}

/**
 * Close a batch: freeze its costs, revenue and KPIs. Every bird must be accounted for
 * (placed = deaths + sold) unless the caller accepts the variance, which is recorded.
 */
export async function closeBatch(params: { batchId: number; closedBy: number; notes?: string | null; acceptVariance?: boolean }) {
  const [batch] = await db.select().from(batches).where(eq(batches.id, params.batchId)).limit(1);
  if (!batch) throw new BatchCloseError('Batch not found');
  const [existing] = await db.select({ id: batchCloseSnapshots.id }).from(batchCloseSnapshots).where(eq(batchCloseSnapshots.batchId, params.batchId)).limit(1);
  if (existing) throw new BatchCloseError('Batch is already closed');

  const model = await buildCostingModel();
  const costs = model.summaries.get(params.batchId);
  if (!costs) throw new BatchCloseError('Batch not found');
  const { lastSaleDate, ...kpis } = await computeKpis(params.batchId, costs, toIsoDate(new Date()));

  if (kpis.birdsSold === 0) {
    throw new BatchCloseError('No sales recorded for this batch yet');
  }
  if (kpis.liveBirds > 0 && !params.acceptVariance) {
    throw new BatchCloseError(
      `${kpis.liveBirds.toLocaleString('en-US')} birds are not accounted for (placed ${kpis.birdsPlaced}, deaths ${kpis.deaths}, sold ${kpis.birdsSold}). Record the missing deaths or sales, or close with the variance accepted.`,
    );
  }

  const frozenKpis = { ...kpis, unaccountedBirds: kpis.liveBirds, liveBirds: 0 };
  return db.transaction(async (tx) => {
    const [snapshot] = await tx.insert(batchCloseSnapshots).values({
      batchId: params.batchId,
      closedBy: params.closedBy,
      revenue: kpis.revenue.toFixed(2),
      totalCost: costs.totalCost.toFixed(2),
      profit: kpis.profit.toFixed(2),
      costs,
      kpis: frozenKpis,
      notes: params.notes ?? null,
    }).returning();
    await tx.update(batches).set({
      status: 'closed',
      actualDeliveryDate: batch.actualDeliveryDate ?? lastSaleDate ?? toIsoDate(new Date()),
      updatedAt: new Date(),
    }).where(eq(batches.id, params.batchId));
    await startTurnaroundForBatch({ batchId: params.batchId, userId: params.closedBy }, tx);
    return snapshot;
  });
}

export async function reopenBatch(batchId: number) {
  const [snapshot] = await db.select().from(batchCloseSnapshots).where(eq(batchCloseSnapshots.batchId, batchId)).limit(1);
  if (!snapshot) throw new BatchCloseError('Batch is not closed');
  await db.transaction(async (tx) => {
    await tx.delete(batchCloseSnapshots).where(eq(batchCloseSnapshots.batchId, batchId));
    await tx.update(batches).set({ status: 'sold', updatedAt: new Date() }).where(eq(batches.id, batchId));
  });
  return snapshot;
}
