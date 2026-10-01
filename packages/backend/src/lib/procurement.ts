import { and, desc, eq, ilike, inArray, ne, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  batchInventoryConsumptions,
  batches,
  costCentres,
  feedInventory,
  inventoryAuditTrail,
  inventoryItemTypes,
  inventoryLots,
  purchaseOrderItems,
  purchaseOrders,
  purchaseRequisitionItems,
  purchaseRequisitions,
  stockLocations,
  supplierInvoices,
  suppliers,
  users,
} from '../db/schema';
import { postInventoryMovement } from './inventory-movements';
import { assertPeriodOpen } from './period-locks';
import { toIsoDate } from './bird-days';
import { StockError, ensureFarmStore, generateLotCode, getLocationByCode } from './stock';
import { defaultPurchaseCostCentreId } from './finance-tags';

type Executor = typeof db | any;
const round2 = (value: number) => Math.round(value * 100) / 100;

export class ProcurementError extends StockError {}

// ─── Where received goods go ─────────────────────────────────────────────────

/** Explicit store → the PO's delivery store → feed to the mill, farm purchases to that farm's store → Main store. */
async function resolveReceiveLocation(params: { locationId?: number | null; purchaseOrder: typeof purchaseOrders.$inferSelect; isFeed: boolean }, tx: Executor) {
  const explicit = params.locationId ?? params.purchaseOrder.deliveryLocationId;
  if (explicit) {
    const [location] = await tx.select().from(stockLocations).where(eq(stockLocations.id, explicit)).limit(1);
    if (!location) throw new ProcurementError('Store not found', 404, 'NOT_FOUND');
    return location as typeof stockLocations.$inferSelect;
  }
  if (params.isFeed) return getLocationByCode('MILL', tx);
  if (params.purchaseOrder.costCentreId) {
    const [centre] = await tx.select().from(costCentres).where(eq(costCentres.id, params.purchaseOrder.costCentreId)).limit(1);
    if (centre?.siteId) return ensureFarmStore(centre.siteId, tx);
    if (centre?.centreType === 'mill') return getLocationByCode('MILL', tx);
  }
  return getLocationByCode('MAIN', tx);
}

async function weightedAverageCost(inventoryItemId: number, tx: Executor) {
  const [row] = await tx
    .select({
      value: sql<string>`COALESCE(SUM(${inventoryLots.remainingQuantity}::numeric * ${inventoryLots.costPerUnit}::numeric), 0)`,
      qty: sql<string>`COALESCE(SUM(${inventoryLots.remainingQuantity}::numeric), 0)`,
    })
    .from(inventoryLots)
    .where(and(eq(inventoryLots.inventoryItemId, inventoryItemId), sql`${inventoryLots.remainingQuantity}::numeric > 0`));
  const qty = Number(row?.qty ?? 0);
  return qty > 0 ? round2(Number(row.value) / qty) : 0;
}

// ─── Receiving a purchase order ───────────────────────────────────────────────

export interface ReceiveLine {
  itemId: number;
  receivedQuantity: number;
  expiryDate?: string | null;
  batchAllocations?: Array<{ batchId: number; quantity: number; notes?: string | null }>;
}

/**
 * Receive goods against a purchase order. Every line is checked before anything is written, and the whole
 * receipt is one transaction: either all lines are booked in or none are.
 */
export async function receivePurchaseOrder(params: { purchaseOrderId: number; lines: ReceiveLine[]; locationId?: number | null; receivedDate?: string; userId: number }) {
  const today = params.receivedDate ?? toIsoDate(new Date());
  await assertPeriodOpen(today, 'inventory');

  return db.transaction(async (tx) => {
    const [purchaseOrder] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, params.purchaseOrderId)).limit(1);
    if (!purchaseOrder) throw new ProcurementError('Purchase order not found', 404, 'NOT_FOUND');
    if (!['submitted', 'partially_received'].includes(purchaseOrder.status)) {
      throw new ProcurementError('Only submitted or part-received orders can be received', 400, 'INVALID_PO_STATUS');
    }

    // 1. Check every line first.
    const checked = [];
    const seen = new Set<number>();
    for (const line of params.lines) {
      if (seen.has(line.itemId)) throw new ProcurementError('Each order line can appear once per receipt', 400, 'DUPLICATE_LINE');
      seen.add(line.itemId);
      const [poItem] = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.id, line.itemId)).limit(1);
      if (!poItem || poItem.purchaseOrderId !== purchaseOrder.id) throw new ProcurementError(`Order line ${line.itemId} is not on this order`, 400, 'PO_ITEM_INVALID');
      const [item] = await tx
        .select({
          id: feedInventory.id,
          name: feedInventory.ingredientName,
          quantity: feedInventory.quantity,
          costPerUnit: feedInventory.costPerUnit,
          isFeed: inventoryItemTypes.isFeed,
          allowsBatchAllocation: inventoryItemTypes.allowsBatchAllocation,
        })
        .from(feedInventory)
        .innerJoin(inventoryItemTypes, eq(feedInventory.itemTypeId, inventoryItemTypes.id))
        .where(eq(feedInventory.id, poItem.inventoryItemId))
        .limit(1);
      if (!item) throw new ProcurementError('Stock item not found', 404, 'NOT_FOUND');

      const outstanding = round2(Number(poItem.orderedQuantity) - Number(poItem.receivedQuantity));
      if (line.receivedQuantity > outstanding + 1e-9) {
        throw new ProcurementError(`${item.name}: only ${outstanding} ${poItem.unit} still to receive`, 400, 'EXCEEDS_ORDERED_QTY');
      }
      if (line.expiryDate && line.expiryDate < today) {
        throw new ProcurementError(`${item.name}: expiry date ${line.expiryDate} has already passed`, 400, 'EXPIRED_ON_RECEIPT');
      }
      const allocations = line.batchAllocations ?? [];
      const allocated = round2(allocations.reduce((sum, a) => sum + a.quantity, 0));
      if (allocated > line.receivedQuantity + 1e-9) throw new ProcurementError(`${item.name}: more allocated to batches than received`, 400, 'ALLOCATION_EXCEEDS_RECEIPT');
      if (allocated > 0 && (item.isFeed || !item.allowsBatchAllocation)) {
        throw new ProcurementError(`${item.name} can't be allocated straight to batches`, 400, 'INVALID_BATCH_ALLOCATION');
      }
      for (const allocation of allocations) {
        const [batch] = await tx.select({ id: batches.id, status: batches.status, code: batches.batchCode }).from(batches).where(eq(batches.id, allocation.batchId)).limit(1);
        if (!batch) throw new ProcurementError(`Batch ${allocation.batchId} not found`, 404, 'BATCH_NOT_FOUND');
        if (batch.status === 'closed') throw new ProcurementError(`Batch ${batch.code} is closed`, 400, 'BATCH_CLOSED');
      }
      checked.push({ line, poItem, item, allocations, allocated });
    }

    // 2. Book everything in.
    const lotsCreated = [];
    for (const { line, poItem, item, allocations, allocated } of checked) {
      const location = await resolveReceiveLocation({ locationId: params.locationId, purchaseOrder, isFeed: item.isFeed }, tx);
      await tx.update(purchaseOrderItems)
        .set({ receivedQuantity: String(round2(Number(poItem.receivedQuantity) + line.receivedQuantity)) })
        .where(eq(purchaseOrderItems.id, poItem.id));

      const lotCode = await generateLotCode(today, 'LOT', tx);
      const unitCost = Number(poItem.unitPrice);
      const [lot] = await tx.insert(inventoryLots).values({
        inventoryItemId: item.id,
        purchaseOrderItemId: poItem.id,
        lotCode,
        receivedQuantity: String(line.receivedQuantity),
        remainingQuantity: String(round2(line.receivedQuantity - allocated)),
        costPerUnit: poItem.unitPrice,
        receivedDate: today,
        expiryDate: line.expiryDate ?? null,
        locationId: location.id,
        notes: allocated > 0 ? 'Received with direct batch allocation' : null,
      }).returning();

      const before = Number(item.quantity);
      const afterReceipt = round2(before + line.receivedQuantity);
      await tx.insert(inventoryAuditTrail).values({
        inventoryItemId: item.id,
        changeType: 'purchase_receive',
        previousQuantity: String(before),
        changeQuantity: String(line.receivedQuantity),
        newQuantity: String(afterReceipt),
        referenceId: purchaseOrder.id,
        referenceType: 'purchase_order',
        notes: `PO ${purchaseOrder.orderCode} · ${lotCode} into ${location.name}`,
        lotId: lot.id,
        costAtTime: poItem.unitPrice,
        performedBy: params.userId,
      });
      await postInventoryMovement({
        movementType: 'purchase_receive',
        movementDate: today,
        sourceModule: 'inventory',
        sourceEntityType: 'purchase_order',
        sourceEntityId: purchaseOrder.id,
        sourceCodeSnapshot: purchaseOrder.orderCode,
        inventoryItemId: item.id,
        inventoryLotId: lot.id,
        purchaseOrderId: purchaseOrder.id,
        purchaseOrderItemId: poItem.id,
        quantity: line.receivedQuantity,
        unit: poItem.unit,
        unitCost,
        lineCost: round2(line.receivedQuantity * unitCost),
        balanceAfterQuantity: line.receivedQuantity,
        balanceScope: 'inventory_lot',
        notes: lot.notes,
        createdBy: params.userId,
      }, tx);

      let stock = afterReceipt;
      let lotBalance = line.receivedQuantity;
      for (const allocation of allocations) {
        const lineCost = round2(allocation.quantity * unitCost);
        stock = round2(stock - allocation.quantity);
        lotBalance = round2(lotBalance - allocation.quantity);
        await tx.insert(batchInventoryConsumptions).values({
          batchId: allocation.batchId,
          inventoryItemId: item.id,
          inventoryLotId: lot.id,
          purchaseOrderItemId: poItem.id,
          quantity: String(allocation.quantity),
          unit: poItem.unit,
          unitCost: poItem.unitPrice,
          lineCost: String(lineCost),
          consumptionDate: today,
          referenceType: 'purchase_order',
          referenceId: purchaseOrder.id,
          notes: allocation.notes ?? null,
          createdBy: params.userId,
        });
        await postInventoryMovement({
          movementType: 'batch_consume',
          movementDate: today,
          sourceModule: 'inventory',
          sourceEntityType: 'purchase_order',
          sourceEntityId: purchaseOrder.id,
          sourceCodeSnapshot: purchaseOrder.orderCode,
          inventoryItemId: item.id,
          inventoryLotId: lot.id,
          purchaseOrderId: purchaseOrder.id,
          purchaseOrderItemId: poItem.id,
          batchId: allocation.batchId,
          quantity: -allocation.quantity,
          unit: poItem.unit,
          unitCost,
          lineCost,
          balanceAfterQuantity: lotBalance,
          balanceScope: 'inventory_lot',
          notes: allocation.notes ?? null,
          createdBy: params.userId,
        }, tx);
      }

      const average = await weightedAverageCost(item.id, tx);
      await tx.update(feedInventory).set({
        quantity: String(stock),
        costPerUnit: String(average || Number(item.costPerUnit)),
        lastRestockDate: today,
        updatedAt: new Date(),
      }).where(eq(feedInventory.id, item.id));

      lotsCreated.push({ lotCode, inventoryItemId: item.id, locationName: location.name, quantityReceived: line.receivedQuantity, quantityAllocatedToBatches: allocated, expiryDate: line.expiryDate ?? null });
    }

    const lines = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrder.id));
    const all = lines.every((l: typeof purchaseOrderItems.$inferSelect) => Number(l.receivedQuantity) >= Number(l.orderedQuantity));
    const any = lines.some((l: typeof purchaseOrderItems.$inferSelect) => Number(l.receivedQuantity) > 0);
    const [updated] = await tx.update(purchaseOrders).set({
      status: all ? 'received' : any ? 'partially_received' : purchaseOrder.status,
      actualDeliveryDate: purchaseOrder.actualDeliveryDate ?? today,
      updatedAt: new Date(),
    }).where(eq(purchaseOrders.id, purchaseOrder.id)).returning();

    // Re-check invoices already raised against this order now more has arrived.
    await refreshInvoiceMatches(purchaseOrder.id, tx);
    return { ...updated, lotsCreated };
  });
}

// ─── Three-way match: order ↔ goods received ↔ invoice ───────────────────────

/** Tolerance before an invoice counts as not matching what was received: 1% or Rs 100, whichever is larger. */
export function matchTolerance(receivedValue: number) {
  return Math.max(100, receivedValue * 0.01);
}

export async function computeInvoiceMatch(params: { purchaseOrderId: number | null; invoiceAmount: number; excludeInvoiceId?: number | null }, executor: Executor = db) {
  if (!params.purchaseOrderId) return { matchStatus: 'no_po' as const, receivedValue: null, matchVariance: null };
  const [received] = await executor
    .select({ value: sql<number>`COALESCE(SUM(${purchaseOrderItems.receivedQuantity}::numeric * ${purchaseOrderItems.unitPrice}::numeric), 0)::float` })
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, params.purchaseOrderId));
  const [invoiced] = await executor
    .select({ value: sql<number>`COALESCE(SUM(${supplierInvoices.invoiceAmount}::numeric), 0)::float` })
    .from(supplierInvoices)
    .where(and(
      eq(supplierInvoices.purchaseOrderId, params.purchaseOrderId),
      ne(supplierInvoices.status, 'rejected'),
      params.excludeInvoiceId ? ne(supplierInvoices.id, params.excludeInvoiceId) : undefined,
    ));
  const receivedValue = round2(received?.value ?? 0);
  const totalInvoiced = round2((invoiced?.value ?? 0) + params.invoiceAmount);
  const variance = round2(totalInvoiced - receivedValue);
  const tolerance = matchTolerance(receivedValue);
  const matchStatus = Math.abs(variance) <= tolerance ? 'matched' : variance > 0 ? 'over_billed' : 'under_billed';
  return { matchStatus, receivedValue, matchVariance: variance };
}

async function refreshInvoiceMatches(purchaseOrderId: number, tx: Executor) {
  const invoices = await tx.select().from(supplierInvoices).where(and(eq(supplierInvoices.purchaseOrderId, purchaseOrderId), ne(supplierInvoices.status, 'rejected')));
  for (const invoice of invoices) {
    const match = await computeInvoiceMatch({ purchaseOrderId, invoiceAmount: Number(invoice.invoiceAmount), excludeInvoiceId: invoice.id }, tx);
    await tx.update(supplierInvoices).set({
      matchStatus: match.matchStatus,
      receivedValue: match.receivedValue != null ? String(match.receivedValue) : null,
      matchVariance: match.matchVariance != null ? String(match.matchVariance) : null,
    }).where(eq(supplierInvoices.id, invoice.id));
  }
}

// ─── Requisitions: a farm or the mill asks, the office buys ───────────────────

async function nextRequisitionCode(executor: Executor) {
  const prefix = `REQ-${toIsoDate(new Date()).replace(/-/g, '')}-`;
  const [row] = await executor.select({ total: sql<number>`count(*)::int` }).from(purchaseRequisitions).where(ilike(purchaseRequisitions.requisitionCode, `${prefix}%`));
  return `${prefix}${String((row?.total ?? 0) + 1).padStart(3, '0')}`;
}

export async function createRequisition(params: {
  costCentreId: number;
  deliveryLocationId?: number | null;
  neededBy?: string | null;
  notes?: string | null;
  items: Array<{ inventoryItemId: number; quantity: number; notes?: string | null }>;
  userId: number;
}) {
  return db.transaction(async (tx) => {
    const itemIds = params.items.map((i) => i.inventoryItemId);
    const found = await tx.select({ id: feedInventory.id }).from(feedInventory).where(inArray(feedInventory.id, itemIds));
    if (found.length !== new Set(itemIds).size) throw new ProcurementError('One of the stock items was not found', 404, 'NOT_FOUND');
    const [requisition] = await tx.insert(purchaseRequisitions).values({
      requisitionCode: await nextRequisitionCode(tx),
      requestedBy: params.userId,
      costCentreId: params.costCentreId,
      deliveryLocationId: params.deliveryLocationId ?? null,
      neededBy: params.neededBy ?? null,
      notes: params.notes ?? null,
      status: 'submitted',
    }).returning();
    await tx.insert(purchaseRequisitionItems).values(params.items.map((item) => ({
      requisitionId: requisition.id,
      inventoryItemId: item.inventoryItemId,
      quantity: String(item.quantity),
      notes: item.notes ?? null,
    })));
    return requisition;
  });
}

export async function reviewRequisition(params: { requisitionId: number; status: 'approved' | 'rejected'; reviewNotes?: string | null; userId: number }) {
  const [requisition] = await db.select().from(purchaseRequisitions).where(eq(purchaseRequisitions.id, params.requisitionId)).limit(1);
  if (!requisition) throw new ProcurementError('Requisition not found', 404, 'NOT_FOUND');
  if (requisition.status !== 'submitted') throw new ProcurementError(`This requisition is already ${requisition.status}`);
  const [updated] = await db.update(purchaseRequisitions).set({
    status: params.status,
    reviewedBy: params.userId,
    reviewedAt: new Date(),
    reviewNotes: params.reviewNotes ?? null,
    updatedAt: new Date(),
  }).where(eq(purchaseRequisitions.id, requisition.id)).returning();
  return updated;
}

async function nextOrderCode(date: string, executor: Executor) {
  const prefix = `PO-${date.replace(/-/g, '')}-`;
  const [row] = await executor.select({ total: sql<number>`count(*)::int` }).from(purchaseOrders).where(ilike(purchaseOrders.orderCode, `${prefix}%`));
  return `${prefix}${String((row?.total ?? 0) + 1).padStart(3, '0')}`;
}

/** Turn an approved requisition into a draft purchase order with the supplier and prices filled in. */
export async function convertRequisitionToOrder(params: {
  requisitionId: number;
  supplierId: number;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  prices: Array<{ inventoryItemId: number; unitPrice: number }>;
  userId: number;
}) {
  return db.transaction(async (tx) => {
    const [requisition] = await tx.select().from(purchaseRequisitions).where(eq(purchaseRequisitions.id, params.requisitionId)).limit(1);
    if (!requisition) throw new ProcurementError('Requisition not found', 404, 'NOT_FOUND');
    if (requisition.status !== 'approved') throw new ProcurementError('Only approved requisitions can be ordered');
    const [supplier] = await tx.select().from(suppliers).where(eq(suppliers.id, params.supplierId)).limit(1);
    if (!supplier || supplier.status !== 'active') throw new ProcurementError('Supplier must exist and be active');

    const items = await tx
      .select({ id: purchaseRequisitionItems.id, inventoryItemId: purchaseRequisitionItems.inventoryItemId, quantity: purchaseRequisitionItems.quantity, unit: feedInventory.unit })
      .from(purchaseRequisitionItems)
      .innerJoin(feedInventory, eq(purchaseRequisitionItems.inventoryItemId, feedInventory.id))
      .where(eq(purchaseRequisitionItems.requisitionId, requisition.id));
    const priceOf = new Map(params.prices.map((p) => [p.inventoryItemId, p.unitPrice]));
    for (const item of items) {
      if (!(priceOf.get(item.inventoryItemId)! > 0)) throw new ProcurementError('Enter a price for every item');
    }
    const total = round2(items.reduce((sum: number, item: { inventoryItemId: number; quantity: string }) => sum + Number(item.quantity) * priceOf.get(item.inventoryItemId)!, 0));

    const [order] = await tx.insert(purchaseOrders).values({
      orderCode: await nextOrderCode(params.orderDate, tx),
      supplierId: supplier.id,
      costCentreId: requisition.costCentreId ?? await defaultPurchaseCostCentreId(items.map((i: { inventoryItemId: number }) => i.inventoryItemId), tx),
      deliveryLocationId: requisition.deliveryLocationId,
      requisitionId: requisition.id,
      orderDate: params.orderDate,
      expectedDeliveryDate: params.expectedDeliveryDate ?? null,
      status: 'draft',
      totalCost: String(total),
      notes: `From requisition ${requisition.requisitionCode}`,
      createdBy: params.userId,
    }).returning();
    await tx.insert(purchaseOrderItems).values(items.map((item: { inventoryItemId: number; quantity: string; unit: string }) => ({
      purchaseOrderId: order.id,
      inventoryItemId: item.inventoryItemId,
      orderedQuantity: item.quantity,
      unitPrice: String(priceOf.get(item.inventoryItemId)),
      unit: item.unit,
    })));
    await tx.update(purchaseRequisitions).set({ status: 'ordered', purchaseOrderId: order.id, updatedAt: new Date() }).where(eq(purchaseRequisitions.id, requisition.id));
    return order;
  });
}

export async function listRequisitions(params: { status?: string | null; costCentreId?: number | null }) {
  const rows = await db
    .select({
      id: purchaseRequisitions.id,
      requisitionCode: purchaseRequisitions.requisitionCode,
      status: purchaseRequisitions.status,
      neededBy: purchaseRequisitions.neededBy,
      notes: purchaseRequisitions.notes,
      reviewNotes: purchaseRequisitions.reviewNotes,
      createdAt: purchaseRequisitions.createdAt,
      costCentreId: purchaseRequisitions.costCentreId,
      costCentreName: costCentres.name,
      deliveryLocationId: purchaseRequisitions.deliveryLocationId,
      deliveryLocationName: stockLocations.name,
      requestedByName: users.fullName,
      purchaseOrderId: purchaseRequisitions.purchaseOrderId,
      purchaseOrderCode: purchaseOrders.orderCode,
    })
    .from(purchaseRequisitions)
    .innerJoin(costCentres, eq(purchaseRequisitions.costCentreId, costCentres.id))
    .innerJoin(users, eq(purchaseRequisitions.requestedBy, users.id))
    .leftJoin(stockLocations, eq(purchaseRequisitions.deliveryLocationId, stockLocations.id))
    .leftJoin(purchaseOrders, eq(purchaseRequisitions.purchaseOrderId, purchaseOrders.id))
    .where(and(
      params.status ? eq(purchaseRequisitions.status, params.status) : undefined,
      params.costCentreId ? eq(purchaseRequisitions.costCentreId, params.costCentreId) : undefined,
    ))
    .orderBy(desc(purchaseRequisitions.createdAt));
  const items = rows.length
    ? await db
      .select({
        requisitionId: purchaseRequisitionItems.requisitionId,
        inventoryItemId: purchaseRequisitionItems.inventoryItemId,
        itemName: feedInventory.ingredientName,
        unit: feedInventory.unit,
        quantity: purchaseRequisitionItems.quantity,
        lastCost: feedInventory.costPerUnit,
        notes: purchaseRequisitionItems.notes,
      })
      .from(purchaseRequisitionItems)
      .innerJoin(feedInventory, eq(purchaseRequisitionItems.inventoryItemId, feedInventory.id))
      .where(inArray(purchaseRequisitionItems.requisitionId, rows.map((r) => r.id)))
    : [];
  return rows.map((row) => ({ ...row, items: items.filter((item) => item.requisitionId === row.id) }));
}
