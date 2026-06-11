import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  batches,
  batchInventoryConsumptions,
  chickPlacements,
  employees,
  feedDistributions,
  feedProductionBatches,
  operationalExpenses,
  payroll,
  serviceWorkOrders,
  siteInventoryConsumptions,
} from '../db/schema';

type BatchRow = {
  id: number;
  batchCode: string;
  siteId: number;
  chicksPlaced: number;
  placementDate: string;
  actualDeliveryDate?: string | null;
};

export interface BatchCostLedgerEntry {
  componentType: 'feed' | 'inventory' | 'labor' | 'operational_expense';
  allocationType: 'direct' | 'site' | 'shared_overhead';
  eventDate: string;
  sourceType: string;
  sourceId: number;
  sourceCode?: string | null;
  description: string;
  quantity?: number | null;
  unit?: string | null;
  unitCost?: number | null;
  amount: number;
  notes?: string | null;
}

export interface BatchCostSummary {
  batchId: number;
  batchCode: string;
  feedCost: number;
  inventoryCost: number;
  laborCost: number;
  operationalExpenseCost: number;
  totalCost: number;
  costPerBird: number;
  ledger: BatchCostLedgerEntry[];
}

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

function isBatchActiveOnDate(batch: Pick<BatchRow, 'placementDate' | 'actualDeliveryDate'>, dateValue: string) {
  const check = new Date(dateValue).getTime();
  const placement = new Date(batch.placementDate).getTime();
  const actualDelivery = batch.actualDeliveryDate ? new Date(batch.actualDeliveryDate).getTime() : null;
  return placement <= check && (actualDelivery == null || actualDelivery >= check);
}

export async function buildBatchCostSummaries(batchRows: BatchRow[]): Promise<Map<number, BatchCostSummary>> {
  const summaries = new Map<number, BatchCostSummary>(
    batchRows.map((batch) => [
      batch.id,
      {
        batchId: batch.id,
        batchCode: batch.batchCode,
        feedCost: 0,
        inventoryCost: 0,
        laborCost: 0,
        operationalExpenseCost: 0,
        totalCost: 0,
        costPerBird: 0,
        ledger: [],
      },
    ]),
  );

  if (batchRows.length === 0) {
    return summaries;
  }

  const batchIds = batchRows.map((batch) => batch.id);
  const siteIds = Array.from(new Set(batchRows.map((batch) => batch.siteId)));

  const [
    allBatches,
    feedRows,
    inventoryRows,
    chickPlacementRows,
    siteInventoryRows,
    directExpenseRows,
    siteExpenseRows,
    sharedExpenseRows,
    directServiceRows,
    siteServiceRows,
    sharedServiceRows,
    payrollRows,
  ] = await Promise.all([
    db
      .select({
        id: batches.id,
        batchCode: batches.batchCode,
        siteId: batches.siteId,
        chicksPlaced: batches.chicksPlaced,
        placementDate: batches.placementDate,
        actualDeliveryDate: batches.actualDeliveryDate,
      })
      .from(batches),
    db
      .select({
        batchId: feedDistributions.farmBatchId,
        distributionId: feedDistributions.id,
        distributionDate: feedDistributions.distributionDate,
        productionBatchId: feedDistributions.productionBatchId,
        productionCode: feedProductionBatches.productionCode,
        quantity: feedDistributions.quantity,
        unit: feedDistributions.unit,
        productionCost: feedProductionBatches.productionCost,
        actualQuantity: feedProductionBatches.actualQuantity,
        notes: feedDistributions.notes,
      })
      .from(feedDistributions)
      .leftJoin(feedProductionBatches, eq(feedDistributions.productionBatchId, feedProductionBatches.id))
      .where(inArray(feedDistributions.farmBatchId, batchIds)),
    db
      .select({
        batchId: batchInventoryConsumptions.batchId,
        id: batchInventoryConsumptions.id,
        consumptionDate: batchInventoryConsumptions.consumptionDate,
        quantity: batchInventoryConsumptions.quantity,
        unit: batchInventoryConsumptions.unit,
        unitCost: batchInventoryConsumptions.unitCost,
        lineCost: batchInventoryConsumptions.lineCost,
        referenceType: batchInventoryConsumptions.referenceType,
        referenceId: batchInventoryConsumptions.referenceId,
        notes: batchInventoryConsumptions.notes,
        itemName: sql<string>`(
          SELECT ingredient_name
          FROM feed_inventory
          WHERE feed_inventory.id = ${batchInventoryConsumptions.inventoryItemId}
        )`,
      })
      .from(batchInventoryConsumptions)
      .where(inArray(batchInventoryConsumptions.batchId, batchIds)),
    db
      .select({
        batchId: chickPlacements.batchId,
        id: chickPlacements.id,
        placementDate: chickPlacements.placementDate,
        supplierId: chickPlacements.supplierId,
        invoiceReference: chickPlacements.invoiceReference,
        deliveredQuantity: chickPlacements.deliveredQuantity,
        acceptedQuantity: chickPlacements.acceptedQuantity,
        unitCost: chickPlacements.unitCost,
        batchOpeningCost: chickPlacements.batchOpeningCost,
        notes: chickPlacements.notes,
      })
      .from(chickPlacements)
      .where(inArray(chickPlacements.batchId, batchIds)),
    db
      .select({
        siteId: siteInventoryConsumptions.siteId,
        id: siteInventoryConsumptions.id,
        consumptionDate: siteInventoryConsumptions.consumptionDate,
        quantity: siteInventoryConsumptions.quantity,
        unit: siteInventoryConsumptions.unit,
        unitCost: siteInventoryConsumptions.unitCost,
        lineCost: siteInventoryConsumptions.lineCost,
        referenceType: siteInventoryConsumptions.referenceType,
        referenceId: siteInventoryConsumptions.referenceId,
        notes: siteInventoryConsumptions.notes,
        itemName: sql<string>`(
          SELECT ingredient_name
          FROM feed_inventory
          WHERE feed_inventory.id = ${siteInventoryConsumptions.inventoryItemId}
        )`,
      })
      .from(siteInventoryConsumptions)
      .where(inArray(siteInventoryConsumptions.siteId, siteIds)),
    db
      .select({
        id: operationalExpenses.id,
        batchId: operationalExpenses.batchId,
        expenseDate: operationalExpenses.expenseDate,
        expenseCode: operationalExpenses.expenseCode,
        expenseCategory: operationalExpenses.expenseCategory,
        counterpartyName: operationalExpenses.counterpartyName,
        amount: operationalExpenses.amount,
        notes: operationalExpenses.notes,
      })
      .from(operationalExpenses)
      .where(
        and(
          eq(operationalExpenses.status, 'paid'),
          eq(operationalExpenses.allocationType, 'batch'),
          inArray(operationalExpenses.batchId, batchIds),
        ),
      ),
    db
      .select({
        id: operationalExpenses.id,
        siteId: operationalExpenses.siteId,
        expenseDate: operationalExpenses.expenseDate,
        expenseCode: operationalExpenses.expenseCode,
        expenseCategory: operationalExpenses.expenseCategory,
        counterpartyName: operationalExpenses.counterpartyName,
        amount: operationalExpenses.amount,
        notes: operationalExpenses.notes,
      })
      .from(operationalExpenses)
      .where(
        and(
          eq(operationalExpenses.status, 'paid'),
          eq(operationalExpenses.allocationType, 'site'),
          inArray(operationalExpenses.siteId, siteIds),
        ),
      ),
    db
      .select({
        id: operationalExpenses.id,
        expenseDate: operationalExpenses.expenseDate,
        expenseCode: operationalExpenses.expenseCode,
        expenseCategory: operationalExpenses.expenseCategory,
        counterpartyName: operationalExpenses.counterpartyName,
        amount: operationalExpenses.amount,
        notes: operationalExpenses.notes,
      })
      .from(operationalExpenses)
      .where(
        and(
          eq(operationalExpenses.status, 'paid'),
          eq(operationalExpenses.allocationType, 'shared_overhead'),
        ),
      ),
    db
      .select({
        id: serviceWorkOrders.id,
        batchId: serviceWorkOrders.batchId,
        serviceDate: serviceWorkOrders.serviceDate,
        workOrderCode: serviceWorkOrders.workOrderCode,
        serviceType: serviceWorkOrders.serviceType,
        title: serviceWorkOrders.title,
        totalAmount: serviceWorkOrders.totalAmount,
        notes: serviceWorkOrders.notes,
      })
      .from(serviceWorkOrders)
      .where(
        and(
          eq(serviceWorkOrders.status, 'paid'),
          eq(serviceWorkOrders.allocationType, 'batch'),
          inArray(serviceWorkOrders.batchId, batchIds),
        ),
      ),
    db
      .select({
        id: serviceWorkOrders.id,
        siteId: serviceWorkOrders.siteId,
        serviceDate: serviceWorkOrders.serviceDate,
        workOrderCode: serviceWorkOrders.workOrderCode,
        serviceType: serviceWorkOrders.serviceType,
        title: serviceWorkOrders.title,
        totalAmount: serviceWorkOrders.totalAmount,
        notes: serviceWorkOrders.notes,
      })
      .from(serviceWorkOrders)
      .where(
        and(
          eq(serviceWorkOrders.status, 'paid'),
          eq(serviceWorkOrders.allocationType, 'site'),
          inArray(serviceWorkOrders.siteId, siteIds),
        ),
      ),
    db
      .select({
        id: serviceWorkOrders.id,
        serviceDate: serviceWorkOrders.serviceDate,
        workOrderCode: serviceWorkOrders.workOrderCode,
        serviceType: serviceWorkOrders.serviceType,
        title: serviceWorkOrders.title,
        totalAmount: serviceWorkOrders.totalAmount,
        notes: serviceWorkOrders.notes,
      })
      .from(serviceWorkOrders)
      .where(
        and(
          eq(serviceWorkOrders.status, 'paid'),
          eq(serviceWorkOrders.allocationType, 'shared_overhead'),
        ),
      ),
    db
      .select({
        payrollId: payroll.id,
        payPeriod: payroll.payPeriod,
        grossSalary: payroll.grossSalary,
        employeeId: payroll.employeeId,
        employeeName: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
        siteId: employees.siteId,
      })
      .from(payroll)
      .innerJoin(employees, eq(payroll.employeeId, employees.id))
      .where(inArray(employees.siteId, siteIds)),
  ]);

  const allBatchesForAllocation = allBatches.map((batch) => ({
    ...batch,
    placementDate: String(batch.placementDate),
    actualDeliveryDate: batch.actualDeliveryDate ? String(batch.actualDeliveryDate) : null,
  }));

  for (const row of feedRows) {
    const summary = summaries.get(row.batchId);
    if (!summary) continue;
    const outputQty = Number(row.actualQuantity ?? 0);
    const productionCost = Number(row.productionCost ?? 0);
    const quantity = Number(row.quantity ?? 0);
    const unitCost = outputQty > 0 ? productionCost / outputQty : 0;
    const amount = roundCurrency(quantity * unitCost);
    summary.feedCost += amount;
    summary.ledger.push({
      componentType: 'feed',
      allocationType: 'direct',
      eventDate: String(row.distributionDate),
      sourceType: 'feed_distribution',
      sourceId: row.distributionId,
      sourceCode: row.productionCode ?? null,
      description: row.productionCode ? `Feed distribution from ${row.productionCode}` : 'Feed distribution',
      quantity,
      unit: row.unit,
      unitCost: roundCurrency(unitCost),
      amount,
      notes: row.notes,
    });
  }

  for (const row of inventoryRows) {
    const summary = summaries.get(row.batchId);
    if (!summary) continue;
    const amount = roundCurrency(Number(row.lineCost ?? 0));
    summary.inventoryCost += amount;
    summary.ledger.push({
      componentType: 'inventory',
      allocationType: 'direct',
      eventDate: String(row.consumptionDate),
      sourceType: row.referenceType ?? 'batch_inventory_consumption',
      sourceId: row.referenceId ?? row.id,
      sourceCode: null,
      description: row.itemName || 'Inventory consumption',
      quantity: Number(row.quantity ?? 0),
      unit: row.unit,
      unitCost: roundCurrency(Number(row.unitCost ?? 0)),
      amount,
      notes: row.notes,
    });
  }

  for (const row of chickPlacementRows) {
    const summary = summaries.get(row.batchId);
    if (!summary) continue;
    const amount = roundCurrency(Number(row.batchOpeningCost ?? 0));
    summary.inventoryCost += amount;
    summary.ledger.push({
      componentType: 'inventory',
      allocationType: 'direct',
      eventDate: String(row.placementDate),
      sourceType: 'chick_placement',
      sourceId: row.id,
      sourceCode: row.invoiceReference ?? null,
      description: 'Chick placement',
      quantity: Number(row.acceptedQuantity ?? row.deliveredQuantity ?? 0),
      unit: 'birds',
      unitCost: roundCurrency(Number(row.unitCost ?? 0)),
      amount,
      notes: row.notes,
    });
  }

  for (const row of siteInventoryRows) {
    const activeSiteBatches = allBatchesForAllocation.filter(
      (batch) => batch.siteId === row.siteId && isBatchActiveOnDate(batch, String(row.consumptionDate)),
    );
    if (activeSiteBatches.length === 0) continue;
    const share = roundCurrency(Number(row.lineCost ?? 0) / activeSiteBatches.length);
    for (const batch of activeSiteBatches) {
      const summary = summaries.get(batch.id);
      if (!summary) continue;
      summary.inventoryCost += share;
      summary.ledger.push({
        componentType: 'inventory',
        allocationType: 'site',
        eventDate: String(row.consumptionDate),
        sourceType: row.referenceType ?? 'site_inventory_consumption',
        sourceId: row.referenceId ?? row.id,
        sourceCode: null,
        description: row.itemName || 'Site inventory consumption',
        quantity: Number(row.quantity ?? 0),
        unit: row.unit,
        unitCost: roundCurrency(Number(row.unitCost ?? 0)),
        amount: share,
        notes: row.notes,
      });
    }
  }

  for (const row of directExpenseRows) {
    const summary = summaries.get(row.batchId ?? 0);
    if (!summary) continue;
    const amount = roundCurrency(Number(row.amount ?? 0));
    summary.operationalExpenseCost += amount;
    summary.ledger.push({
      componentType: 'operational_expense',
      allocationType: 'direct',
      eventDate: String(row.expenseDate),
      sourceType: 'operational_expense',
      sourceId: row.id,
      sourceCode: row.expenseCode,
      description: row.counterpartyName ? `${row.expenseCategory} - ${row.counterpartyName}` : row.expenseCategory,
      quantity: null,
      unit: null,
      unitCost: null,
      amount,
      notes: row.notes,
    });
  }

  for (const row of siteExpenseRows) {
    const activeSiteBatches = allBatchesForAllocation.filter(
      (batch) => batch.siteId === row.siteId && isBatchActiveOnDate(batch, String(row.expenseDate)),
    );
    if (activeSiteBatches.length === 0) continue;
    const share = roundCurrency(Number(row.amount ?? 0) / activeSiteBatches.length);
    for (const batch of activeSiteBatches) {
      const summary = summaries.get(batch.id);
      if (!summary) continue;
      summary.operationalExpenseCost += share;
      summary.ledger.push({
        componentType: 'operational_expense',
        allocationType: 'site',
        eventDate: String(row.expenseDate),
        sourceType: 'operational_expense',
        sourceId: row.id,
        sourceCode: row.expenseCode,
        description: row.counterpartyName ? `${row.expenseCategory} - ${row.counterpartyName}` : row.expenseCategory,
        quantity: null,
        unit: null,
        unitCost: null,
        amount: share,
        notes: row.notes,
      });
    }
  }

  for (const row of sharedExpenseRows) {
    const activeBatches = allBatchesForAllocation.filter((batch) => isBatchActiveOnDate(batch, String(row.expenseDate)));
    if (activeBatches.length === 0) continue;
    const share = roundCurrency(Number(row.amount ?? 0) / activeBatches.length);
    for (const batch of activeBatches) {
      const summary = summaries.get(batch.id);
      if (!summary) continue;
      summary.operationalExpenseCost += share;
      summary.ledger.push({
        componentType: 'operational_expense',
        allocationType: 'shared_overhead',
        eventDate: String(row.expenseDate),
        sourceType: 'operational_expense',
        sourceId: row.id,
        sourceCode: row.expenseCode,
        description: row.counterpartyName ? `${row.expenseCategory} - ${row.counterpartyName}` : row.expenseCategory,
        quantity: null,
        unit: null,
        unitCost: null,
        amount: share,
        notes: row.notes,
      });
    }
  }

  for (const row of directServiceRows) {
    const summary = summaries.get(row.batchId ?? 0);
    if (!summary) continue;
    const amount = roundCurrency(Number(row.totalAmount ?? 0));
    summary.operationalExpenseCost += amount;
    summary.ledger.push({
      componentType: 'operational_expense',
      allocationType: 'direct',
      eventDate: String(row.serviceDate),
      sourceType: 'service_work_order',
      sourceId: row.id,
      sourceCode: row.workOrderCode,
      description: `${row.serviceType} - ${row.title}`,
      quantity: null,
      unit: null,
      unitCost: null,
      amount,
      notes: row.notes,
    });
  }

  for (const row of siteServiceRows) {
    const activeSiteBatches = allBatchesForAllocation.filter(
      (batch) => batch.siteId === row.siteId && isBatchActiveOnDate(batch, String(row.serviceDate)),
    );
    if (activeSiteBatches.length === 0) continue;
    const share = roundCurrency(Number(row.totalAmount ?? 0) / activeSiteBatches.length);
    for (const batch of activeSiteBatches) {
      const summary = summaries.get(batch.id);
      if (!summary) continue;
      summary.operationalExpenseCost += share;
      summary.ledger.push({
        componentType: 'operational_expense',
        allocationType: 'site',
        eventDate: String(row.serviceDate),
        sourceType: 'service_work_order',
        sourceId: row.id,
        sourceCode: row.workOrderCode,
        description: `${row.serviceType} - ${row.title}`,
        quantity: null,
        unit: null,
        unitCost: null,
        amount: share,
        notes: row.notes,
      });
    }
  }

  for (const row of sharedServiceRows) {
    const activeBatches = allBatchesForAllocation.filter((batch) => isBatchActiveOnDate(batch, String(row.serviceDate)));
    if (activeBatches.length === 0) continue;
    const share = roundCurrency(Number(row.totalAmount ?? 0) / activeBatches.length);
    for (const batch of activeBatches) {
      const summary = summaries.get(batch.id);
      if (!summary) continue;
      summary.operationalExpenseCost += share;
      summary.ledger.push({
        componentType: 'operational_expense',
        allocationType: 'shared_overhead',
        eventDate: String(row.serviceDate),
        sourceType: 'service_work_order',
        sourceId: row.id,
        sourceCode: row.workOrderCode,
        description: `${row.serviceType} - ${row.title}`,
        quantity: null,
        unit: null,
        unitCost: null,
        amount: share,
        notes: row.notes,
      });
    }
  }

  for (const row of payrollRows) {
    const activeSiteBatches = allBatchesForAllocation.filter(
      (batch) => batch.siteId === row.siteId && isBatchActiveOnDate(batch, String(row.payPeriod)),
    );
    if (activeSiteBatches.length === 0) continue;
    const share = roundCurrency(Number(row.grossSalary ?? 0) / activeSiteBatches.length);
    for (const batch of activeSiteBatches) {
      const summary = summaries.get(batch.id);
      if (!summary) continue;
      summary.laborCost += share;
      summary.ledger.push({
        componentType: 'labor',
        allocationType: 'site',
        eventDate: String(row.payPeriod),
        sourceType: 'payroll',
        sourceId: row.payrollId,
        sourceCode: `PAY-${row.payrollId}`,
        description: `Payroll allocation - ${row.employeeName}`,
        quantity: null,
        unit: null,
        unitCost: null,
        amount: share,
        notes: null,
      });
    }
  }

  for (const summary of summaries.values()) {
    summary.feedCost = roundCurrency(summary.feedCost);
    summary.inventoryCost = roundCurrency(summary.inventoryCost);
    summary.laborCost = roundCurrency(summary.laborCost);
    summary.operationalExpenseCost = roundCurrency(summary.operationalExpenseCost);
    summary.totalCost = roundCurrency(
      summary.feedCost + summary.inventoryCost + summary.laborCost + summary.operationalExpenseCost,
    );
    summary.costPerBird = summary.totalCost > 0
      ? roundCurrency(summary.totalCost / Math.max(batchRows.find((batch) => batch.id === summary.batchId)?.chicksPlaced ?? 0, 1))
      : 0;
    summary.ledger.sort((a, b) => {
      const dateDiff = new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime();
      if (dateDiff !== 0) return dateDiff;
      return b.sourceId - a.sourceId;
    });
  }

  return summaries;
}

export async function buildSingleBatchCostSummary(batchId: number) {
  const [batch] = await db
    .select({
      id: batches.id,
      batchCode: batches.batchCode,
      siteId: batches.siteId,
      chicksPlaced: batches.chicksPlaced,
      placementDate: batches.placementDate,
      actualDeliveryDate: batches.actualDeliveryDate,
    })
    .from(batches)
    .where(eq(batches.id, batchId))
    .limit(1);

  if (!batch) {
    return null;
  }

  const summaries = await buildBatchCostSummaries([
    {
      ...batch,
      placementDate: String(batch.placementDate),
      actualDeliveryDate: batch.actualDeliveryDate ? String(batch.actualDeliveryDate) : null,
    },
  ]);

  return summaries.get(batchId) ?? null;
}
