import { eq } from 'drizzle-orm';
import { db } from '../db';
import {
  batchHealthTasks,
  batchInventoryConsumptions,
  batches,
  buyers,
  cages,
  chickPlacements,
  dailyRecords,
  feedInventory,
  growthStandardPoints,
  growthStandards,
  healthScheduleItems,
  healthScheduleTemplates,
  inventoryItemTypes,
  inventoryLots,
  sales,
  suppliers,
} from '../db/schema';
import { applyHealthTemplate, completeHealthTask, FarmOpsError, getGrowthComparison, skipHealthTask } from '../lib/batch-health';
import { getBatchHistory, getTodayCheck, listTurnarounds, saveTodayCheck, setUpNewBatch, startTurnaroundForBatch, updateTurnaround } from '../lib/farm-ops';
import { closeBatch } from '../lib/batch-costs';
import { buildCostingModel } from '../lib/costing';
import { createSiteWithBatch, createUser, resetDatabase } from './fixtures';

beforeEach(async () => {
  await resetDatabase();
});

async function vaccineStock(quantity: number, costPerUnit: number) {
  const [supplier] = await db.insert(suppliers).values({ supplierName: `Vet supplies ${Date.now()}`, status: 'active' }).returning();
  const [type] = await db.insert(inventoryItemTypes).values({
    typeCode: `vaccine_${Date.now()}`, typeName: `Vaccine ${Date.now()}`, category: 'health', defaultUnit: 'dose', allowsBatchAllocation: true,
  }).returning();
  const [item] = await db.insert(feedInventory).values({
    itemTypeId: type.id, ingredientName: 'ND+IB vaccine', supplierId: supplier.id, quantity: String(quantity), unit: 'dose', costPerUnit: String(costPerUnit),
  }).returning();
  await db.insert(inventoryLots).values({
    inventoryItemId: item.id, lotCode: `LOT-T-${Date.now()}`, receivedQuantity: String(quantity), remainingQuantity: String(quantity),
    costPerUnit: String(costPerUnit), receivedDate: '2026-08-01',
  });
  return item;
}

async function defaultProgramme(vaccineItemId?: number) {
  const [template] = await db.insert(healthScheduleTemplates).values({ name: 'Test programme', isDefault: true }).returning();
  await db.insert(healthScheduleItems).values([
    { templateId: template.id, dayOfAge: 1, taskType: 'medication', name: 'Vitamins', method: 'drinking_water' },
    { templateId: template.id, dayOfAge: 7, taskType: 'vaccination', name: 'ND + IB', method: 'eye_drop', inventoryItemId: vaccineItemId ?? null, dosePer1000Birds: vaccineItemId ? '1000' : null },
    { templateId: template.id, dayOfAge: 14, taskType: 'vaccination', name: 'Gumboro', method: 'drinking_water' },
  ]);
  return template;
}

async function defaultCurve() {
  const [standard] = await db.insert(growthStandards).values({ name: 'Test curve', isDefault: true }).returning();
  await db.insert(growthStandardPoints).values([
    { standardId: standard.id, dayOfAge: 7, targetWeightG: 190, targetCumFeedG: 160, targetCumMortalityPct: '1.0' },
    { standardId: standard.id, dayOfAge: 14, targetWeightG: 480, targetCumFeedG: 580, targetCumMortalityPct: '1.5' },
  ]);
  return standard;
}

async function newBatch(siteId: number, birds = 2000, placementDate = '2026-09-01') {
  const [cage] = await db.insert(cages).values({ siteId, cageNumber: `H${Date.now()}`, capacity: birds }).returning();
  return db.transaction(async (tx) => {
    const [batch] = await tx.insert(batches).values({
      batchCode: `B-${Date.now()}`, siteId, cageId: cage.id, chicksPlaced: birds, placementDate, status: 'placement',
    }).returning();
    await setUpNewBatch({ batchId: batch.id, placementDate }, tx);
    return (await tx.select().from(batches).where(eq(batches.id, batch.id)))[0];
  });
}

describe('health programmes', () => {
  it('gives a new batch its programme tasks, dated from placement and dosed for its birds', async () => {
    const vaccine = await vaccineStock(5000, 2);
    const template = await defaultProgramme(vaccine.id);
    const standard = await defaultCurve();
    const { site } = await createSiteWithBatch();

    const batch = await newBatch(site.id, 2000, '2026-09-01');
    expect(batch.healthTemplateId).toBe(template.id);
    expect(batch.growthStandardId).toBe(standard.id);

    const tasks = await db.select().from(batchHealthTasks).where(eq(batchHealthTasks.batchId, batch.id)).orderBy(batchHealthTasks.dueDate);
    expect(tasks.map((t) => [t.name, t.dueDate, t.status])).toEqual([
      ['Vitamins', '2026-09-02', 'pending'],
      ['ND + IB', '2026-09-08', 'pending'],
      ['Gumboro', '2026-09-15', 'pending'],
    ]);
    expect(Number(tasks[1].plannedQuantity)).toBe(2000);
  });

  it('completing a task records the vaccination and charges the vaccine to the batch at lot cost', async () => {
    const user = await createUser();
    const vaccine = await vaccineStock(5000, 2);
    await defaultProgramme(vaccine.id);
    const { site } = await createSiteWithBatch();
    const batch = await newBatch(site.id, 2000, '2026-09-01');
    const [ndTask] = await db.select().from(batchHealthTasks).where(eq(batchHealthTasks.name, 'ND + IB'));

    const { task, vaccination } = await completeHealthTask({ taskId: ndTask.id, completedDate: '2026-09-08', userId: user.id });
    expect(task.status).toBe('done');
    expect(task.vaccinationId).toBe(vaccination.id);
    expect(Number(vaccination.inventoryCost)).toBe(4000);

    const [lot] = await db.select().from(inventoryLots).where(eq(inventoryLots.inventoryItemId, vaccine.id));
    expect(Number(lot.remainingQuantity)).toBe(3000);
    const [item] = await db.select().from(feedInventory).where(eq(feedInventory.id, vaccine.id));
    expect(Number(item.quantity)).toBe(3000);
    const consumptions = await db.select().from(batchInventoryConsumptions).where(eq(batchInventoryConsumptions.batchId, batch.id));
    expect(consumptions).toHaveLength(1);

    const model = await buildCostingModel('2026-09-30');
    expect(model.summaries.get(batch.id)!.inventoryCost).toBe(4000);

    await expect(completeHealthTask({ taskId: ndTask.id, completedDate: '2026-09-08', userId: user.id })).rejects.toBeInstanceOf(FarmOpsError);
  });

  it('refuses to complete a task when there is not enough stock, and leaves everything unchanged', async () => {
    const user = await createUser();
    const vaccine = await vaccineStock(500, 2);
    await defaultProgramme(vaccine.id);
    const { site } = await createSiteWithBatch();
    await newBatch(site.id, 2000);
    const [ndTask] = await db.select().from(batchHealthTasks).where(eq(batchHealthTasks.name, 'ND + IB'));

    await expect(completeHealthTask({ taskId: ndTask.id, completedDate: '2026-09-08', userId: user.id })).rejects.toThrow(/Only 500 dose/);
    const [still] = await db.select().from(batchHealthTasks).where(eq(batchHealthTasks.id, ndTask.id));
    expect(still.status).toBe('pending');
  });

  it('keeps done and skipped tasks when the programme is re-applied, and re-dates the rest', async () => {
    const user = await createUser();
    await defaultProgramme();
    const { site } = await createSiteWithBatch();
    const batch = await newBatch(site.id, 1000, '2026-09-01');
    const [vitamins] = await db.select().from(batchHealthTasks).where(eq(batchHealthTasks.name, 'Vitamins'));
    await skipHealthTask({ taskId: vitamins.id, reason: 'Given at hatchery', userId: user.id });

    await db.update(batches).set({ placementDate: '2026-09-03' }).where(eq(batches.id, batch.id));
    await applyHealthTemplate({ batchId: batch.id, templateId: null });

    const tasks = await db.select().from(batchHealthTasks).where(eq(batchHealthTasks.batchId, batch.id)).orderBy(batchHealthTasks.dueDate);
    expect(tasks.map((t) => [t.name, t.status, t.dueDate])).toEqual([
      ['Vitamins', 'skipped', '2026-09-02'],
      ['ND + IB', 'pending', '2026-09-10'],
      ['Gumboro', 'pending', '2026-09-17'],
    ]);
  });
});

describe('growth and today\'s check', () => {
  it('saves today\'s check with live birds worked out, and compares growth with the target curve', async () => {
    const user = await createUser();
    await defaultCurve();
    const { site } = await createSiteWithBatch();
    const batch = await newBatch(site.id, 1000, '2026-09-01');

    const before = await getTodayCheck(batch.id, '2026-09-11');
    expect(before.liveBirdsAtStart).toBe(1000);
    expect(before.dayOfAge).toBe(10);

    await saveTodayCheck({ batchId: batch.id, date: '2026-09-11', mortalityCount: 5, feedConsumption: 300, averageWeight: 320, userId: user.id });
    await saveTodayCheck({ batchId: batch.id, date: '2026-09-11', mortalityCount: 6, feedConsumption: 310, averageWeight: 330, userId: user.id });
    const records = await db.select().from(dailyRecords).where(eq(dailyRecords.batchId, batch.id));
    expect(records).toHaveLength(1);
    expect(records[0]).toEqual(expect.objectContaining({ birdCount: 994, mortalityCount: 6, currentAge: 10 }));
    const [updatedBatch] = await db.select().from(batches).where(eq(batches.id, batch.id));
    expect(updatedBatch.status).toBe('growing');

    await expect(saveTodayCheck({ batchId: batch.id, date: '2026-09-12', mortalityCount: 5000, feedConsumption: 0, userId: user.id }))
      .rejects.toThrow(/can't exceed the 994 birds/);

    const growth = await getGrowthComparison(batch.id);
    // Day 10 target is interpolated between day 7 (190 g) and day 14 (480 g)
    expect(growth.series[0]).toEqual(expect.objectContaining({ dayOfAge: 10, actualWeightG: 330, targetWeightG: 314, actualCumMortalityPct: 0.6 }));
    expect(growth.latest!.weightVsTargetPct).toBe(5.1);
  });
});

describe('house turnaround and batch history', () => {
  it('puts a house into turnaround when its batch leaves, and ends it when the next batch is placed', async () => {
    const user = await createUser();
    const { site } = await createSiteWithBatch();
    const first = await newBatch(site.id, 1000, '2026-07-01');
    await startTurnaroundForBatch({ batchId: first.id, startedDate: '2026-08-10', userId: user.id });

    let [cage] = await db.select().from(cages).where(eq(cages.id, first.cageId));
    expect(cage.status).toBe('maintenance');
    let [turnaround] = await listTurnarounds({ siteId: site.id, status: 'in_progress' });
    expect(turnaround.previousBatchCode).toBe(first.batchCode);

    await updateTurnaround({ id: turnaround.id, cleanedDate: '2026-08-12', disinfectedDate: '2026-08-13' });
    await updateTurnaround({ id: turnaround.id, readyDate: '2026-08-20' });
    [cage] = await db.select().from(cages).where(eq(cages.id, first.cageId));
    expect(cage.status).toBe('empty');
    [turnaround] = await listTurnarounds({ siteId: site.id });
    expect(turnaround).toEqual(expect.objectContaining({ status: 'ready', downtimeDays: 10 }));
  });

  it('compares closed batches and picks out the best', async () => {
    const user = await createUser();
    const { site } = await createSiteWithBatch();
    await db.delete(batches);
    const [buyer] = await db.insert(buyers).values({ buyerName: 'History buyer' }).returning();

    for (const [code, deaths, kg, price] of [['H-1', 30, 2000, 100], ['H-2', 10, 2200, 110]] as const) {
      const [cage] = await db.insert(cages).values({ siteId: site.id, cageNumber: code, capacity: 1000 }).returning();
      const [batch] = await db.insert(batches).values({ batchCode: code, siteId: site.id, cageId: cage.id, chicksPlaced: 1000, placementDate: '2026-06-01', status: 'sold' }).returning();
      await db.insert(chickPlacements).values({ batchId: batch.id, placementDate: '2026-06-01', deliveredQuantity: 1000, acceptedQuantity: 1000, unitCost: '150', batchOpeningCost: '150000', createdBy: user.id });
      await db.insert(dailyRecords).values({ batchId: batch.id, recordDate: '2026-06-20', currentAge: 19, birdCount: 1000 - deaths, mortalityCount: deaths, feedConsumption: '3000' });
      await db.insert(sales).values({ saleCode: `S-${code}`, batchId: batch.id, buyerId: buyer.id, saleDate: '2026-07-06', totalBirds: 1000 - deaths, totalWeight: String(kg), pricePerKg: String(price), totalAmount: String(kg * price), status: 'completed' });
      await closeBatch({ batchId: batch.id, closedBy: user.id });
    }

    const history = await getBatchHistory({ siteId: site.id });
    expect(history.batches.map((b) => b.batchCode).sort()).toEqual(['H-1', 'H-2']);
    expect(history.best.fcr).toBe('H-2');
    expect(history.best.profitPerBird).toBe('H-2');
    expect(history.averages.mortalityPct).toBe(2);
    // Closing each batch put its house into turnaround
    expect(await listTurnarounds({ siteId: site.id, status: 'in_progress' })).toHaveLength(2);
  });
});
