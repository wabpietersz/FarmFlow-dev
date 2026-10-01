import { sql } from 'drizzle-orm';
import { db } from '../db';
import {
  batches,
  buyers,
  cages,
  costCentres,
  employees,
  feedInventory,
  financeAccounts,
  financeCategories,
  inventoryItemTypes,
  purchaseOrderItems,
  purchaseOrders,
  sales,
  sites,
  stockLocations,
  suppliers,
  treasuryTransactionEntries,
  users,
} from '../db/schema';
import { ensureSiteCostCentre } from '../lib/finance-tags';
import { eq } from 'drizzle-orm';

/** Wipe all data except the system finance categories, then restore the Mill/Admin cost centres. */
export async function resetDatabase() {
  const tables = await db.execute<{ tablename: string }>(sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT IN ('finance_categories')
  `);
  const names = (tables as unknown as Array<{ tablename: string }>).map((row) => `"${row.tablename}"`);
  if (names.length > 0) {
    await db.execute(sql.raw(`TRUNCATE ${names.join(', ')} RESTART IDENTITY CASCADE`));
  }
  await db.execute(sql`DELETE FROM finance_categories WHERE is_system = false`);
  await db.insert(costCentres).values([
    { code: 'MILL', name: 'Feed Mill', centreType: 'mill' },
    { code: 'ADMIN', name: 'Admin / Head Office', centreType: 'admin' },
  ]);
  await db.insert(stockLocations).values([
    { code: 'MAIN', name: 'Main store', locationType: 'central' },
    { code: 'MILL', name: 'Feed mill store', locationType: 'mill_store' },
  ]);
}

export async function categoryId(code: string) {
  const [row] = await db.select().from(financeCategories).where(eq(financeCategories.code, code)).limit(1);
  if (!row) throw new Error(`No category ${code}`);
  return row.id;
}

export async function costCentreId(code: string) {
  const [row] = await db.select().from(costCentres).where(eq(costCentres.code, code)).limit(1);
  if (!row) throw new Error(`No cost centre ${code}`);
  return row.id;
}

let counter = 0;
const unique = (prefix: string) => `${prefix}-${++counter}-${Date.now()}`;

export async function createUser(overrides: Partial<typeof users.$inferInsert> = {}) {
  const [user] = await db.insert(users).values({
    firebaseUid: unique('uid'),
    email: `${unique('user')}@test.local`,
    fullName: 'Test User',
    userRole: 'system_admin',
    ...overrides,
  }).returning();
  return user;
}

export async function createSiteWithBatch(name = unique('Farm')) {
  const [site] = await db.insert(sites).values({ siteName: name, location: 'Test', capacity: 10000 }).returning();
  const centre = await ensureSiteCostCentre(site.id);
  const [cage] = await db.insert(cages).values({ siteId: site.id, cageNumber: 'H1', capacity: 5000 }).returning();
  const [batch] = await db.insert(batches).values({
    batchCode: unique('B'),
    siteId: site.id,
    cageId: cage.id,
    chicksPlaced: 5000,
    placementDate: '2026-09-01',
    status: 'growing',
  }).returning();
  return { site, centre, cage, batch };
}

export async function createAccount(accountType: 'bank' | 'current' | 'cash' | 'petty_cash' = 'bank', openingBalance = 1_000_000) {
  const [account] = await db.insert(financeAccounts).values({
    accountCode: unique('ACC'),
    accountName: unique(`${accountType} account`),
    accountType,
    openingBalance: openingBalance.toFixed(2),
  }).returning();
  return account;
}

export async function createSale(batchId: number, totalAmount: number) {
  const [buyer] = await db.insert(buyers).values({ buyerName: unique('Buyer') }).returning();
  const [sale] = await db.insert(sales).values({
    saleCode: unique('SALE'),
    batchId,
    buyerId: buyer.id,
    saleDate: '2026-09-20',
    totalBirds: 1000,
    totalWeight: '2000',
    pricePerKg: (totalAmount / 2000).toFixed(2),
    totalAmount: totalAmount.toFixed(2),
  }).returning();
  return { buyer, sale };
}

export async function createEmployee(siteId: number, costCentre: number | null) {
  const [employee] = await db.insert(employees).values({
    firstName: 'Test',
    lastName: unique('Emp'),
    designation: 'Worker',
    siteId,
    costCentreId: costCentre,
    employmentType: 'permanent',
    joinDate: '2026-01-01',
  }).returning();
  return employee;
}

export async function createPurchaseOrder(lines: Array<{ typeCategory: 'feed' | 'health'; isFeed: boolean; quantity: number; unitPrice: number }>, costCentre?: number) {
  const [supplier] = await db.insert(suppliers).values({ supplierName: unique('Supplier'), status: 'active' }).returning();
  const [po] = await db.insert(purchaseOrders).values({
    orderCode: unique('PO'),
    supplierId: supplier.id,
    costCentreId: costCentre ?? await costCentreId('MILL'),
    orderDate: '2026-09-10',
    status: 'received',
    createdBy: (await createUser()).id,
  }).returning();
  for (const line of lines) {
    const [type] = await db.insert(inventoryItemTypes).values({
      typeCode: unique('type'),
      typeName: unique('Type'),
      category: line.typeCategory,
      defaultUnit: 'kg',
      isFeed: line.isFeed,
      financeCategoryId: await categoryId(line.isFeed ? 'feed_raw_materials' : 'medicine_vaccines'),
    }).returning();
    const [item] = await db.insert(feedInventory).values({
      itemTypeId: type.id,
      ingredientName: unique('Item'),
      supplierId: supplier.id,
      quantity: '0',
      unit: 'kg',
      costPerUnit: line.unitPrice.toFixed(2),
    }).returning();
    await db.insert(purchaseOrderItems).values({
      purchaseOrderId: po.id,
      inventoryItemId: item.id,
      orderedQuantity: String(line.quantity),
      unitPrice: line.unitPrice.toFixed(2),
      unit: 'kg',
    });
  }
  return { supplier, po };
}

export async function entriesFor(treasuryTransactionId: number) {
  return db
    .select({
      amount: treasuryTransactionEntries.amount,
      direction: treasuryTransactionEntries.entryDirection,
      financeAccountId: treasuryTransactionEntries.financeAccountId,
      categoryCode: financeCategories.code,
      costCentreId: treasuryTransactionEntries.costCentreId,
      batchId: treasuryTransactionEntries.batchId,
    })
    .from(treasuryTransactionEntries)
    .innerJoin(financeCategories, eq(treasuryTransactionEntries.categoryId, financeCategories.id))
    .where(eq(treasuryTransactionEntries.treasuryTransactionId, treasuryTransactionId))
    .orderBy(treasuryTransactionEntries.id);
}
