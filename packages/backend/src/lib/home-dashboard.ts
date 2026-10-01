import { qualified } from './sql-utils';
import { and, desc, eq, gte, inArray, lte, notInArray, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  batches,
  chickPlacements,
  dailyRecords,
  financeCategories,
  inventoryAlerts,
  operationalExpenses,
  payroll,
  pettyCashExpenses,
  sales,
  sites,
  supplierInvoices,
  supplierPaymentAllocations,
  treasuryTransactionEntries,
  treasuryTransactions,
} from '../db/schema';
import { buildCostingModel, roundCurrency } from './costing';
import { listFinanceAccountsWithBalances } from './treasury';
import { toIsoDate } from './bird-days';
import { listDueHealthTasks } from './batch-health';
import { expiringLots } from './stock';
import { receivablesAgeing, upcomingBookings } from './sales-ops';
import { managementPnl, payablesAgeing } from './finance-reports';
import { pendingApprovalCount } from './approvals';

export type TodoTone = 'warning' | 'danger' | 'info';

export interface HomeTodo {
  key: string;
  title: string;
  detail: string;
  href: string;
  tone: TodoTone;
}

export interface HomeBatchCard {
  id: number;
  batchCode: string;
  siteName: string;
  ageDays: number;
  liveBirds: number;
  mortalityPct: number;
  averageWeightKg: number | null;
  costSoFar: number;
  costPerKgLive: number | null;
  note: string;
  tone: 'ok' | 'warning';
}

export interface HomeDashboard {
  money: null | {
    cashOnHand: number;
    accountCount: number;
    moneyInThisMonth: number;
    moneyOutThisMonth: number;
    moneyInLastMonth: number;
    moneyOutLastMonth: number;
    spendByGroup: Array<{ group: string; amount: number }>;
  };
  liveBirds: number | null;
  /** Owner view: this month's result and who owes whom (financial-report users only) */
  business: null | {
    monthProfit: number;
    monthIncome: number;
    monthExpenses: number;
    owedToYou: number;
    owedToYouOverdue: number;
    youOwe: number;
    youOweOverdue: number;
    approvalsWaiting: number;
  };
  batches: HomeBatchCard[] | null;
  todos: HomeTodo[];
}

const OPEN_STATUSES = ['placement', 'growing', 'ready_for_sale'];

function monthBounds(offset = 0) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 0));
  return { from: toIsoDate(start), to: toIsoDate(end) };
}

async function moneyTotals(from: string, to: string) {
  const [row] = await db
    .select({
      inflow: sql<number>`COALESCE(SUM(CASE WHEN ${treasuryTransactionEntries.entryDirection} = 'inflow' THEN ${treasuryTransactionEntries.amount}::numeric ELSE 0 END), 0)::float`,
      outflow: sql<number>`COALESCE(SUM(CASE WHEN ${treasuryTransactionEntries.entryDirection} = 'outflow' THEN ${treasuryTransactionEntries.amount}::numeric ELSE 0 END), 0)::float`,
    })
    .from(treasuryTransactionEntries)
    .innerJoin(treasuryTransactions, eq(treasuryTransactionEntries.treasuryTransactionId, treasuryTransactions.id))
    .innerJoin(financeCategories, eq(treasuryTransactionEntries.categoryId, financeCategories.id))
    .where(and(
      gte(treasuryTransactionEntries.valueDate, from),
      lte(treasuryTransactionEntries.valueDate, to),
      notInArray(financeCategories.categoryType, ['transfer']),
      notInArray(treasuryTransactions.status, ['voided', 'bounced']),
    ));
  return { inflow: roundCurrency(row?.inflow ?? 0), outflow: roundCurrency(row?.outflow ?? 0) };
}

async function buildMoney() {
  const accounts = await listFinanceAccountsWithBalances();
  const active = accounts.filter((account) => account.status === 'active');
  const thisMonth = monthBounds(0);
  const lastMonth = monthBounds(-1);
  const [current, previous, spendRows] = await Promise.all([
    moneyTotals(thisMonth.from, thisMonth.to),
    moneyTotals(lastMonth.from, lastMonth.to),
    db
      .select({
        group: financeCategories.reportGroup,
        amount: sql<number>`COALESCE(SUM(CASE WHEN ${treasuryTransactionEntries.entryDirection} = 'outflow' THEN ${treasuryTransactionEntries.amount}::numeric ELSE -${treasuryTransactionEntries.amount}::numeric END), 0)::float`,
      })
      .from(treasuryTransactionEntries)
      .innerJoin(treasuryTransactions, eq(treasuryTransactionEntries.treasuryTransactionId, treasuryTransactions.id))
      .innerJoin(financeCategories, eq(treasuryTransactionEntries.categoryId, financeCategories.id))
      .where(and(
        gte(treasuryTransactionEntries.valueDate, thisMonth.from),
        lte(treasuryTransactionEntries.valueDate, thisMonth.to),
        eq(financeCategories.categoryType, 'expense'),
        notInArray(treasuryTransactions.status, ['voided', 'bounced']),
      ))
      .groupBy(financeCategories.reportGroup),
  ]);

  const sorted = spendRows
    .map((row) => ({ group: row.group, amount: roundCurrency(row.amount) }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const top = sorted.slice(0, 4);
  const other = roundCurrency(sorted.slice(4).reduce((sum, row) => sum + row.amount, 0));
  if (other > 0) top.push({ group: 'Other', amount: other });

  return {
    cashOnHand: roundCurrency(active.reduce((sum, account) => sum + Number(account.currentBalance ?? 0), 0)),
    accountCount: active.length,
    moneyInThisMonth: current.inflow,
    moneyOutThisMonth: current.outflow,
    moneyInLastMonth: previous.inflow,
    moneyOutLastMonth: previous.outflow,
    spendByGroup: top,
  };
}

async function buildBatches(siteScope: number | null) {
  const open = await db
    .select({
      id: batches.id,
      batchCode: batches.batchCode,
      siteId: batches.siteId,
      siteName: sites.siteName,
      placementDate: batches.placementDate,
      chicksPlaced: batches.chicksPlaced,
    })
    .from(batches)
    .innerJoin(sites, eq(batches.siteId, sites.id))
    .where(and(
      inArray(batches.status, OPEN_STATUSES),
      siteScope ? eq(batches.siteId, siteScope) : undefined,
    ))
    .orderBy(batches.placementDate);
  if (open.length === 0) return { cards: [], liveBirds: 0, openIds: [] as number[] };

  const ids = open.map((batch) => batch.id);
  const [model, placementRows, deathRows, soldRows, latestRecords] = await Promise.all([
    buildCostingModel(),
    db.select({ batchId: chickPlacements.batchId, accepted: sql<number>`COALESCE(SUM(${chickPlacements.acceptedQuantity}), 0)::int` })
      .from(chickPlacements).where(inArray(chickPlacements.batchId, ids)).groupBy(chickPlacements.batchId),
    db.select({ batchId: dailyRecords.batchId, deaths: sql<number>`COALESCE(SUM(${dailyRecords.mortalityCount}), 0)::int` })
      .from(dailyRecords).where(inArray(dailyRecords.batchId, ids)).groupBy(dailyRecords.batchId),
    db.select({ batchId: sales.batchId, birds: sql<number>`COALESCE(SUM(${sales.totalBirds}), 0)::int` })
      .from(sales).where(and(inArray(sales.batchId, ids), sql`${sales.status} <> 'cancelled'`)).groupBy(sales.batchId),
    db.selectDistinctOn([dailyRecords.batchId], {
      batchId: dailyRecords.batchId,
      recordDate: dailyRecords.recordDate,
      averageWeight: dailyRecords.averageWeight,
    }).from(dailyRecords).where(inArray(dailyRecords.batchId, ids)).orderBy(dailyRecords.batchId, desc(dailyRecords.recordDate)),
  ]);
  const placements = new Map(placementRows.map((row) => [row.batchId, row.accepted]));
  const deaths = new Map(deathRows.map((row) => [row.batchId, row.deaths]));
  const sold = new Map(soldRows.map((row) => [row.batchId, row.birds]));
  const latest = new Map(latestRecords.map((row) => [row.batchId, row]));
  const today = toIsoDate(new Date());

  let liveBirds = 0;
  const cards = open.map((batch): HomeBatchCard => {
    const costs = model.summaries.get(batch.id);
    const birdsPlaced = placements.get(batch.id) ?? batch.chicksPlaced;
    const record = latest.get(batch.id);
    const death = deaths.get(batch.id) ?? 0;
    const live = Math.max(0, birdsPlaced - death - (sold.get(batch.id) ?? 0));
    // Daily logs record average weight in grams.
    const averageWeightKg = record?.averageWeight ? Number(record.averageWeight) / 1000 : null;
    const ageDays = Math.max(0, Math.round((new Date(today).getTime() - new Date(toIsoDate(batch.placementDate)).getTime()) / 86_400_000));
    const mortalityPct = birdsPlaced > 0 ? roundCurrency((death / birdsPlaced) * 100) : 0;
    const costSoFar = costs?.totalCost ?? 0;
    const costPerKgLive = averageWeightKg && live > 0 ? roundCurrency(costSoFar / (averageWeightKg * live)) : null;
    const daysSinceLog = record ? Math.round((new Date(today).getTime() - new Date(toIsoDate(record.recordDate)).getTime()) / 86_400_000) : null;

    let note = 'On track';
    let tone: 'ok' | 'warning' = 'ok';
    if (live === 0) {
      note = 'No birds left: close this batch';
      tone = 'warning';
    } else if (costs?.stale) {
      note = 'Open over 90 days: close or correct it';
      tone = 'warning';
    } else if (mortalityPct >= 5) {
      note = `Mortality ${mortalityPct.toFixed(1)}%: check the flock today`;
      tone = 'warning';
    } else if (daysSinceLog == null || daysSinceLog > 1) {
      note = daysSinceLog == null ? 'No daily log recorded yet' : `No daily log for ${daysSinceLog} days`;
      tone = 'warning';
    }
    liveBirds += live;
    return {
      id: batch.id,
      batchCode: batch.batchCode,
      siteName: batch.siteName,
      ageDays,
      liveBirds: live,
      mortalityPct,
      averageWeightKg,
      costSoFar,
      costPerKgLive,
      note,
      tone,
    };
  });
  return { cards, liveBirds, openIds: ids };
}

/** Everything the Home screen shows, trimmed to what the viewer is allowed to see. */
export async function buildHomeDashboard(params: {
  can: (permission: string) => boolean;
  siteScope: number | null;
}): Promise<HomeDashboard> {
  const todos: HomeTodo[] = [];
  const canMoney = params.can('treasury:read');
  const canBatches = params.can('batches:read');

  const [money, batchData] = await Promise.all([
    canMoney ? buildMoney() : Promise.resolve(null),
    canBatches ? buildBatches(params.siteScope) : Promise.resolve(null),
  ]);

  if (batchData && batchData.openIds.length > 0) {
    const due = await listDueHealthTasks({ asOf: toIsoDate(new Date()), siteId: params.siteScope });
    const today = toIsoDate(new Date());
    const overdue = due.filter((task) => toIsoDate(task.dueDate) < today);
    const dueToday = due.filter((task) => toIsoDate(task.dueDate) === today);
    if (overdue.length > 0) {
      todos.push({
        key: 'health-overdue',
        title: `${overdue.length} health task${overdue.length === 1 ? '' : 's'} overdue`,
        detail: overdue.slice(0, 2).map((task) => `${task.name} · ${task.batchCode}`).join('; '),
        href: `/batches/${overdue[0].batchId}/today`,
        tone: 'danger',
      });
    }
    for (const task of dueToday.slice(0, 3)) {
      todos.push({
        key: `health-${task.id}`,
        title: task.name,
        detail: `${task.batchCode} · day ${task.dayOfAge}`,
        href: `/batches/${task.batchId}/today`,
        tone: 'warning',
      });
    }
  }

  if (batchData) {
    const missingLogs = batchData.cards.filter((card) => card.note.startsWith('No daily log'));
    if (missingLogs.length > 0) {
      todos.push({
        key: 'daily-logs',
        title: `Record today's check for ${missingLogs.length} batch${missingLogs.length === 1 ? '' : 'es'}`,
        detail: missingLogs.map((card) => card.batchCode).join(', '),
        href: missingLogs.length === 1 ? `/batches/${missingLogs[0].id}/today` : '/batches',
        tone: 'warning',
      });
    }
  }

  if (canMoney) {
    const [uncategorized, pendingExpenses, pettyCash, payrollPending, invoicesDue] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int`, total: sql<number>`COALESCE(SUM(${treasuryTransactionEntries.amount}::numeric), 0)::float` })
        .from(treasuryTransactionEntries)
        .innerJoin(financeCategories, eq(treasuryTransactionEntries.categoryId, financeCategories.id))
        .where(eq(financeCategories.categoryType, 'suspense')),
      db.select({ count: sql<number>`count(*)::int`, total: sql<number>`COALESCE(SUM(${operationalExpenses.amount}::numeric), 0)::float` })
        .from(operationalExpenses).where(eq(operationalExpenses.status, 'pending_approval')),
      db.select({ count: sql<number>`count(*)::int`, total: sql<number>`COALESCE(SUM(${pettyCashExpenses.amount}::numeric), 0)::float` })
        .from(pettyCashExpenses).where(eq(pettyCashExpenses.status, 'submitted')),
      params.can('payroll:read')
        ? db.select({ count: sql<number>`count(*)::int` }).from(payroll).where(inArray(payroll.status, ['draft', 'reviewed', 'approved']))
        : Promise.resolve([{ count: 0 }]),
      db.select({
        count: sql<number>`count(*)::int`,
        total: sql<number>`COALESCE(SUM(${qualified(supplierInvoices.invoiceAmount)}::numeric - COALESCE((SELECT SUM(a.allocated_amount::numeric) FROM ${supplierPaymentAllocations} a WHERE a.supplier_invoice_id = ${qualified(supplierInvoices.id)}), 0)), 0)::float`,
      })
        .from(supplierInvoices)
        .where(and(
          eq(supplierInvoices.status, 'approved'),
          lte(supplierInvoices.dueDate, toIsoDate(new Date(Date.now() + 7 * 86_400_000))),
          sql`${qualified(supplierInvoices.invoiceAmount)}::numeric > COALESCE((SELECT SUM(a.allocated_amount::numeric) FROM ${supplierPaymentAllocations} a WHERE a.supplier_invoice_id = ${qualified(supplierInvoices.id)}), 0)`,
        )),
    ]);
    const rs = (value: number) => `Rs ${Math.round(value).toLocaleString('en-US')}`;
    if (pendingExpenses[0].count > 0) {
      todos.push({ key: 'expense-approvals', title: `Approve ${pendingExpenses[0].count} expense${pendingExpenses[0].count === 1 ? '' : 's'}`, detail: rs(pendingExpenses[0].total), href: '/treasury', tone: 'info' });
    }
    if (pettyCash[0].count > 0) {
      todos.push({ key: 'petty-cash', title: `Review ${pettyCash[0].count} petty cash spend${pettyCash[0].count === 1 ? '' : 's'}`, detail: rs(pettyCash[0].total), href: '/treasury', tone: 'info' });
    }
    if (invoicesDue[0].count > 0) {
      todos.push({ key: 'invoices-due', title: `${invoicesDue[0].count} supplier invoice${invoicesDue[0].count === 1 ? '' : 's'} due this week`, detail: `${rs(invoicesDue[0].total)} still to pay`, href: '/inventory', tone: 'warning' });
    }
    if (payrollPending[0].count > 0) {
      todos.push({ key: 'payroll', title: `Finish ${payrollPending[0].count} payroll record${payrollPending[0].count === 1 ? '' : 's'}`, detail: 'Awaiting review, approval or payment', href: '/payroll', tone: 'info' });
    }
    if (uncategorized[0].count > 0) {
      todos.push({ key: 'uncategorized', title: `Categorise ${uncategorized[0].count} money line${uncategorized[0].count === 1 ? '' : 's'}`, detail: `${rs(uncategorized[0].total)} needs a category`, href: '/treasury?tab=ledger', tone: 'warning' });
    }
  }

  if (params.can('feed_inventory:read') || params.can('inventory:read')) {
    const soon = await expiringLots({ withinDays: 30 });
    const expired = soon.filter((lot) => lot.expired);
    const expiringSoon = soon.filter((lot) => !lot.expired);
    if (expired.length > 0) {
      todos.push({
        key: 'stock-expired',
        title: `Write off ${expired.length} expired stock lot${expired.length === 1 ? '' : 's'}`,
        detail: `${expired.slice(0, 2).map((lot) => lot.itemName).join(', ')} · Rs ${Math.round(expired.reduce((sum, lot) => sum + lot.value, 0)).toLocaleString('en-US')}`,
        href: '/inventory?tab=stores',
        tone: 'danger',
      });
    }
    if (expiringSoon.length > 0) {
      todos.push({
        key: 'stock-expiring',
        title: `${expiringSoon.length} stock lot${expiringSoon.length === 1 ? '' : 's'} expire within 30 days`,
        detail: expiringSoon.slice(0, 2).map((lot) => `${lot.itemName} (${lot.daysLeft} days)`).join(', '),
        href: '/inventory?tab=stores',
        tone: 'warning',
      });
    }
    const [alerts] = await db.select({ count: sql<number>`count(*)::int` }).from(inventoryAlerts).where(eq(inventoryAlerts.status, 'active'));
    if (alerts.count > 0) {
      todos.push({ key: 'low-stock', title: `Reorder ${alerts.count} low-stock item${alerts.count === 1 ? '' : 's'}`, detail: 'Below reorder level', href: '/inventory', tone: 'warning' });
    }
  }

  if (params.can('sales:read')) {
    const [catches, ageing] = await Promise.all([upcomingBookings(3), receivablesAgeing()]);
    if (catches.length > 0) {
      const first = catches[0];
      todos.push({
        key: 'catching-soon',
        title: `${catches.length} booked catch${catches.length === 1 ? '' : 'es'} in the next 3 days`,
        detail: `${first.buyerName} · ${first.expectedBirds.toLocaleString('en-US')} birds on ${toIsoDate(first.catchDate)}`,
        href: '/sales?tab=bookings',
        tone: 'info',
      });
    }
    const late = ageing.buyers.filter((buyer) => buyer.oldestDaysOverdue > 0);
    if (late.length > 0) {
      todos.push({
        key: 'receivables-overdue',
        title: `${late.length} buyer${late.length === 1 ? '' : 's'} late paying`,
        detail: `Rs ${Math.round(ageing.overdue).toLocaleString('en-US')} overdue · ${late[0].buyerName} ${late[0].oldestDaysOverdue} days`,
        href: '/sales?tab=receivables',
        tone: late.some((buyer) => buyer.oldestDaysOverdue > 30) ? 'danger' : 'warning',
      });
    }
  }

  let business: HomeDashboard['business'] = null;
  if (params.can('reports:financial:read')) {
    const today = toIsoDate(new Date());
    const [pnl, receivables, payables, approvals] = await Promise.all([
      managementPnl({ from: `${today.slice(0, 7)}-01`, to: today }),
      receivablesAgeing(today),
      payablesAgeing(today),
      pendingApprovalCount(),
    ]);
    business = {
      monthProfit: pnl.netProfit.total,
      monthIncome: pnl.totalIncome.total,
      monthExpenses: pnl.totalExpenses.total,
      owedToYou: receivables.totalOwed,
      owedToYouOverdue: receivables.overdue,
      youOwe: payables.totalOwed,
      youOweOverdue: payables.overdue,
      approvalsWaiting: approvals,
    };
    if (approvals > 0 && params.can('approvals:decide')) {
      todos.unshift({ key: 'approvals', title: `${approvals} waiting for your approval`, detail: 'Purchase orders and payments over the limit', href: '/approvals', tone: 'warning' });
    }
  }

  return {
    money,
    business,
    liveBirds: batchData ? batchData.liveBirds : null,
    batches: batchData ? batchData.cards : null,
    todos,
  };
}
