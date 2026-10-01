import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  batchCloseSnapshots,
  batchHealthTasks,
  batches,
  cages,
  chickPlacements,
  dailyRecords,
  growthStandards,
  houseTurnarounds,
  sales,
  sites,
} from '../db/schema';
import { toIsoDate } from './bird-days';
import { FarmOpsError, applyHealthTemplate, getGrowthComparison } from './batch-health';

type Executor = typeof db | any;

// ─── House turnaround ─────────────────────────────────────────────────────────

/** When a batch leaves a house, the house goes into turnaround (cleaning) until it is ready again. */
export async function startTurnaroundForBatch(params: { batchId: number; startedDate?: string; userId?: number | null }, executor: Executor = db) {
  const [batch] = await executor.select().from(batches).where(eq(batches.id, params.batchId)).limit(1);
  if (!batch) return null;
  const [open] = await executor
    .select({ id: houseTurnarounds.id })
    .from(houseTurnarounds)
    .where(and(eq(houseTurnarounds.cageId, batch.cageId), eq(houseTurnarounds.status, 'in_progress')))
    .limit(1);
  if (open) return open;
  const [created] = await executor.insert(houseTurnarounds).values({
    cageId: batch.cageId,
    previousBatchId: batch.id,
    startedDate: params.startedDate ?? toIsoDate(batch.actualDeliveryDate ?? new Date()),
    status: 'in_progress',
    createdBy: params.userId ?? null,
  }).returning();
  await executor.update(cages).set({ status: 'maintenance', updatedAt: new Date() }).where(eq(cages.id, batch.cageId));
  return created;
}

export async function updateTurnaround(params: {
  id: number;
  litterRemovedDate?: string | null;
  cleanedDate?: string | null;
  disinfectedDate?: string | null;
  newLitterDate?: string | null;
  readyDate?: string | null;
  notes?: string | null;
}) {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(houseTurnarounds).where(eq(houseTurnarounds.id, params.id)).limit(1);
    if (!existing) throw new FarmOpsError('Turnaround not found', 404, 'NOT_FOUND');
    const fields = {
      ...(params.litterRemovedDate !== undefined ? { litterRemovedDate: params.litterRemovedDate } : {}),
      ...(params.cleanedDate !== undefined ? { cleanedDate: params.cleanedDate } : {}),
      ...(params.disinfectedDate !== undefined ? { disinfectedDate: params.disinfectedDate } : {}),
      ...(params.newLitterDate !== undefined ? { newLitterDate: params.newLitterDate } : {}),
      ...(params.readyDate !== undefined ? { readyDate: params.readyDate } : {}),
      ...(params.notes !== undefined ? { notes: params.notes } : {}),
    };
    const ready = (params.readyDate ?? existing.readyDate) != null;
    const [updated] = await tx.update(houseTurnarounds).set({
      ...fields,
      status: ready ? 'ready' : 'in_progress',
      updatedAt: new Date(),
    }).where(eq(houseTurnarounds.id, params.id)).returning();
    if (ready && existing.status !== 'ready') {
      const [cage] = await tx.select().from(cages).where(eq(cages.id, existing.cageId)).limit(1);
      if (cage && cage.status !== 'occupied') {
        await tx.update(cages).set({ status: 'empty', updatedAt: new Date() }).where(eq(cages.id, cage.id));
      }
    }
    return updated;
  });
}

export async function listTurnarounds(params: { siteId?: number | null; status?: string | null }) {
  const rows = await db
    .select({
      id: houseTurnarounds.id,
      cageId: houseTurnarounds.cageId,
      cageNumber: cages.cageNumber,
      siteId: cages.siteId,
      siteName: sites.siteName,
      previousBatchId: houseTurnarounds.previousBatchId,
      previousBatchCode: batches.batchCode,
      startedDate: houseTurnarounds.startedDate,
      litterRemovedDate: houseTurnarounds.litterRemovedDate,
      cleanedDate: houseTurnarounds.cleanedDate,
      disinfectedDate: houseTurnarounds.disinfectedDate,
      newLitterDate: houseTurnarounds.newLitterDate,
      readyDate: houseTurnarounds.readyDate,
      status: houseTurnarounds.status,
      notes: houseTurnarounds.notes,
    })
    .from(houseTurnarounds)
    .innerJoin(cages, eq(houseTurnarounds.cageId, cages.id))
    .innerJoin(sites, eq(cages.siteId, sites.id))
    .leftJoin(batches, eq(houseTurnarounds.previousBatchId, batches.id))
    .where(and(
      params.siteId ? eq(cages.siteId, params.siteId) : undefined,
      params.status ? eq(houseTurnarounds.status, params.status) : undefined,
    ))
    .orderBy(desc(houseTurnarounds.startedDate));
  const today = toIsoDate(new Date());
  return rows.map((row) => {
    const end = row.readyDate ? toIsoDate(row.readyDate) : today;
    return { ...row, downtimeDays: Math.max(0, Math.round((new Date(end).getTime() - new Date(toIsoDate(row.startedDate)).getTime()) / 86_400_000)) };
  });
}

// ─── Batch set-up when chicks are placed ──────────────────────────────────────

/** New batch: give it the default growth curve and health plan, and end any turnaround on its house. */
export async function setUpNewBatch(params: { batchId: number; placementDate: string }, executor: Executor) {
  const [batch] = await executor.select().from(batches).where(eq(batches.id, params.batchId)).limit(1);
  if (!batch) return;
  if (!batch.growthStandardId) {
    const [standard] = await executor.select({ id: growthStandards.id }).from(growthStandards)
      .where(and(eq(growthStandards.isDefault, true), eq(growthStandards.status, 'active'))).limit(1);
    if (standard) await executor.update(batches).set({ growthStandardId: standard.id }).where(eq(batches.id, batch.id));
  }
  await applyHealthTemplate({ batchId: batch.id, templateId: batch.healthTemplateId ?? null }, executor);
  await executor.update(houseTurnarounds).set({
    status: 'ready',
    readyDate: sql`COALESCE(${houseTurnarounds.readyDate}, ${params.placementDate}::date)`,
    updatedAt: new Date(),
  }).where(and(eq(houseTurnarounds.cageId, batch.cageId), eq(houseTurnarounds.status, 'in_progress')));
}

// ─── Today's check (the farm manager's daily log) ────────────────────────────

async function placedBirds(batchId: number, fallback: number) {
  const [placement] = await db
    .select({ accepted: sql<number>`COALESCE(SUM(${chickPlacements.acceptedQuantity}), 0)::int`, count: sql<number>`count(*)::int` })
    .from(chickPlacements)
    .where(eq(chickPlacements.batchId, batchId));
  return placement?.count > 0 ? placement.accepted : fallback;
}

export async function getTodayCheck(batchId: number, date: string) {
  const [batch] = await db
    .select({
      id: batches.id,
      batchCode: batches.batchCode,
      status: batches.status,
      placementDate: batches.placementDate,
      chicksPlaced: batches.chicksPlaced,
      siteName: sites.siteName,
      cageNumber: cages.cageNumber,
    })
    .from(batches)
    .innerJoin(sites, eq(batches.siteId, sites.id))
    .innerJoin(cages, eq(batches.cageId, cages.id))
    .where(eq(batches.id, batchId))
    .limit(1);
  if (!batch) throw new FarmOpsError('Batch not found', 404, 'NOT_FOUND');

  const placed = await placedBirds(batchId, batch.chicksPlaced);
  const [deathsBefore] = await db
    .select({ deaths: sql<number>`COALESCE(SUM(${dailyRecords.mortalityCount}), 0)::int` })
    .from(dailyRecords)
    .where(and(eq(dailyRecords.batchId, batchId), sql`${dailyRecords.recordDate} < ${date}`));
  const [soldBefore] = await db
    .select({ birds: sql<number>`COALESCE(SUM(${sales.totalBirds}), 0)::int` })
    .from(sales)
    .where(and(eq(sales.batchId, batchId), sql`${sales.saleDate} <= ${date}`, sql`${sales.status} <> 'cancelled'`));
  const recent = await db
    .select()
    .from(dailyRecords)
    .where(and(eq(dailyRecords.batchId, batchId), sql`${dailyRecords.recordDate} <= ${date}`))
    .orderBy(desc(dailyRecords.recordDate))
    .limit(2);
  const todayRecord = recent.find((r) => toIsoDate(r.recordDate) === date) ?? null;
  const previous = recent.find((r) => toIsoDate(r.recordDate) < date) ?? null;

  const dayOfAge = Math.round((new Date(date).getTime() - new Date(toIsoDate(batch.placementDate)).getTime()) / 86_400_000);
  const growth = await getGrowthComparison(batchId);
  const target = growth.series.find((point) => point.dayOfAge === dayOfAge);

  const tasks = await db
    .select()
    .from(batchHealthTasks)
    .where(and(eq(batchHealthTasks.batchId, batchId), eq(batchHealthTasks.status, 'pending'), sql`${batchHealthTasks.dueDate} <= ${date}`))
    .orderBy(asc(batchHealthTasks.dueDate));

  return {
    batch: { ...batch, birdsPlaced: placed },
    date,
    dayOfAge,
    liveBirdsAtStart: Math.max(0, placed - (deathsBefore?.deaths ?? 0) - (soldBefore?.birds ?? 0)),
    record: todayRecord,
    previous,
    targets: {
      weightG: target?.targetWeightG ?? null,
      cumMortalityPct: target?.targetCumMortalityPct ?? null,
      standardName: growth.standard?.name ?? null,
    },
    dueTasks: tasks,
  };
}

/** Save today's check: creates the day's record or updates it. Live birds are worked out, not typed. */
export async function saveTodayCheck(params: {
  batchId: number;
  date: string;
  mortalityCount: number;
  mortalityCause?: string | null;
  feedConsumption: number;
  waterConsumption?: number | null;
  averageWeight?: number | null;
  temperature?: number | null;
  humidity?: number | null;
  notes?: string | null;
  userId: number;
}) {
  const check = await getTodayCheck(params.batchId, params.date);
  if (check.batch.status === 'closed') throw new FarmOpsError('This batch is closed. Reopen it to make changes.', 400, 'BATCH_CLOSED');
  if (params.mortalityCount > check.liveBirdsAtStart) {
    throw new FarmOpsError(`Deaths (${params.mortalityCount}) can't exceed the ${check.liveBirdsAtStart} birds alive this morning`);
  }
  const values = {
    currentAge: Math.max(0, check.dayOfAge),
    birdCount: Math.max(0, check.liveBirdsAtStart - params.mortalityCount),
    mortalityCount: params.mortalityCount,
    mortalityCause: params.mortalityCause || null,
    feedConsumption: params.feedConsumption.toString(),
    waterConsumption: params.waterConsumption != null ? params.waterConsumption.toString() : null,
    averageWeight: params.averageWeight != null ? params.averageWeight.toString() : null,
    temperature: params.temperature != null ? params.temperature.toString() : null,
    humidity: params.humidity ?? null,
    notes: params.notes || null,
    recordedBy: params.userId,
    updatedAt: new Date(),
  };
  return db.transaction(async (tx) => {
    let record;
    if (check.record) {
      [record] = await tx.update(dailyRecords).set(values).where(eq(dailyRecords.id, check.record.id)).returning();
    } else {
      [record] = await tx.insert(dailyRecords).values({ ...values, batchId: params.batchId, recordDate: params.date }).returning();
    }
    if (check.batch.status === 'placement') {
      await tx.update(batches).set({ status: 'growing', updatedAt: new Date() }).where(eq(batches.id, params.batchId));
    }
    return record;
  });
}

// ─── Batch history: closed batches compared ──────────────────────────────────

export async function getBatchHistory(params: { siteId?: number | null; cageId?: number | null }) {
  const rows = await db
    .select({
      batchId: batches.id,
      batchCode: batches.batchCode,
      siteId: batches.siteId,
      siteName: sites.siteName,
      cageId: batches.cageId,
      cageNumber: cages.cageNumber,
      placementDate: batches.placementDate,
      closedAt: batchCloseSnapshots.closedAt,
      revenue: batchCloseSnapshots.revenue,
      totalCost: batchCloseSnapshots.totalCost,
      profit: batchCloseSnapshots.profit,
      kpis: batchCloseSnapshots.kpis,
    })
    .from(batchCloseSnapshots)
    .innerJoin(batches, eq(batchCloseSnapshots.batchId, batches.id))
    .innerJoin(sites, eq(batches.siteId, sites.id))
    .innerJoin(cages, eq(batches.cageId, cages.id))
    .where(and(
      params.siteId ? eq(batches.siteId, params.siteId) : undefined,
      params.cageId ? eq(batches.cageId, params.cageId) : undefined,
    ))
    .orderBy(desc(batches.placementDate));

  const list = rows.map((row) => {
    const kpis = row.kpis as Record<string, number | null>;
    return {
      batchId: row.batchId,
      batchCode: row.batchCode,
      siteName: row.siteName,
      cageNumber: row.cageNumber,
      placementDate: toIsoDate(row.placementDate),
      closedAt: row.closedAt.toISOString(),
      revenue: Number(row.revenue),
      totalCost: Number(row.totalCost),
      profit: Number(row.profit),
      birdsPlaced: kpis.birdsPlaced ?? null,
      birdsSold: kpis.birdsSold ?? null,
      ageDays: kpis.ageDays ?? null,
      mortalityPct: kpis.mortalityPct ?? null,
      fcr: kpis.fcr ?? null,
      averageWeightKg: kpis.averageWeightKg ?? null,
      epef: kpis.epef ?? null,
      costPerKg: kpis.costPerKg ?? null,
      profitPerBird: kpis.profitPerBird ?? null,
    };
  });

  const avg = (key: keyof (typeof list)[number]) => {
    const values = list.map((row) => row[key]).filter((v): v is number => typeof v === 'number');
    return values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 1000) / 1000 : null;
  };
  const best = (key: keyof (typeof list)[number], higherIsBetter: boolean) => {
    const values = list.filter((row) => typeof row[key] === 'number');
    if (values.length === 0) return null;
    return values.reduce((a, b) => ((higherIsBetter ? (b[key] as number) > (a[key] as number) : (b[key] as number) < (a[key] as number)) ? b : a)).batchCode;
  };

  return {
    batches: list,
    averages: {
      mortalityPct: avg('mortalityPct'),
      fcr: avg('fcr'),
      averageWeightKg: avg('averageWeightKg'),
      epef: avg('epef'),
      costPerKg: avg('costPerKg'),
      profitPerBird: avg('profitPerBird'),
    },
    best: {
      fcr: best('fcr', false),
      epef: best('epef', true),
      profitPerBird: best('profitPerBird', true),
    },
  };
}

