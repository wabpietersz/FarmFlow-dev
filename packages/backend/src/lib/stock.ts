import { and, asc, eq, gt, ilike, inArray, isNotNull, lte, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  batches,
  feedInventory,
  inventoryAuditTrail,
  inventoryLots,
  sites,
  stockLocations,
  stockTransferLines,
  stockTransfers,
} from '../db/schema';
import { postInventoryMovement } from './inventory-movements';
import { assertPeriodOpen } from './period-locks';
import { toIsoDate } from './bird-days';

type Executor = typeof db | any;

export class StockError extends Error {
  constructor(message: string, readonly statusCode = 400, readonly code = 'STOCK_INVALID') {
    super(message);
  }
}

export interface LotConsumption {
  lotId: number;
  lotCode: string;
  locationId: number;
  purchaseOrderItemId: number | null;
  quantityUsed: number;
  costPerUnit: number;
  lineCost: number;
  previousRemaining: number;
  newRemaining: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

// ─── Stores ───────────────────────────────────────────────────────────────────

export async function getLocationByCode(code: string, executor: Executor = db) {
  const [location] = await executor.select().from(stockLocations).where(eq(stockLocations.code, code)).limit(1);
  if (!location) throw new StockError(`Store "${code}" is not set up`, 500, 'STOCK_LOCATION_MISSING');
  return location as typeof stockLocations.$inferSelect;
}

/** Each farm has its own store; created on first use for farms added later. */
export async function ensureFarmStore(siteId: number, executor: Executor = db) {
  const [existing] = await executor
    .select()
    .from(stockLocations)
    .where(and(eq(stockLocations.siteId, siteId), eq(stockLocations.locationType, 'farm_store')))
    .limit(1);
  if (existing) return existing as typeof stockLocations.$inferSelect;
  const [site] = await executor.select().from(sites).where(eq(sites.id, siteId)).limit(1);
  if (!site) throw new StockError('Site not found', 404, 'NOT_FOUND');
  const [created] = await executor
    .insert(stockLocations)
    .values({ code: `FARM-${site.id}`, name: `${site.siteName} store`, locationType: 'farm_store', siteId: site.id })
    .returning();
  return created as typeof stockLocations.$inferSelect;
}

export async function farmStoreForBatch(batchId: number, executor: Executor = db) {
  const [batch] = await executor.select({ siteId: batches.siteId }).from(batches).where(eq(batches.id, batchId)).limit(1);
  return batch ? ensureFarmStore(batch.siteId, executor) : null;
}

export async function generateLotCode(date: string, prefix = 'LOT', executor: Executor = db): Promise<string> {
  const lotPrefix = `${prefix}-${date.replace(/-/g, '').slice(0, 8)}-`;
  const [result] = await executor
    .select({ total: sql<number>`count(*)::int` })
    .from(inventoryLots)
    .where(ilike(inventoryLots.lotCode, `${lotPrefix}%`));
  return `${lotPrefix}${String((result?.total ?? 0) + 1).padStart(3, '0')}`;
}

// ─── Picking lots ─────────────────────────────────────────────────────────────

/**
 * Choose which lots to take stock from. The preferred store is used first; within a store the lot that
 * expires first goes first, then the oldest. Expired lots are never used: they must be written off.
 * Pass `onlyLocationId` to take from one store only (e.g. a transfer).
 */
export async function planLotConsumption(params: {
  inventoryItemId: number;
  quantity: number;
  preferredLocationId?: number | null;
  onlyLocationId?: number | null;
  asOf?: string;
  /** Write-offs and stock-count corrections may take expired lots; normal use may not. */
  allowExpired?: boolean;
  executor?: Executor;
}): Promise<{ lotConsumptions: LotConsumption[]; totalCost: number }> {
  const executor = params.executor ?? db;
  const asOf = params.asOf ?? toIsoDate(new Date());
  const lots = await executor
    .select()
    .from(inventoryLots)
    .where(and(
      eq(inventoryLots.inventoryItemId, params.inventoryItemId),
      sql`${inventoryLots.remainingQuantity}::numeric > 0`,
      params.onlyLocationId ? eq(inventoryLots.locationId, params.onlyLocationId) : undefined,
    ))
    .orderBy(...[
      ...(params.preferredLocationId
        ? [sql`CASE WHEN ${inventoryLots.locationId} = ${params.preferredLocationId} THEN 0 ELSE 1 END`]
        : []),
      sql`${inventoryLots.expiryDate} ASC NULLS LAST`,
      asc(inventoryLots.receivedDate),
      asc(inventoryLots.id),
    ]);

  const usable = lots.filter((lot: typeof inventoryLots.$inferSelect) => params.allowExpired || !lot.expiryDate || toIsoDate(lot.expiryDate) >= asOf);
  const available = usable.reduce((sum: number, lot: typeof inventoryLots.$inferSelect) => sum + Number(lot.remainingQuantity), 0);
  if (available + 1e-9 < params.quantity) {
    const expired = lots.length - usable.length > 0
      ? lots.filter((lot: typeof inventoryLots.$inferSelect) => lot.expiryDate && toIsoDate(lot.expiryDate) < asOf)
        .reduce((sum: number, lot: typeof inventoryLots.$inferSelect) => sum + Number(lot.remainingQuantity), 0)
      : 0;
    throw new StockError(
      `Not enough stock: ${round2(available)} available, ${params.quantity} needed${expired > 0 ? ` (${round2(expired)} more is expired and can't be used)` : ''}`,
      400,
      'INSUFFICIENT_STOCK',
    );
  }

  const lotConsumptions: LotConsumption[] = [];
  let remaining = params.quantity;
  let totalCost = 0;
  for (const lot of usable) {
    if (remaining <= 1e-9) break;
    const before = Number(lot.remainingQuantity);
    const used = Math.min(remaining, before);
    const cost = Number(lot.costPerUnit);
    const lineCost = round2(used * cost);
    lotConsumptions.push({
      lotId: lot.id,
      lotCode: lot.lotCode,
      locationId: lot.locationId,
      purchaseOrderItemId: lot.purchaseOrderItemId ?? null,
      quantityUsed: round2(used),
      costPerUnit: cost,
      lineCost,
      previousRemaining: before,
      newRemaining: round2(before - used),
    });
    totalCost += lineCost;
    remaining = round2(remaining - used);
  }
  return { lotConsumptions, totalCost: round2(totalCost) };
}

/** Stock recorded before lots were tracked has no lots; callers then fall back to the item's average cost. */
export class NoLotsError extends Error {}

export async function planLotConsumptionOrLegacy(params: Parameters<typeof planLotConsumption>[0]) {
  const executor = params.executor ?? db;
  const [lotCount] = await executor
    .select({ count: sql<number>`count(*)::int` })
    .from(inventoryLots)
    .where(and(eq(inventoryLots.inventoryItemId, params.inventoryItemId), sql`${inventoryLots.remainingQuantity}::numeric > 0`));
  if ((lotCount?.count ?? 0) === 0) throw new NoLotsError('No lots for this item');
  return planLotConsumption(params);
}

// ─── Transfers between stores ────────────────────────────────────────────────

async function nextTransferCode(date: string, executor: Executor) {
  const prefix = `TRF-${date.replace(/-/g, '')}-`;
  const [row] = await executor
    .select({ total: sql<number>`count(*)::int` })
    .from(stockTransfers)
    .where(ilike(stockTransfers.transferCode, `${prefix}%`));
  return `${prefix}${String((row?.total ?? 0) + 1).padStart(3, '0')}`;
}

/**
 * Move stock between stores. Each lot taken from the source is split: its remaining quantity drops and a
 * new lot with the same cost, expiry and origin is created in the destination. Total stock doesn't change.
 */
export async function transferStock(params: {
  fromLocationId: number;
  toLocationId: number;
  transferDate: string;
  lines: Array<{ inventoryItemId: number; quantity: number }>;
  notes?: string | null;
  userId: number;
}) {
  if (params.fromLocationId === params.toLocationId) throw new StockError('Choose two different stores');
  await assertPeriodOpen(params.transferDate, 'inventory');
  return db.transaction(async (tx) => {
    const locations = await tx.select().from(stockLocations).where(inArray(stockLocations.id, [params.fromLocationId, params.toLocationId]));
    const from = locations.find((l) => l.id === params.fromLocationId);
    const to = locations.find((l) => l.id === params.toLocationId);
    if (!from || !to) throw new StockError('Store not found', 404, 'NOT_FOUND');
    if (to.status !== 'active') throw new StockError(`${to.name} is inactive`);

    const transferCode = await nextTransferCode(params.transferDate, tx);
    const [transfer] = await tx.insert(stockTransfers).values({
      transferCode,
      fromLocationId: from.id,
      toLocationId: to.id,
      transferDate: params.transferDate,
      notes: params.notes ?? null,
      createdBy: params.userId,
    }).returning();

    for (const line of params.lines) {
      const plan = await planLotConsumption({
        inventoryItemId: line.inventoryItemId,
        quantity: line.quantity,
        onlyLocationId: from.id,
        asOf: params.transferDate,
        executor: tx,
      });
      const [item] = await tx.select().from(feedInventory).where(eq(feedInventory.id, line.inventoryItemId)).limit(1);
      for (const part of plan.lotConsumptions) {
        const [source] = await tx.select().from(inventoryLots).where(eq(inventoryLots.id, part.lotId)).limit(1);
        await tx.update(inventoryLots).set({ remainingQuantity: String(part.newRemaining) }).where(eq(inventoryLots.id, part.lotId));
        const [destination] = await tx.insert(inventoryLots).values({
          inventoryItemId: line.inventoryItemId,
          purchaseOrderItemId: source.purchaseOrderItemId,
          lotCode: `${source.lotCode}-T${transfer.id}`,
          receivedQuantity: String(part.quantityUsed),
          remainingQuantity: String(part.quantityUsed),
          costPerUnit: source.costPerUnit,
          receivedDate: source.receivedDate,
          expiryDate: source.expiryDate,
          locationId: to.id,
          parentLotId: source.id,
          notes: `Transferred from ${from.name} (${transferCode})`,
        }).returning();
        await tx.insert(stockTransferLines).values({
          transferId: transfer.id,
          inventoryItemId: line.inventoryItemId,
          sourceLotId: source.id,
          destinationLotId: destination.id,
          quantity: String(part.quantityUsed),
        });
        for (const [movementType, lotId, quantity, balance] of [
          ['transfer_out', source.id, -part.quantityUsed, part.newRemaining],
          ['transfer_in', destination.id, part.quantityUsed, part.quantityUsed],
        ] as const) {
          await postInventoryMovement({
            movementType,
            movementDate: params.transferDate,
            sourceModule: 'inventory',
            sourceEntityType: 'stock_transfer',
            sourceEntityId: transfer.id,
            sourceCodeSnapshot: transferCode,
            inventoryItemId: line.inventoryItemId,
            inventoryLotId: lotId,
            quantity,
            unit: item?.unit ?? 'unit',
            unitCost: part.costPerUnit,
            lineCost: round2(Math.abs(quantity) * part.costPerUnit),
            balanceAfterQuantity: balance,
            balanceScope: 'inventory_lot',
            notes: params.notes ?? null,
            createdBy: params.userId,
          }, tx);
        }
      }
    }
    return transfer;
  });
}

// ─── Balances, expiry and write-offs ─────────────────────────────────────────

/** Stock on hand per store per item (from lots), plus any quantity that predates lot tracking. */
export async function stockBalances(params: { locationId?: number | null; inventoryItemId?: number | null }) {
  const rows = await db
    .select({
      locationId: inventoryLots.locationId,
      locationName: stockLocations.name,
      locationType: stockLocations.locationType,
      inventoryItemId: inventoryLots.inventoryItemId,
      itemName: feedInventory.ingredientName,
      unit: feedInventory.unit,
      quantity: sql<number>`SUM(${inventoryLots.remainingQuantity}::numeric)::float`,
      value: sql<number>`SUM(${inventoryLots.remainingQuantity}::numeric * ${inventoryLots.costPerUnit}::numeric)::float`,
      nextExpiry: sql<string | null>`MIN(${inventoryLots.expiryDate})::text`,
    })
    .from(inventoryLots)
    .innerJoin(stockLocations, eq(inventoryLots.locationId, stockLocations.id))
    .innerJoin(feedInventory, eq(inventoryLots.inventoryItemId, feedInventory.id))
    .where(and(
      gt(inventoryLots.remainingQuantity, '0'),
      params.locationId ? eq(inventoryLots.locationId, params.locationId) : undefined,
      params.inventoryItemId ? eq(inventoryLots.inventoryItemId, params.inventoryItemId) : undefined,
    ))
    .groupBy(inventoryLots.locationId, stockLocations.name, stockLocations.locationType, inventoryLots.inventoryItemId, feedInventory.ingredientName, feedInventory.unit)
    .orderBy(stockLocations.name, feedInventory.ingredientName);
  return rows.map((row) => ({ ...row, quantity: round2(row.quantity), value: round2(row.value) }));
}

export async function expiringLots(params: { withinDays: number; asOf?: string }) {
  const asOf = params.asOf ?? toIsoDate(new Date());
  const until = toIsoDate(new Date(new Date(asOf).getTime() + params.withinDays * 86_400_000));
  const rows = await db
    .select({
      lotId: inventoryLots.id,
      lotCode: inventoryLots.lotCode,
      inventoryItemId: inventoryLots.inventoryItemId,
      itemName: feedInventory.ingredientName,
      unit: feedInventory.unit,
      locationName: stockLocations.name,
      remainingQuantity: inventoryLots.remainingQuantity,
      costPerUnit: inventoryLots.costPerUnit,
      expiryDate: inventoryLots.expiryDate,
    })
    .from(inventoryLots)
    .innerJoin(feedInventory, eq(inventoryLots.inventoryItemId, feedInventory.id))
    .innerJoin(stockLocations, eq(inventoryLots.locationId, stockLocations.id))
    .where(and(isNotNull(inventoryLots.expiryDate), lte(inventoryLots.expiryDate, until), gt(inventoryLots.remainingQuantity, '0')))
    .orderBy(asc(inventoryLots.expiryDate));
  return rows.map((row) => ({
    ...row,
    remainingQuantity: Number(row.remainingQuantity),
    value: round2(Number(row.remainingQuantity) * Number(row.costPerUnit)),
    expired: toIsoDate(row.expiryDate!) < asOf,
    daysLeft: Math.round((new Date(toIsoDate(row.expiryDate!)).getTime() - new Date(asOf).getTime()) / 86_400_000),
  }));
}

/** Remove spoiled or expired stock from a lot. The lost value is recorded on the movement for reporting. */
export async function writeOffLot(params: { lotId: number; quantity?: number | null; reason: string; date?: string; userId: number }) {
  const date = params.date ?? toIsoDate(new Date());
  await assertPeriodOpen(date, 'inventory');
  return db.transaction(async (tx) => {
    const [lot] = await tx.select().from(inventoryLots).where(eq(inventoryLots.id, params.lotId)).limit(1);
    if (!lot) throw new StockError('Lot not found', 404, 'NOT_FOUND');
    const remaining = Number(lot.remainingQuantity);
    const quantity = params.quantity ?? remaining;
    if (quantity <= 0 || quantity > remaining + 1e-9) throw new StockError(`Only ${remaining} left in this lot`);
    const [item] = await tx.select().from(feedInventory).where(eq(feedInventory.id, lot.inventoryItemId)).limit(1);
    const after = round2(remaining - quantity);
    await tx.update(inventoryLots).set({ remainingQuantity: String(after) }).where(eq(inventoryLots.id, lot.id));
    const itemAfter = round2(Number(item.quantity) - quantity);
    await tx.update(feedInventory).set({ quantity: String(Math.max(0, itemAfter)), updatedAt: new Date() }).where(eq(feedInventory.id, item.id));
    await tx.insert(inventoryAuditTrail).values({
      inventoryItemId: item.id,
      changeType: 'write_off',
      previousQuantity: item.quantity,
      changeQuantity: String(-quantity),
      newQuantity: String(Math.max(0, itemAfter)),
      referenceId: lot.id,
      referenceType: 'inventory_lot',
      notes: params.reason,
      lotId: lot.id,
      costAtTime: lot.costPerUnit,
      performedBy: params.userId,
    });
    await postInventoryMovement({
      movementType: 'write_off',
      movementDate: date,
      sourceModule: 'inventory',
      sourceEntityType: 'inventory_lot',
      sourceEntityId: lot.id,
      sourceCodeSnapshot: lot.lotCode,
      inventoryItemId: item.id,
      inventoryLotId: lot.id,
      quantity: -quantity,
      unit: item.unit,
      unitCost: Number(lot.costPerUnit),
      lineCost: round2(quantity * Number(lot.costPerUnit)),
      balanceAfterQuantity: after,
      balanceScope: 'inventory_lot',
      notes: params.reason,
      createdBy: params.userId,
    }, tx);
    return { lotId: lot.id, quantity, value: round2(quantity * Number(lot.costPerUnit)) };
  });
}
