import { and, eq, inArray, notInArray, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  batches,
  batchInventoryConsumptions,
  chickPlacements,
  costCentres,
  dailyRecords,
  employees,
  feedDistributions,
  feedProductionBatches,
  financeCategories,
  payroll,
  sales,
  siteInventoryConsumptions,
  treasuryTransactionEntries,
  treasuryTransactions,
} from '../db/schema';
import { aggregateBirdDays, computeBirdDays, monthKey, toIsoDate, type BatchBirdDays } from './bird-days';

/**
 * The costing model: how every rupee of farm and mill cost ends up in a batch.
 *
 * Direct, stock-based costs (at what they actually cost):
 *   chicks      ← chick placement cost
 *   feed        ← feed dispatched × (raw-material cost/kg of its production run + mill overhead/kg for that month)
 *   inventory   ← medicine, vaccines and supplies consumed by the batch (FIFO lot cost)
 *
 * Pooled costs, split by bird-days in the month they occur:
 *   site pool   ← cash spent tagged to a farm (electricity, gas, litter, repairs…), site-level stock use,
 *                  wages of staff on that farm → the farm's batches
 *   admin pool  ← cash spent tagged to Admin, wages of admin staff → all farm batches
 *   mill pool   ← cash spent tagged to the Feed Mill, mill wages → absorbed into feed cost/kg
 * Cash tagged directly to a batch is a direct cost of that batch.
 *
 * Money that is NOT counted from the ledger (it is counted from its source instead, so it isn't doubled):
 *   - payments for purchase orders (the stock is costed when it is used)
 *   - chicks (costed from the placement), wages and EPF/ETF (costed from payroll), equipment purchases (capital)
 */

export const LEDGER_EXCLUDED_CATEGORY_CODES = ['chicks', 'wages_salaries', 'epf_etf', 'equipment_purchase'];

export type CostComponent = 'chicks' | 'feed' | 'inventory' | 'labor' | 'operational_expense';
export type CostAllocation = 'direct' | 'site' | 'shared_overhead';

export interface BatchCostLedgerEntry {
  componentType: CostComponent;
  allocationType: CostAllocation;
  eventDate: string;
  sourceType: string;
  sourceId: number;
  sourceCode?: string | null;
  description: string;
  quantity?: number | null;
  unit?: string | null;
  unitCost?: number | null;
  amount: number;
  /** How a shared cost was split, e.g. "12,400 of 30,100 bird-days (41.2%)" */
  basis?: string | null;
  notes?: string | null;
}

export interface BatchCostSummary {
  batchId: number;
  batchCode: string;
  chickCost: number;
  feedCost: number;
  inventoryCost: number;
  laborCost: number;
  operationalExpenseCost: number;
  totalCost: number;
  costPerBird: number;
  birdDays: number;
  /** Open longer than a broiler batch can run; bird-days are capped until someone closes or corrects it. */
  stale?: boolean;
  ledger: BatchCostLedgerEntry[];
}

export type PoolKind = 'site' | 'admin' | 'mill';

export interface CostPoolMonth {
  kind: PoolKind;
  siteId: number | null;
  month: string;
  total: number;
  allocated: number;
  unallocated: number;
}

export interface MillMonth {
  month: string;
  overhead: number;
  kgProduced: number;
  overheadPerKg: number;
}

export interface CostingModel {
  summaries: Map<number, BatchCostSummary>;
  birdDays: Map<number, BatchBirdDays>;
  pools: CostPoolMonth[];
  mill: Map<string, MillMonth>;
}

type PoolItem = {
  kind: PoolKind;
  siteId: number | null;
  date: string;
  amount: number;
  component: CostComponent;
  sourceType: string;
  sourceId: number;
  sourceCode?: string | null;
  description: string;
  notes?: string | null;
};

export function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function formatInt(value: number) {
  return Math.round(value).toLocaleString('en-US');
}

function emptySummary(id: number, batchCode: string): BatchCostSummary {
  return {
    batchId: id,
    batchCode,
    chickCost: 0,
    feedCost: 0,
    inventoryCost: 0,
    laborCost: 0,
    operationalExpenseCost: 0,
    totalCost: 0,
    costPerBird: 0,
    birdDays: 0,
    ledger: [],
  };
}

function addToSummary(summary: BatchCostSummary, entry: BatchCostLedgerEntry) {
  const amount = entry.amount;
  if (entry.componentType === 'chicks') summary.chickCost += amount;
  else if (entry.componentType === 'feed') summary.feedCost += amount;
  else if (entry.componentType === 'inventory') summary.inventoryCost += amount;
  else if (entry.componentType === 'labor') summary.laborCost += amount;
  else summary.operationalExpenseCost += amount;
  summary.ledger.push(entry);
}

/** Build the costing model for every batch, as of a date (default today). */
export async function buildCostingModel(asOfInput?: string): Promise<CostingModel> {
  const asOf = asOfInput ?? toIsoDate(new Date());

  const [
    batchRows,
    placementRows,
    deathRows,
    saleRows,
    productionRows,
    feedRows,
    inventoryRows,
    siteInventoryRows,
    payrollRows,
    ledgerRows,
  ] = await Promise.all([
    db.select({
      id: batches.id,
      batchCode: batches.batchCode,
      siteId: batches.siteId,
      chicksPlaced: batches.chicksPlaced,
      placementDate: batches.placementDate,
      actualDeliveryDate: batches.actualDeliveryDate,
      status: batches.status,
    }).from(batches),
    db.select({
      id: chickPlacements.id,
      batchId: chickPlacements.batchId,
      placementDate: chickPlacements.placementDate,
      invoiceReference: chickPlacements.invoiceReference,
      acceptedQuantity: chickPlacements.acceptedQuantity,
      unitCost: chickPlacements.unitCost,
      batchOpeningCost: chickPlacements.batchOpeningCost,
      notes: chickPlacements.notes,
    }).from(chickPlacements),
    db.select({
      batchId: dailyRecords.batchId,
      date: dailyRecords.recordDate,
      count: dailyRecords.mortalityCount,
    }).from(dailyRecords),
    db.select({
      batchId: sales.batchId,
      date: sales.saleDate,
      count: sales.totalBirds,
    }).from(sales).where(sql`${sales.status} <> 'cancelled'`),
    db.select({
      id: feedProductionBatches.id,
      productionCode: feedProductionBatches.productionCode,
      productionDate: feedProductionBatches.productionDate,
      actualQuantity: feedProductionBatches.actualQuantity,
      productionCost: feedProductionBatches.productionCost,
    }).from(feedProductionBatches).where(eq(feedProductionBatches.status, 'completed')),
    db.select({
      id: feedDistributions.id,
      batchId: feedDistributions.farmBatchId,
      productionBatchId: feedDistributions.productionBatchId,
      feedType: feedDistributions.feedType,
      quantity: feedDistributions.quantity,
      unit: feedDistributions.unit,
      distributionDate: feedDistributions.distributionDate,
      notes: feedDistributions.notes,
    }).from(feedDistributions),
    db.select({
      id: batchInventoryConsumptions.id,
      batchId: batchInventoryConsumptions.batchId,
      consumptionDate: batchInventoryConsumptions.consumptionDate,
      quantity: batchInventoryConsumptions.quantity,
      unit: batchInventoryConsumptions.unit,
      unitCost: batchInventoryConsumptions.unitCost,
      lineCost: batchInventoryConsumptions.lineCost,
      referenceType: batchInventoryConsumptions.referenceType,
      referenceId: batchInventoryConsumptions.referenceId,
      notes: batchInventoryConsumptions.notes,
      itemName: sql<string>`(SELECT ingredient_name FROM feed_inventory WHERE feed_inventory.id = ${batchInventoryConsumptions.inventoryItemId})`,
    }).from(batchInventoryConsumptions),
    db.select({
      id: siteInventoryConsumptions.id,
      siteId: siteInventoryConsumptions.siteId,
      consumptionDate: siteInventoryConsumptions.consumptionDate,
      lineCost: siteInventoryConsumptions.lineCost,
      referenceType: siteInventoryConsumptions.referenceType,
      referenceId: siteInventoryConsumptions.referenceId,
      notes: siteInventoryConsumptions.notes,
      itemName: sql<string>`(SELECT ingredient_name FROM feed_inventory WHERE feed_inventory.id = ${siteInventoryConsumptions.inventoryItemId})`,
    }).from(siteInventoryConsumptions),
    db.select({
      payrollId: payroll.id,
      payPeriod: payroll.payPeriod,
      grossSalary: payroll.grossSalary,
      employeeName: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
      employeeSiteId: employees.siteId,
      centreType: costCentres.centreType,
      centreSiteId: costCentres.siteId,
    })
      .from(payroll)
      .innerJoin(employees, eq(payroll.employeeId, employees.id))
      .leftJoin(costCentres, eq(employees.costCentreId, costCentres.id))
      .where(inArray(payroll.status, ['approved', 'paid'])),
    db.select({
      entryId: treasuryTransactionEntries.id,
      transactionId: treasuryTransactions.id,
      transactionCode: treasuryTransactions.transactionCode,
      valueDate: treasuryTransactionEntries.valueDate,
      direction: treasuryTransactionEntries.entryDirection,
      amount: treasuryTransactionEntries.amount,
      batchId: treasuryTransactionEntries.batchId,
      categoryName: financeCategories.name,
      centreType: costCentres.centreType,
      centreSiteId: costCentres.siteId,
      counterparty: treasuryTransactions.counterpartyNameSnapshot,
      narrative: treasuryTransactions.narrative,
      notes: treasuryTransactionEntries.notes,
    })
      .from(treasuryTransactionEntries)
      .innerJoin(treasuryTransactions, eq(treasuryTransactionEntries.treasuryTransactionId, treasuryTransactions.id))
      .innerJoin(financeCategories, eq(treasuryTransactionEntries.categoryId, financeCategories.id))
      .innerJoin(costCentres, eq(treasuryTransactionEntries.costCentreId, costCentres.id))
      .where(and(
        eq(financeCategories.categoryType, 'expense'),
        notInArray(financeCategories.code, LEDGER_EXCLUDED_CATEGORY_CODES),
        notInArray(treasuryTransactions.status, ['voided', 'bounced']),
        // Purchase-order payments buy stock; that stock is costed when it is used.
        sql`NOT EXISTS (
          SELECT 1 FROM treasury_transaction_links l
          WHERE l.treasury_transaction_id = ${treasuryTransactions.id} AND l.source_entity_type = 'purchase_order'
        )`,
      )),
  ]);

  // ── Bird-days per batch ──────────────────────────────────────────────────
  const placementsByBatch = new Map<number, typeof placementRows>();
  for (const row of placementRows) {
    const list = placementsByBatch.get(row.batchId) ?? [];
    list.push(row);
    placementsByBatch.set(row.batchId, list);
  }
  const deathsByBatch = new Map<number, Array<{ date: string; count: number }>>();
  for (const row of deathRows) {
    const list = deathsByBatch.get(row.batchId) ?? [];
    list.push({ date: toIsoDate(row.date), count: row.count });
    deathsByBatch.set(row.batchId, list);
  }
  const salesByBatch = new Map<number, Array<{ date: string; count: number }>>();
  for (const row of saleRows) {
    const list = salesByBatch.get(row.batchId) ?? [];
    list.push({ date: toIsoDate(row.date), count: row.count });
    salesByBatch.set(row.batchId, list);
  }

  const birdDays = new Map<number, BatchBirdDays>();
  const batchSite = new Map<number, number>();
  const batchPlaced = new Map<number, number>();
  for (const batch of batchRows) {
    const placements = placementsByBatch.get(batch.id) ?? [];
    const placed = placements.length > 0
      ? placements.reduce((sum, p) => sum + (p.acceptedQuantity ?? 0), 0)
      : batch.chicksPlaced;
    batchSite.set(batch.id, batch.siteId);
    batchPlaced.set(batch.id, placed);
    // A batch marked finished without a delivery date ends at its last sale or record.
    const finished = ['sold', 'culled', 'closed'].includes(batch.status);
    const lastActivity = [...(salesByBatch.get(batch.id) ?? []), ...(deathsByBatch.get(batch.id) ?? [])]
      .map((event) => event.date)
      .sort()
      .pop() ?? toIsoDate(batch.placementDate);
    const endDate = batch.actualDeliveryDate ? toIsoDate(batch.actualDeliveryDate) : finished ? lastActivity : null;
    birdDays.set(batch.id, computeBirdDays({
      id: batch.id,
      siteId: batch.siteId,
      placementDate: toIsoDate(batch.placementDate),
      endDate,
      birdsPlaced: placed,
      deaths: deathsByBatch.get(batch.id) ?? [],
      sold: salesByBatch.get(batch.id) ?? [],
    }, asOf));
  }
  const totals = aggregateBirdDays([...birdDays.values()]);

  const summaries = new Map<number, BatchCostSummary>(batchRows.map((b) => [b.id, emptySummary(b.id, b.batchCode)]));

  // ── Pooled items ─────────────────────────────────────────────────────────
  const poolItems: PoolItem[] = [];
  const addDirect = (batchId: number, entry: BatchCostLedgerEntry) => {
    const summary = summaries.get(batchId);
    if (summary) addToSummary(summary, entry);
  };

  for (const row of ledgerRows) {
    const signed = (row.direction === 'outflow' ? 1 : -1) * Number(row.amount);
    const date = toIsoDate(row.valueDate);
    const who = row.counterparty ?? row.narrative ?? '';
    const description = who ? `${row.categoryName} · ${who}` : row.categoryName;
    if (row.batchId) {
      addDirect(row.batchId, {
        componentType: 'operational_expense',
        allocationType: 'direct',
        eventDate: date,
        sourceType: 'treasury_entry',
        sourceId: row.entryId,
        sourceCode: row.transactionCode,
        description,
        amount: roundCurrency(signed),
        notes: row.notes,
      });
      continue;
    }
    poolItems.push({
      kind: row.centreType === 'site' ? 'site' : row.centreType === 'mill' ? 'mill' : 'admin',
      siteId: row.centreType === 'site' ? row.centreSiteId : null,
      date,
      amount: signed,
      component: 'operational_expense',
      sourceType: 'treasury_entry',
      sourceId: row.entryId,
      sourceCode: row.transactionCode,
      description,
      notes: row.notes,
    });
  }

  for (const row of payrollRows) {
    const kind: PoolKind = row.centreType === 'mill' ? 'mill' : row.centreType === 'admin' ? 'admin' : 'site';
    poolItems.push({
      kind,
      siteId: kind === 'site' ? (row.centreSiteId ?? row.employeeSiteId) : null,
      date: toIsoDate(row.payPeriod),
      amount: Number(row.grossSalary),
      component: 'labor',
      sourceType: 'payroll',
      sourceId: row.payrollId,
      sourceCode: `PAY-${row.payrollId}`,
      description: `Wages · ${row.employeeName}`,
    });
  }

  for (const row of siteInventoryRows) {
    poolItems.push({
      kind: 'site',
      siteId: row.siteId,
      date: toIsoDate(row.consumptionDate),
      amount: Number(row.lineCost),
      component: 'inventory',
      sourceType: row.referenceType ?? 'site_inventory_consumption',
      sourceId: row.referenceId ?? row.id,
      description: `${row.itemName ?? 'Stock'} · farm use`,
      notes: row.notes,
    });
  }

  // ── Mill overhead per kg, per month ──────────────────────────────────────
  const mill = new Map<string, MillMonth>();
  const millMonth = (month: string) => {
    let entry = mill.get(month);
    if (!entry) {
      entry = { month, overhead: 0, kgProduced: 0, overheadPerKg: 0 };
      mill.set(month, entry);
    }
    return entry;
  };
  for (const run of productionRows) {
    millMonth(monthKey(toIsoDate(run.productionDate))).kgProduced += Number(run.actualQuantity ?? 0);
  }
  for (const item of poolItems) {
    if (item.kind === 'mill') millMonth(monthKey(item.date)).overhead += item.amount;
  }
  for (const entry of mill.values()) {
    entry.overhead = roundCurrency(entry.overhead);
    entry.overheadPerKg = entry.kgProduced > 0 ? entry.overhead / entry.kgProduced : 0;
  }

  // ── Direct costs ─────────────────────────────────────────────────────────
  for (const row of placementRows) {
    addDirect(row.batchId, {
      componentType: 'chicks',
      allocationType: 'direct',
      eventDate: toIsoDate(row.placementDate),
      sourceType: 'chick_placement',
      sourceId: row.id,
      sourceCode: row.invoiceReference ?? null,
      description: 'Day-old chicks',
      quantity: row.acceptedQuantity,
      unit: 'birds',
      unitCost: roundCurrency(Number(row.unitCost)),
      amount: roundCurrency(Number(row.batchOpeningCost)),
      notes: row.notes,
    });
  }

  const productionById = new Map(productionRows.map((run) => [run.id, run]));
  for (const row of feedRows) {
    const run = row.productionBatchId ? productionById.get(row.productionBatchId) : undefined;
    const quantity = Number(row.quantity);
    const runKg = Number(run?.actualQuantity ?? 0);
    const rawPerKg = run && runKg > 0 ? Number(run.productionCost ?? 0) / runKg : 0;
    const overheadPerKg = run ? mill.get(monthKey(toIsoDate(run.productionDate)))?.overheadPerKg ?? 0 : 0;
    const unitCost = rawPerKg + overheadPerKg;
    addDirect(row.batchId, {
      componentType: 'feed',
      allocationType: 'direct',
      eventDate: toIsoDate(row.distributionDate),
      sourceType: 'feed_distribution',
      sourceId: row.id,
      sourceCode: run?.productionCode ?? null,
      description: run
        ? `${row.feedType} from ${run.productionCode} (materials ${rawPerKg.toFixed(2)}/kg + mill ${overheadPerKg.toFixed(2)}/kg)`
        : `${row.feedType} (no production run linked, uncosted)`,
      quantity,
      unit: row.unit,
      unitCost: roundCurrency(unitCost),
      amount: roundCurrency(quantity * unitCost),
      notes: row.notes,
    });
  }

  for (const row of inventoryRows) {
    addDirect(row.batchId, {
      componentType: 'inventory',
      allocationType: 'direct',
      eventDate: toIsoDate(row.consumptionDate),
      sourceType: row.referenceType ?? 'batch_inventory_consumption',
      sourceId: row.referenceId ?? row.id,
      description: row.itemName || 'Stock used',
      quantity: Number(row.quantity),
      unit: row.unit,
      unitCost: roundCurrency(Number(row.unitCost)),
      amount: roundCurrency(Number(row.lineCost)),
      notes: row.notes,
    });
  }

  // ── Allocate farm and admin pools by bird-days ───────────────────────────
  const poolTotals = new Map<string, CostPoolMonth>();
  const poolKey = (kind: PoolKind, siteId: number | null, month: string) => `${kind}:${siteId ?? '-'}:${month}`;
  const allocations = new Map<string, number>();

  for (const item of poolItems) {
    const month = monthKey(item.date);
    const key = poolKey(item.kind, item.siteId, month);
    const pool = poolTotals.get(key) ?? { kind: item.kind, siteId: item.siteId, month, total: 0, allocated: 0, unallocated: 0 };
    pool.total += item.amount;
    poolTotals.set(key, pool);

    if (item.kind === 'mill') continue; // absorbed into feed cost above

    const denominator = item.kind === 'site'
      ? totals.bySiteMonth.get(`${item.siteId}:${month}`) ?? 0
      : totals.byMonth.get(month) ?? 0;
    if (denominator <= 0) continue;

    for (const [batchId, days] of birdDays) {
      if (item.kind === 'site' && batchSite.get(batchId) !== item.siteId) continue;
      const batchDays = days.byMonth.get(month) ?? 0;
      if (batchDays <= 0) continue;
      const share = item.amount * (batchDays / denominator);
      allocations.set(key, (allocations.get(key) ?? 0) + share);
      addDirect(batchId, {
        componentType: item.component,
        allocationType: item.kind === 'site' ? 'site' : 'shared_overhead',
        eventDate: item.date,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        sourceCode: item.sourceCode ?? null,
        description: item.description,
        amount: roundCurrency(share),
        basis: `${formatInt(batchDays)} of ${formatInt(denominator)} bird-days in ${month} (${((batchDays / denominator) * 100).toFixed(1)}% of ${roundCurrency(item.amount).toFixed(2)})`,
        notes: item.notes ?? null,
      });
    }
  }

  // Mill pool is "allocated" to the extent feed was produced that month.
  for (const pool of poolTotals.values()) {
    pool.total = roundCurrency(pool.total);
    if (pool.kind === 'mill') {
      const month = mill.get(pool.month);
      pool.allocated = month && month.kgProduced > 0 ? pool.total : 0;
    } else {
      pool.allocated = roundCurrency(allocations.get(poolKey(pool.kind, pool.siteId, pool.month)) ?? 0);
    }
    pool.unallocated = roundCurrency(pool.total - pool.allocated);
  }

  // ── Finish summaries ─────────────────────────────────────────────────────
  for (const summary of summaries.values()) {
    summary.chickCost = roundCurrency(summary.chickCost);
    summary.feedCost = roundCurrency(summary.feedCost);
    summary.inventoryCost = roundCurrency(summary.inventoryCost);
    summary.laborCost = roundCurrency(summary.laborCost);
    summary.operationalExpenseCost = roundCurrency(summary.operationalExpenseCost);
    summary.totalCost = roundCurrency(
      summary.chickCost + summary.feedCost + summary.inventoryCost + summary.laborCost + summary.operationalExpenseCost,
    );
    summary.birdDays = birdDays.get(summary.batchId)?.total ?? 0;
    summary.stale = birdDays.get(summary.batchId)?.stale ?? false;
    const placed = batchPlaced.get(summary.batchId) ?? 0;
    summary.costPerBird = placed > 0 ? roundCurrency(summary.totalCost / placed) : 0;
    summary.ledger.sort((a, b) => (a.eventDate === b.eventDate ? b.sourceId - a.sourceId : a.eventDate < b.eventDate ? 1 : -1));
  }

  return {
    summaries,
    birdDays,
    pools: [...poolTotals.values()].sort((a, b) => (a.month === b.month ? a.kind.localeCompare(b.kind) : a.month.localeCompare(b.month))),
    mill,
  };
}
