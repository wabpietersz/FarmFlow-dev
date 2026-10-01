import { and, asc, eq, inArray, lte, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  batchHealthTasks,
  batchInventoryConsumptions,
  batches,
  chickPlacements,
  dailyRecords,
  feedInventory,
  growthStandardPoints,
  growthStandards,
  healthScheduleItems,
  healthScheduleTemplates,
  inventoryAuditTrail,
  inventoryItemTypes,
  inventoryLots,
  sales,
  vaccinations,
} from '../db/schema';
import { postInventoryMovement } from './inventory-movements';
import { NoLotsError, StockError, farmStoreForBatch, planLotConsumption, planLotConsumptionOrLegacy } from './stock';
import { assertPeriodOpen } from './period-locks';
import { toIsoDate } from './bird-days';

type Executor = typeof db | any;

export class FarmOpsError extends Error {
  constructor(message: string, readonly statusCode = 400, readonly code = 'FARM_OPS_INVALID') {
    super(message);
  }
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── Stock used on a batch (FIFO) ─────────────────────────────────────────────

export async function getInventoryItemForBatch(itemId: number, executor: Executor = db) {
  const [item] = await executor
    .select({
      id: feedInventory.id,
      ingredientName: feedInventory.ingredientName,
      quantity: feedInventory.quantity,
      unit: feedInventory.unit,
      costPerUnit: feedInventory.costPerUnit,
      allowsBatchAllocation: inventoryItemTypes.allowsBatchAllocation,
      isFeed: inventoryItemTypes.isFeed,
    })
    .from(feedInventory)
    .innerJoin(inventoryItemTypes, eq(feedInventory.itemTypeId, inventoryItemTypes.id))
    .where(eq(feedInventory.id, itemId))
    .limit(1);
  return item as undefined | {
    id: number; ingredientName: string; quantity: string; unit: string; costPerUnit: string; allowsBatchAllocation: boolean; isFeed: boolean;
  };
}

/**
 * Record a vaccination or medication on a batch. If stock is used it is taken from the oldest lots
 * first and charged to the batch at their cost. Everything happens in one transaction.
 */
export async function recordVaccination(params: {
  batchId: number;
  vaccineType: string;
  vaccinationDate: string;
  inventoryItemId?: number | null;
  quantityUsed?: number | null;
  notes?: string | null;
  userId: number;
}, outer?: Executor) {
  const run = async (tx: Executor) => {
    const [batch] = await tx.select().from(batches).where(eq(batches.id, params.batchId)).limit(1);
    if (!batch) throw new FarmOpsError('Batch not found', 404, 'NOT_FOUND');
    if (batch.status === 'closed') throw new FarmOpsError('This batch is closed. Reopen it to make changes.', 400, 'BATCH_CLOSED');

    const quantityUsed = params.quantityUsed ?? null;
    await assertPeriodOpen(params.vaccinationDate, quantityUsed ? 'inventory' : 'costing');

    let inventoryCost = 0;
    let unit: string | null = null;

    if (params.inventoryItemId && quantityUsed) {
      const item = await getInventoryItemForBatch(params.inventoryItemId, tx);
      if (!item) throw new FarmOpsError('Inventory item not found', 404, 'INVENTORY_ITEM_NOT_FOUND');
      if (item.isFeed || !item.allowsBatchAllocation) {
        throw new FarmOpsError('This stock item cannot be used on a batch', 400, 'INVALID_VACCINE_INVENTORY');
      }
      if (Number(item.quantity) < quantityUsed) {
        throw new FarmOpsError(`Only ${Number(item.quantity)} ${item.unit} of ${item.ingredientName} in stock`, 400, 'INSUFFICIENT_INVENTORY');
      }
      unit = item.unit;

      const store = await farmStoreForBatch(batch.id, tx);
      let plan: Awaited<ReturnType<typeof planLotConsumption>> | null = null;
      try {
        plan = await planLotConsumptionOrLegacy({ inventoryItemId: item.id, quantity: quantityUsed, preferredLocationId: store?.id, asOf: params.vaccinationDate, executor: tx });
      } catch (error) {
        if (error instanceof StockError) throw new FarmOpsError(`${item.ingredientName}: ${error.message}`, 400, error.code);
        if (!(error instanceof NoLotsError)) throw error;
      }

      if (plan) {
        for (const part of plan.lotConsumptions) {
          const lot = { id: part.lotId, purchaseOrderItemId: part.purchaseOrderItemId };
          const before = part.previousRemaining;
          const used = part.quantityUsed;
          const cost = part.costPerUnit;
          const lineCost = part.lineCost;
          const after = part.newRemaining;
          inventoryCost += lineCost;

          await tx.update(inventoryLots).set({ remainingQuantity: String(after) }).where(eq(inventoryLots.id, lot.id));
          await tx.insert(batchInventoryConsumptions).values({
            batchId: batch.id,
            inventoryItemId: item.id,
            inventoryLotId: lot.id,
            purchaseOrderItemId: lot.purchaseOrderItemId ?? null,
            quantity: String(used),
            unit: item.unit,
            unitCost: String(cost),
            lineCost: String(lineCost),
            consumptionDate: params.vaccinationDate,
            referenceType: 'vaccination',
            referenceId: batch.id,
            notes: params.notes ?? null,
            createdBy: params.userId,
          });
          await tx.insert(inventoryAuditTrail).values({
            inventoryItemId: item.id,
            changeType: 'vaccination_consumption',
            previousQuantity: String(before),
            changeQuantity: String(-used),
            newQuantity: String(after),
            referenceId: batch.id,
            referenceType: 'batch',
            notes: `${params.vaccineType}${params.notes ? ` - ${params.notes}` : ''}`,
            lotId: lot.id,
            costAtTime: String(cost),
            performedBy: params.userId,
          });
          await postInventoryMovement({
            movementType: 'batch_consume',
            movementDate: params.vaccinationDate,
            sourceModule: 'batches',
            sourceEntityType: 'vaccination',
            sourceEntityId: batch.id,
            sourceCodeSnapshot: batch.batchCode,
            inventoryItemId: item.id,
            inventoryLotId: lot.id,
            purchaseOrderItemId: lot.purchaseOrderItemId ?? null,
            batchId: batch.id,
            quantity: -used,
            unit: item.unit,
            unitCost: cost,
            lineCost,
            balanceAfterQuantity: after,
            balanceScope: 'inventory_lot',
            notes: params.notes ?? null,
            createdBy: params.userId,
          }, tx);
        }
      } else {
        // Stock predating lot tracking: charge at the item's average cost.
        inventoryCost = Math.round(quantityUsed * Number(item.costPerUnit) * 100) / 100;
        await tx.insert(batchInventoryConsumptions).values({
          batchId: batch.id,
          inventoryItemId: item.id,
          quantity: String(quantityUsed),
          unit: item.unit,
          unitCost: String(item.costPerUnit),
          lineCost: String(inventoryCost),
          consumptionDate: params.vaccinationDate,
          referenceType: 'vaccination',
          referenceId: batch.id,
          notes: params.notes ?? null,
          createdBy: params.userId,
        });
      }

      await tx
        .update(feedInventory)
        .set({ quantity: String(Math.round((Number(item.quantity) - quantityUsed) * 1000) / 1000), updatedAt: new Date() })
        .where(eq(feedInventory.id, item.id));
    }

    const [record] = await tx
      .insert(vaccinations)
      .values({
        batchId: batch.id,
        vaccineType: params.vaccineType,
        vaccinationDate: params.vaccinationDate,
        inventoryItemId: params.inventoryItemId ?? null,
        quantityUsed: quantityUsed != null ? String(quantityUsed) : null,
        unit,
        inventoryCost: inventoryCost > 0 ? String(Math.round(inventoryCost * 100) / 100) : null,
        notes: params.notes ?? null,
        recordedBy: params.userId,
      })
      .returning();
    return record as typeof vaccinations.$inferSelect;
  };
  return outer ? run(outer) : db.transaction(run);
}

// ─── Health plan tasks ────────────────────────────────────────────────────────

async function birdsPlaced(batchId: number, executor: Executor) {
  const [batch] = await executor.select({ chicksPlaced: batches.chicksPlaced }).from(batches).where(eq(batches.id, batchId)).limit(1);
  const [placement] = await executor
    .select({ accepted: sql<number>`COALESCE(SUM(${chickPlacements.acceptedQuantity}), 0)::int`, count: sql<number>`count(*)::int` })
    .from(chickPlacements)
    .where(eq(chickPlacements.batchId, batchId));
  return placement?.count > 0 ? placement.accepted : batch?.chicksPlaced ?? 0;
}

export async function getDefaultTemplateId(executor: Executor = db) {
  const [template] = await executor
    .select({ id: healthScheduleTemplates.id })
    .from(healthScheduleTemplates)
    .where(and(eq(healthScheduleTemplates.isDefault, true), eq(healthScheduleTemplates.status, 'active')))
    .limit(1);
  return template?.id ?? null;
}

/**
 * Create (or re-create) a batch's health tasks from a programme. Tasks already done or skipped are
 * kept; pending programme tasks are replaced; tasks added by hand are left alone.
 */
export async function applyHealthTemplate(params: { batchId: number; templateId: number | null }, outer?: Executor) {
  const run = async (tx: Executor) => {
    const [batch] = await tx.select().from(batches).where(eq(batches.id, params.batchId)).limit(1);
    if (!batch) throw new FarmOpsError('Batch not found', 404, 'NOT_FOUND');
    const templateId = params.templateId ?? await getDefaultTemplateId(tx);

    await tx.delete(batchHealthTasks).where(and(
      eq(batchHealthTasks.batchId, batch.id),
      eq(batchHealthTasks.status, 'pending'),
      sql`${batchHealthTasks.templateItemId} IS NOT NULL`,
    ));
    await tx.update(batches).set({ healthTemplateId: templateId, updatedAt: new Date() }).where(eq(batches.id, batch.id));
    if (!templateId) return [];

    const items = await tx.select().from(healthScheduleItems).where(eq(healthScheduleItems.templateId, templateId)).orderBy(asc(healthScheduleItems.dayOfAge));
    const kept = await tx
      .select({ templateItemId: batchHealthTasks.templateItemId })
      .from(batchHealthTasks)
      .where(and(eq(batchHealthTasks.batchId, batch.id), inArray(batchHealthTasks.status, ['done', 'skipped'])));
    const keptIds = new Set(kept.map((row: { templateItemId: number | null }) => row.templateItemId));
    const placed = await birdsPlaced(batch.id, tx);
    const placement = toIsoDate(batch.placementDate);

    const rows = items
      .filter((item: typeof healthScheduleItems.$inferSelect) => !keptIds.has(item.id))
      .map((item: typeof healthScheduleItems.$inferSelect) => ({
        batchId: batch.id,
        templateItemId: item.id,
        dueDate: addDays(placement, item.dayOfAge),
        dayOfAge: item.dayOfAge,
        taskType: item.taskType,
        name: item.name,
        method: item.method,
        inventoryItemId: item.inventoryItemId,
        plannedQuantity: item.dosePer1000Birds ? String(Math.round((Number(item.dosePer1000Birds) * placed / 1000) * 1000) / 1000) : null,
        notes: item.notes,
      }));
    if (rows.length === 0) return [];
    return tx.insert(batchHealthTasks).values(rows).returning();
  };
  return outer ? run(outer) : db.transaction(run);
}

export async function completeHealthTask(params: {
  taskId: number;
  completedDate: string;
  inventoryItemId?: number | null;
  quantityUsed?: number | null;
  notes?: string | null;
  userId: number;
}) {
  return db.transaction(async (tx) => {
    const [task] = await tx.select().from(batchHealthTasks).where(eq(batchHealthTasks.id, params.taskId)).limit(1);
    if (!task) throw new FarmOpsError('Task not found', 404, 'NOT_FOUND');
    if (task.status !== 'pending') throw new FarmOpsError('This task is already done or skipped');

    const inventoryItemId = params.inventoryItemId ?? task.inventoryItemId;
    const quantityUsed = params.quantityUsed ?? (task.plannedQuantity ? Number(task.plannedQuantity) : null);
    const vaccination = await recordVaccination({
      batchId: task.batchId,
      vaccineType: task.name,
      vaccinationDate: params.completedDate,
      inventoryItemId: inventoryItemId && quantityUsed ? inventoryItemId : null,
      quantityUsed: inventoryItemId && quantityUsed ? quantityUsed : null,
      notes: params.notes ?? null,
      userId: params.userId,
    }, tx);

    const [updated] = await tx
      .update(batchHealthTasks)
      .set({
        status: 'done',
        completedDate: params.completedDate,
        completedBy: params.userId,
        vaccinationId: vaccination.id,
        notes: params.notes ?? task.notes,
        updatedAt: new Date(),
      })
      .where(eq(batchHealthTasks.id, task.id))
      .returning();
    return { task: updated, vaccination };
  });
}

export async function skipHealthTask(params: { taskId: number; reason: string; userId: number }) {
  const [task] = await db.select().from(batchHealthTasks).where(eq(batchHealthTasks.id, params.taskId)).limit(1);
  if (!task) throw new FarmOpsError('Task not found', 404, 'NOT_FOUND');
  if (task.status !== 'pending') throw new FarmOpsError('This task is already done or skipped');
  const [updated] = await db
    .update(batchHealthTasks)
    .set({ status: 'skipped', skipReason: params.reason, completedBy: params.userId, completedDate: toIsoDate(new Date()), updatedAt: new Date() })
    .where(eq(batchHealthTasks.id, task.id))
    .returning();
  return updated;
}

/** Health tasks due on or before a date for open batches (optionally one site). */
export async function listDueHealthTasks(params: { asOf: string; siteId?: number | null }) {
  return db
    .select({
      id: batchHealthTasks.id,
      batchId: batchHealthTasks.batchId,
      batchCode: batches.batchCode,
      siteId: batches.siteId,
      dueDate: batchHealthTasks.dueDate,
      dayOfAge: batchHealthTasks.dayOfAge,
      name: batchHealthTasks.name,
      taskType: batchHealthTasks.taskType,
      method: batchHealthTasks.method,
    })
    .from(batchHealthTasks)
    .innerJoin(batches, eq(batchHealthTasks.batchId, batches.id))
    .where(and(
      eq(batchHealthTasks.status, 'pending'),
      lte(batchHealthTasks.dueDate, params.asOf),
      inArray(batches.status, ['placement', 'growing', 'ready_for_sale']),
      params.siteId ? eq(batches.siteId, params.siteId) : undefined,
    ))
    .orderBy(asc(batchHealthTasks.dueDate));
}

// ─── Growth: actual vs target ─────────────────────────────────────────────────

export type GrowthPoint = {
  dayOfAge: number;
  date: string;
  actualWeightG: number | null;
  targetWeightG: number | null;
  actualCumFeedG: number | null;
  targetCumFeedG: number | null;
  actualCumMortalityPct: number;
  targetCumMortalityPct: number | null;
};

function interpolate(points: Array<{ day: number; value: number | null }>, day: number): number | null {
  const valid = points.filter((p) => p.value != null) as Array<{ day: number; value: number }>;
  if (valid.length === 0) return null;
  if (day <= valid[0].day) return valid[0].value;
  for (let i = 1; i < valid.length; i += 1) {
    if (day <= valid[i].day) {
      const a = valid[i - 1];
      const b = valid[i];
      return a.value + ((b.value - a.value) * (day - a.day)) / (b.day - a.day);
    }
  }
  return valid[valid.length - 1].value;
}

export async function getGrowthComparison(batchId: number) {
  const [batch] = await db.select().from(batches).where(eq(batches.id, batchId)).limit(1);
  if (!batch) throw new FarmOpsError('Batch not found', 404, 'NOT_FOUND');

  let standardId = batch.growthStandardId;
  if (!standardId) {
    const [fallback] = await db.select({ id: growthStandards.id }).from(growthStandards)
      .where(and(eq(growthStandards.isDefault, true), eq(growthStandards.status, 'active'))).limit(1);
    standardId = fallback?.id ?? null;
  }
  const [standard] = standardId
    ? await db.select().from(growthStandards).where(eq(growthStandards.id, standardId)).limit(1)
    : [];
  const points = standardId
    ? await db.select().from(growthStandardPoints).where(eq(growthStandardPoints.standardId, standardId)).orderBy(asc(growthStandardPoints.dayOfAge))
    : [];

  const records = await db.select().from(dailyRecords).where(eq(dailyRecords.batchId, batchId)).orderBy(asc(dailyRecords.recordDate));
  const soldRows = await db.select({ date: sales.saleDate, birds: sales.totalBirds }).from(sales)
    .where(and(eq(sales.batchId, batchId), sql`${sales.status} <> 'cancelled'`));
  const placed = await birdsPlaced(batchId, db);
  const placement = toIsoDate(batch.placementDate);

  const weightTargets = points.map((p) => ({ day: p.dayOfAge, value: p.targetWeightG }));
  const feedTargets = points.map((p) => ({ day: p.dayOfAge, value: p.targetCumFeedG }));
  const mortTargets = points.map((p) => ({ day: p.dayOfAge, value: p.targetCumMortalityPct == null ? null : Number(p.targetCumMortalityPct) }));

  let cumFeedKg = 0;
  let cumDeaths = 0;
  const series: GrowthPoint[] = records.map((record) => {
    const date = toIsoDate(record.recordDate);
    const day = Math.round((new Date(date).getTime() - new Date(placement).getTime()) / 86_400_000);
    cumFeedKg += Number(record.feedConsumption ?? 0);
    cumDeaths += record.mortalityCount ?? 0;
    const soldToDate = soldRows.filter((row) => toIsoDate(row.date) <= date).reduce((sum, row) => sum + row.birds, 0);
    const alive = Math.max(1, placed - cumDeaths - soldToDate);
    return {
      dayOfAge: day,
      date,
      actualWeightG: record.averageWeight != null ? Number(record.averageWeight) : null,
      targetWeightG: interpolate(weightTargets, day) != null ? Math.round(interpolate(weightTargets, day)!) : null,
      // Feed per bird: average of birds alive, approximated by those alive at the end of the day
      actualCumFeedG: cumFeedKg > 0 ? Math.round((cumFeedKg * 1000) / alive) : null,
      targetCumFeedG: interpolate(feedTargets, day) != null ? Math.round(interpolate(feedTargets, day)!) : null,
      actualCumMortalityPct: placed > 0 ? Math.round((cumDeaths / placed) * 10000) / 100 : 0,
      targetCumMortalityPct: interpolate(mortTargets, day) != null ? Math.round(interpolate(mortTargets, day)! * 100) / 100 : null,
    };
  });

  const latestWithWeight = [...series].reverse().find((point) => point.actualWeightG != null && point.targetWeightG);
  return {
    standard: standard ? { id: standard.id, name: standard.name, breed: standard.breed } : null,
    series,
    latest: latestWithWeight
      ? {
          dayOfAge: latestWithWeight.dayOfAge,
          actualWeightG: latestWithWeight.actualWeightG,
          targetWeightG: latestWithWeight.targetWeightG,
          weightVsTargetPct: Math.round(((latestWithWeight.actualWeightG! / latestWithWeight.targetWeightG!) - 1) * 1000) / 10,
        }
      : null,
  };
}
