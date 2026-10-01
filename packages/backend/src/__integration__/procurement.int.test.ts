import { eq } from 'drizzle-orm';
import { db } from '../db';
import { feedInventory, inventoryLots, purchaseOrderItems, purchaseOrders, stockLocations, supplierInvoices } from '../db/schema';
import { ensureFarmStore, expiringLots, getLocationByCode, planLotConsumption, StockError, stockBalances, transferStock, writeOffLot } from '../lib/stock';
import { computeInvoiceMatch, convertRequisitionToOrder, createRequisition, receivePurchaseOrder, reviewRequisition } from '../lib/procurement';
import { costCentreId, createPurchaseOrder, createSiteWithBatch, createUser, resetDatabase } from './fixtures';

beforeEach(async () => {
  await resetDatabase();
});

async function submittedOrder(lines: Parameters<typeof createPurchaseOrder>[0], costCentre?: number) {
  const { supplier, po } = await createPurchaseOrder(lines, costCentre);
  await db.update(purchaseOrders).set({ status: 'submitted' }).where(eq(purchaseOrders.id, po.id));
  const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, po.id)).orderBy(purchaseOrderItems.id);
  return { supplier, po, items };
}

describe('receiving purchase orders', () => {
  it('books goods into the right store with expiry, and is all-or-nothing', async () => {
    const user = await createUser();
    const { site, centre } = await createSiteWithBatch();
    await ensureFarmStore(site.id);
    const { po, items } = await submittedOrder([
      { typeCategory: 'health', isFeed: false, quantity: 100, unitPrice: 20 },
      { typeCategory: 'health', isFeed: false, quantity: 50, unitPrice: 10 },
    ], centre.id);

    // Second line asks for more than ordered → nothing at all is booked
    await expect(receivePurchaseOrder({
      purchaseOrderId: po.id,
      lines: [{ itemId: items[0].id, receivedQuantity: 100 }, { itemId: items[1].id, receivedQuantity: 60 }],
      userId: user.id,
    })).rejects.toThrow(/only 50/);
    expect(await db.select().from(inventoryLots)).toHaveLength(0);
    const [untouched] = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.id, items[0].id));
    expect(Number(untouched.receivedQuantity)).toBe(0);

    const result = await receivePurchaseOrder({
      purchaseOrderId: po.id,
      lines: [{ itemId: items[0].id, receivedQuantity: 100, expiryDate: '2099-01-31' }],
      userId: user.id,
    });
    expect(result.status).toBe('partially_received');
    const [lot] = await db.select().from(inventoryLots);
    const [farmStore] = await db.select().from(stockLocations).where(eq(stockLocations.siteId, site.id));
    expect(lot.locationId).toBe(farmStore.id);
    expect(lot.expiryDate).toBe('2099-01-31');
    const [item] = await db.select().from(feedInventory).where(eq(feedInventory.id, items[0].inventoryItemId));
    expect(Number(item.quantity)).toBe(100);
  });

  it('sends feed raw materials to the mill store', async () => {
    const user = await createUser();
    const { po, items } = await submittedOrder([{ typeCategory: 'feed', isFeed: true, quantity: 1000, unitPrice: 50 }]);
    await receivePurchaseOrder({ purchaseOrderId: po.id, lines: [{ itemId: items[0].id, receivedQuantity: 1000 }], userId: user.id });
    const [lot] = await db.select().from(inventoryLots);
    expect(lot.locationId).toBe((await getLocationByCode('MILL')).id);
  });
});

describe('stores, expiry and transfers', () => {
  async function stockedItem() {
    const user = await createUser();
    const { po, items } = await submittedOrder([{ typeCategory: 'health', isFeed: false, quantity: 300, unitPrice: 10 }]);
    const main = await getLocationByCode('MAIN');
    await receivePurchaseOrder({ purchaseOrderId: po.id, locationId: main.id, lines: [{ itemId: items[0].id, receivedQuantity: 300 }], userId: user.id });
    return { user, itemId: items[0].inventoryItemId, main };
  }

  it('uses the soonest-expiring lot first and never uses expired stock', async () => {
    const { itemId } = await stockedItem();
    const [lot] = await db.select().from(inventoryLots);
    // Split the stock: 100 expired, 100 expiring soon, 100 expiring later
    await db.update(inventoryLots).set({ remainingQuantity: '100', expiryDate: '2099-12-31' }).where(eq(inventoryLots.id, lot.id));
    await db.insert(inventoryLots).values([
      { inventoryItemId: itemId, lotCode: 'LOT-EXPIRED', receivedQuantity: '100', remainingQuantity: '100', costPerUnit: '10', receivedDate: '2026-01-01', expiryDate: '2026-02-01', locationId: lot.locationId },
      { inventoryItemId: itemId, lotCode: 'LOT-SOON', receivedQuantity: '100', remainingQuantity: '100', costPerUnit: '12', receivedDate: '2026-09-01', expiryDate: '2026-10-15', locationId: lot.locationId },
    ]);

    const plan = await planLotConsumption({ inventoryItemId: itemId, quantity: 150, asOf: '2026-10-01' });
    expect(plan.lotConsumptions.map((p) => [p.lotCode, p.quantityUsed])).toEqual([['LOT-SOON', 100], [lot.lotCode, 50]]);
    await expect(planLotConsumption({ inventoryItemId: itemId, quantity: 250, asOf: '2026-10-01' }))
      .rejects.toThrow(/200 available.*100 more is expired/);

    const expiring = await expiringLots({ withinDays: 30, asOf: '2026-10-01' });
    expect(expiring.map((l) => [l.lotCode, l.expired])).toEqual([['LOT-EXPIRED', true], ['LOT-SOON', false]]);
  });

  it('moves stock between stores without changing the total, and writes off spoiled stock', async () => {
    const { user, itemId, main } = await stockedItem();
    const { site } = await createSiteWithBatch();
    const farmStore = await ensureFarmStore(site.id);

    await transferStock({ fromLocationId: main.id, toLocationId: farmStore.id, transferDate: '2026-10-01', lines: [{ inventoryItemId: itemId, quantity: 120 }], userId: user.id });
    const balances = await stockBalances({ inventoryItemId: itemId });
    expect(balances.map((b) => [b.locationName, b.quantity])).toEqual(expect.arrayContaining([['Main store', 180], [farmStore.name, 120]]));
    const [item] = await db.select().from(feedInventory).where(eq(feedInventory.id, itemId));
    expect(Number(item.quantity)).toBe(300);

    await expect(transferStock({ fromLocationId: farmStore.id, toLocationId: main.id, transferDate: '2026-10-01', lines: [{ inventoryItemId: itemId, quantity: 500 }], userId: user.id }))
      .rejects.toBeInstanceOf(StockError);

    const farmLot = (await db.select().from(inventoryLots).where(eq(inventoryLots.locationId, farmStore.id)))[0];
    const result = await writeOffLot({ lotId: farmLot.id, quantity: 20, reason: 'Broken vials', userId: user.id, date: '2026-10-01' });
    expect(result.value).toBe(200);
    const [after] = await db.select().from(feedInventory).where(eq(feedInventory.id, itemId));
    expect(Number(after.quantity)).toBe(280);
  });
});

describe('requisitions and invoice matching', () => {
  it('turns an approved requisition into a draft order', async () => {
    const user = await createUser();
    const { centre } = await createSiteWithBatch();
    const { items } = await submittedOrder([{ typeCategory: 'health', isFeed: false, quantity: 1, unitPrice: 1 }]);
    const { supplier } = await createPurchaseOrder([]);

    const requisition = await createRequisition({ costCentreId: centre.id, items: [{ inventoryItemId: items[0].inventoryItemId, quantity: 40 }], userId: user.id });
    await expect(convertRequisitionToOrder({ requisitionId: requisition.id, supplierId: supplier.id, orderDate: '2026-10-01', prices: [{ inventoryItemId: items[0].inventoryItemId, unitPrice: 15 }], userId: user.id }))
      .rejects.toThrow(/approved/);
    await reviewRequisition({ requisitionId: requisition.id, status: 'approved', userId: user.id });
    const order = await convertRequisitionToOrder({ requisitionId: requisition.id, supplierId: supplier.id, orderDate: '2026-10-01', prices: [{ inventoryItemId: items[0].inventoryItemId, unitPrice: 15 }], userId: user.id });
    expect(order).toEqual(expect.objectContaining({ status: 'draft', totalCost: '600.00', costCentreId: centre.id, requisitionId: requisition.id }));
  });

  it('flags invoices for more than the goods received', async () => {
    const user = await createUser();
    const { supplier, po, items } = await submittedOrder([{ typeCategory: 'health', isFeed: false, quantity: 100, unitPrice: 100 }], await costCentreId('ADMIN'));
    await receivePurchaseOrder({ purchaseOrderId: po.id, lines: [{ itemId: items[0].id, receivedQuantity: 50 }], userId: user.id });

    expect(await computeInvoiceMatch({ purchaseOrderId: po.id, invoiceAmount: 5000 })).toEqual({ matchStatus: 'matched', receivedValue: 5000, matchVariance: 0 });
    expect((await computeInvoiceMatch({ purchaseOrderId: po.id, invoiceAmount: 10000 })).matchStatus).toBe('over_billed');
    expect((await computeInvoiceMatch({ purchaseOrderId: null, invoiceAmount: 1 })).matchStatus).toBe('no_po');

    // An over-billed invoice becomes matched once the rest of the goods arrive
    const [invoice] = await db.insert(supplierInvoices).values({
      invoiceCode: 'INV-T1', supplierId: supplier.id, purchaseOrderId: po.id, invoiceReference: 'A1', invoiceDate: '2026-10-01', dueDate: '2026-10-31',
      invoiceAmount: '10000', matchStatus: 'over_billed', createdBy: user.id,
    }).returning();
    await receivePurchaseOrder({ purchaseOrderId: po.id, lines: [{ itemId: items[0].id, receivedQuantity: 50 }], userId: user.id });
    const [rechecked] = await db.select().from(supplierInvoices).where(eq(supplierInvoices.id, invoice.id));
    expect(rechecked.matchStatus).toBe('matched');
  });
});
