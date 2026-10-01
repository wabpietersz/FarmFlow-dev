import { db } from '../db';
import {
  batches,
  buyers,
  cages,
  chickPlacements,
  dailyRecords,
  feedDistributions,
  feedProductionBatches,
  feedRecipes,
  payroll,
  sales,
} from '../db/schema';
import { computeBirdDays } from '../lib/bird-days';
import { buildCostingModel } from '../lib/costing';
import { BatchCloseError, closeBatch, getBatchPerformance, reopenBatch } from '../lib/batch-costs';
import { createManualTreasuryTransaction, createSupplierPayment } from '../lib/treasury';
import {
  categoryId,
  costCentreId,
  createAccount,
  createEmployee,
  createPurchaseOrder,
  createSiteWithBatch,
  createUser,
  resetDatabase,
} from './fixtures';

const AS_OF = '2026-09-30';

beforeEach(async () => {
  await resetDatabase();
});

async function addBatch(siteId: number, code: string, birds: number, placementDate: string) {
  const [cage] = await db.insert(cages).values({ siteId, cageNumber: `H-${code}`, capacity: birds }).returning();
  const [batch] = await db.insert(batches).values({
    batchCode: code, siteId, cageId: cage.id, chicksPlaced: birds, placementDate, status: 'growing',
  }).returning();
  return batch;
}

async function spend(params: { amount: number; category: string; date: string; costCentreId?: number; batchId?: number; userId: number; accountId: number }) {
  return createManualTreasuryTransaction({
    transactionDate: params.date,
    transactionType: 'manual_outflow',
    financeAccountId: params.accountId,
    amount: params.amount,
    narrative: `${params.category} test spend`,
    postedBy: params.userId,
    categoryId: await categoryId(params.category),
    costCentreId: params.costCentreId,
    batchId: params.batchId,
  });
}

describe('computeBirdDays', () => {
  it('counts live birds at the start of each day, net of deaths and sales, split by month', () => {
    const result = computeBirdDays({
      id: 1,
      siteId: 1,
      placementDate: '2026-08-30',
      birdsPlaced: 100,
      deaths: [{ date: '2026-08-31', count: 10 }],
      sold: [{ date: '2026-09-02', count: 90 }],
    }, '2026-09-30');
    // 30 Aug: 100, 31 Aug: 100 (deaths count from next day), 1 Sep: 90, 2 Sep: 90, then 0 → stops
    expect(result.byMonth.get('2026-08')).toBe(200);
    expect(result.byMonth.get('2026-09')).toBe(180);
    expect(result.total).toBe(380);
    expect(result.lastDay).toBe('2026-09-02');
    expect(result.stale).toBe(false);
  });

  it('stops counting a forgotten batch after 90 days and flags it', () => {
    const result = computeBirdDays({ id: 1, siteId: 1, placementDate: '2026-01-01', birdsPlaced: 10, deaths: [], sold: [] }, '2026-09-30');
    expect(result.total).toBe(900);
    expect(result.lastDay).toBe('2026-03-31');
    expect(result.stale).toBe(true);
  });
});

describe('costing model', () => {
  it('splits farm costs by bird-days, admin costs across all farms, absorbs mill overhead into feed, and never loses a rupee', async () => {
    const user = await createUser();
    const account = await createAccount();
    const { site: siteS, centre: centreS } = await createSiteWithBatch('Farm S');
    const { site: siteZ, centre: centreZ } = await createSiteWithBatch('Farm Z');
    // createSiteWithBatch adds a placeholder batch placed 2026-09-01 with 5,000 birds; remove it from the maths by ending it early.
    await db.delete(batches);

    const x = await addBatch(siteS.id, 'X', 2000, '2026-09-01');
    const y = await addBatch(siteS.id, 'Y', 1000, '2026-09-01');
    const z = await addBatch(siteZ.id, 'Z', 3000, '2026-09-16');

    // Farm S electricity 9,000 → X:Y = 60,000:30,000 bird-days = 2:1
    await spend({ amount: 9000, category: 'electricity', date: '2026-09-15', costCentreId: centreS.id, userId: user.id, accountId: account.id });
    // Admin 3,000 → all farm bird-days: X 60,000 + Y 30,000 + Z 45,000 = 135,000
    await spend({ amount: 3000, category: 'professional_fees', date: '2026-09-20', costCentreId: await costCentreId('ADMIN'), userId: user.id, accountId: account.id });
    // Farm Z spend in August, before any birds → unallocated
    await spend({ amount: 5000, category: 'repairs_maintenance', date: '2026-08-20', costCentreId: centreZ.id, userId: user.id, accountId: account.id });
    // Direct batch cost
    await spend({ amount: 1500, category: 'medicine_vaccines', date: '2026-09-10', batchId: y.id, userId: user.id, accountId: account.id });
    // Chick payment is excluded (placement is the source of truth)
    await spend({ amount: 99999, category: 'chicks', date: '2026-09-01', batchId: x.id, userId: user.id, accountId: account.id }).catch(() => {
      throw new Error('chick spend should be recordable');
    });
    await db.insert(chickPlacements).values({
      batchId: x.id, placementDate: '2026-09-01', deliveredQuantity: 2000, acceptedQuantity: 2000,
      unitCost: '100', batchOpeningCost: '200000', createdBy: user.id,
    });

    // Purchase-order payment into Farm S is stock, not an expense of the period → excluded
    const { supplier, po } = await createPurchaseOrder([{ typeCategory: 'health', isFeed: false, quantity: 10, unitPrice: 700 }], centreS.id);
    await createSupplierPayment({
      supplierId: supplier.id, purchaseOrderId: po.id, paymentDate: '2026-09-12', financeAccountId: account.id,
      paymentMethod: 'bank_transfer', amount: 7000, recordedBy: user.id,
    });

    // Wages: Farm S staff 30,000 → 2:1; mill staff 20,000 → mill overhead
    const farmHand = await createEmployee(siteS.id, centreS.id);
    const millHand = await createEmployee(siteS.id, await costCentreId('MILL'));
    await db.insert(payroll).values([
      { employeeId: farmHand.id, payPeriod: '2026-09-01', baseSalary: '30000', workingDays: 26, attendedDays: '26', grossSalary: '30000', netSalary: '27600', status: 'approved' },
      { employeeId: millHand.id, payPeriod: '2026-09-01', baseSalary: '20000', workingDays: 26, attendedDays: '26', grossSalary: '20000', netSalary: '18400', status: 'paid' },
      { employeeId: farmHand.id, payPeriod: '2026-08-01', baseSalary: '30000', workingDays: 26, attendedDays: '26', grossSalary: '99999', netSalary: '99999', status: 'draft' },
    ]);

    // Mill: 1,000 kg made at 50/kg materials; mill electricity 10,000 + wages 20,000 → 30/kg overhead
    await spend({ amount: 10000, category: 'electricity', date: '2026-09-05', costCentreId: await costCentreId('MILL'), userId: user.id, accountId: account.id });
    const [recipe] = await db.insert(feedRecipes).values({ recipeName: 'Starter', feedType: 'starter', cost: '50' }).returning();
    const [run] = await db.insert(feedProductionBatches).values({
      productionCode: 'PRD-1', recipeId: recipe.id, plannedQuantity: '1000', actualQuantity: '1000',
      status: 'completed', productionDate: '2026-09-10', productionCost: '50000',
    }).returning();
    await db.insert(feedDistributions).values({
      productionBatchId: run.id, farmBatchId: x.id, feedType: 'starter', quantity: '100', distributionDate: '2026-09-11',
    });

    const model = await buildCostingModel(AS_OF);
    const cost = (id: number) => model.summaries.get(id)!;

    expect(model.birdDays.get(x.id)!.total).toBe(60000);
    expect(model.birdDays.get(z.id)!.total).toBe(45000);

    // X: electricity 6,000 + admin 1,333.33 + wages 20,000 + chicks 200,000 + feed 100 × 80 = 8,000
    expect(cost(x.id).chickCost).toBe(200000);
    expect(cost(x.id).feedCost).toBe(8000);
    expect(cost(x.id).laborCost).toBe(20000);
    expect(cost(x.id).operationalExpenseCost).toBeCloseTo(6000 + 1333.33, 2);
    // Y: electricity 3,000 + admin 666.67 + medicine 1,500 + wages 10,000
    expect(cost(y.id).operationalExpenseCost).toBeCloseTo(3000 + 666.67 + 1500, 2);
    expect(cost(y.id).laborCost).toBe(10000);
    // Z: admin share only
    expect(cost(z.id).totalCost).toBeCloseTo(1000, 2);

    const pool = (kind: string, month: string, siteId: number | null = null) =>
      model.pools.find((p) => p.kind === kind && p.month === month && p.siteId === siteId);
    expect(pool('site', '2026-09', siteS.id)).toEqual(expect.objectContaining({ total: 39000, allocated: 39000, unallocated: 0 }));
    expect(pool('admin', '2026-09')).toEqual(expect.objectContaining({ total: 3000, allocated: 3000, unallocated: 0 }));
    expect(pool('mill', '2026-09')).toEqual(expect.objectContaining({ total: 30000, allocated: 30000 }));
    expect(pool('site', '2026-08', siteZ.id)).toEqual(expect.objectContaining({ total: 5000, allocated: 0, unallocated: 5000 }));
    expect(model.mill.get('2026-09')!.overheadPerKg).toBe(30);

    // Every shared rupee is accounted for: batch shares add back to the pools they came from.
    const sharedInBatches = [...model.summaries.values()]
      .flatMap((s) => s.ledger)
      .filter((e) => e.allocationType !== 'direct')
      .reduce((sum, e) => sum + e.amount, 0);
    expect(sharedInBatches).toBeCloseTo(39000 + 3000, 1);

    // The shared lines explain themselves.
    expect(cost(x.id).ledger.find((e) => e.description.startsWith('Electricity'))!.basis).toContain('60,000 of 90,000 bird-days');
  });
});

describe('closing a batch', () => {
  async function soldBatch() {
    const user = await createUser();
    const account = await createAccount();
    const { site } = await createSiteWithBatch('Close Farm');
    await db.delete(batches);
    const batch = await addBatch(site.id, 'W', 1000, '2026-08-01');
    await db.insert(chickPlacements).values({
      batchId: batch.id, placementDate: '2026-08-01', deliveredQuantity: 1000, acceptedQuantity: 1000,
      unitCost: '150', batchOpeningCost: '150000', createdBy: user.id,
    });
    await db.insert(dailyRecords).values({ batchId: batch.id, recordDate: '2026-08-20', currentAge: 19, birdCount: 980, mortalityCount: 20, feedConsumption: '0' });
    const [buyer] = await db.insert(buyers).values({ buyerName: 'Close Buyer' }).returning();
    await db.insert(sales).values({
      saleCode: 'SALE-W', batchId: batch.id, buyerId: buyer.id, saleDate: '2026-09-05', totalBirds: 970,
      totalWeight: '2134', pricePerKg: '100', totalAmount: '213400', status: 'completed',
    });
    return { user, account, batch };
  }

  it('refuses to close while birds are unaccounted for, then freezes costs, revenue and KPIs', async () => {
    const { user, account, batch } = await soldBatch();

    await expect(closeBatch({ batchId: batch.id, closedBy: user.id })).rejects.toThrow(/10 birds are not accounted for/);

    const snapshot = await closeBatch({ batchId: batch.id, closedBy: user.id, acceptVariance: true, notes: '10 birds missing at count' });
    expect(Number(snapshot.revenue)).toBe(213400);
    expect(Number(snapshot.totalCost)).toBe(150000);
    expect(Number(snapshot.profit)).toBe(63400);
    expect(snapshot.kpis).toEqual(expect.objectContaining({
      birdsPlaced: 1000, deaths: 20, birdsSold: 970, unaccountedBirds: 10, mortalityPct: 2, ageDays: 35,
    }));

    await expect(closeBatch({ batchId: batch.id, closedBy: user.id, acceptVariance: true })).rejects.toBeInstanceOf(BatchCloseError);

    // A cost that arrives after closing doesn't change the frozen result, but is reported.
    await spend({ amount: 2500, category: 'transport', date: '2026-09-06', batchId: batch.id, userId: user.id, accountId: account.id });
    const closed = await getBatchPerformance(batch.id);
    expect(closed!.closed).toBe(true);
    expect(closed!.costs.totalCost).toBe(150000);
    expect(closed!.lateCosts).toBe(2500);

    await reopenBatch(batch.id);
    const reopened = await getBatchPerformance(batch.id);
    expect(reopened!.closed).toBe(false);
    expect(reopened!.costs.totalCost).toBe(152500);
  });
});
