import { sql } from 'drizzle-orm';
import { db } from '../db';

/**
 * Management reports built from the money ledger (cash basis).
 * Every figure comes from posted/cleared ledger lines, so the reports always agree with Money.
 */

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const POSTED = sql.raw(`('posted', 'cleared')`);

export class ReportInputError extends Error {}

function assertRange(from: string, to: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new ReportInputError('Dates must be YYYY-MM-DD');
  if (from > to) throw new ReportInputError('From date must be before To date');
}

/** Months (YYYY-MM) covering the range. */
export function monthsBetween(from: string, to: string) {
  const months: string[] = [];
  const d = new Date(`${from.slice(0, 7)}-01T00:00:00Z`);
  const end = to.slice(0, 7);
  while (d.toISOString().slice(0, 7) <= end) {
    months.push(d.toISOString().slice(0, 7));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return months;
}

type Rows<T> = T[];
async function rows<T>(query: ReturnType<typeof sql>): Promise<Rows<T>> {
  return (await db.execute(query)) as unknown as T[];
}

// ---------------------------------------------------------------------------
// Customer advances applied later → recognised as sales
// ---------------------------------------------------------------------------

type Reclass = { month: string; categoryCode: string; costCentreId: number | null; amount: number };

/**
 * A receipt larger than what was owed at the time is posted partly as "Customer advances".
 * When that credit is later applied to a sale, no cash moves — but for profit it is now
 * Bird Sales (or Other Farm Income) of that batch/farm, recognised on the day it was applied.
 */
async function advanceReclassifications(from: string, to: string): Promise<Reclass[]> {
  const lines = await rows<{ line_id: number; tx_id: number; posted_income: string; posted_advance: string }>(sql`
    SELECT l.id AS line_id, l.treasury_transaction_id AS tx_id,
      COALESCE(SUM(CASE WHEN fc.code IN ('bird_sales','other_farm_income') AND e.entry_direction = 'inflow' THEN e.amount::numeric END), 0) AS posted_income,
      COALESCE(SUM(CASE WHEN fc.code = 'customer_advances' AND e.entry_direction = 'inflow' THEN e.amount::numeric END), 0) AS posted_advance
    FROM buyer_receipt_lines l
    JOIN treasury_transactions t ON t.id = l.treasury_transaction_id AND t.status IN ${POSTED}
    JOIN treasury_transaction_entries e ON e.treasury_transaction_id = t.id
    JOIN finance_categories fc ON fc.id = e.category_id
    WHERE l.treasury_reversal_transaction_id IS NULL
    GROUP BY l.id, l.treasury_transaction_id
    HAVING COALESCE(SUM(CASE WHEN fc.code = 'customer_advances' AND e.entry_direction = 'inflow' THEN e.amount::numeric END), 0) > 0
  `);
  if (lines.length === 0) return [];

  const allocations = await rows<{ line_id: number; amount: string; applied_on: string; sale_type: string; cost_centre_id: number | null }>(sql`
    SELECT a.receipt_line_id AS line_id, a.allocated_amount AS amount, to_char(a.created_at, 'YYYY-MM-DD') AS applied_on,
      s.sale_type, cc.id AS cost_centre_id
    FROM buyer_receipt_allocations a
    JOIN sales s ON s.id = a.sale_id
    LEFT JOIN cost_centres cc ON cc.site_id = s.site_id
    WHERE a.receipt_line_id IN (${sql.join(lines.map((l) => sql`${l.line_id}`), sql`, `)})
    ORDER BY a.receipt_line_id, a.id
  `);

  const result: Reclass[] = [];
  for (const line of lines) {
    // The first `posted_income` of allocations were already counted as sales when the receipt was posted
    let alreadyCounted = Number(line.posted_income);
    let advanceLeft = Number(line.posted_advance);
    for (const allocation of allocations.filter((a) => a.line_id === line.line_id)) {
      let amount = Number(allocation.amount);
      const counted = Math.min(alreadyCounted, amount);
      alreadyCounted -= counted;
      amount = Math.min(amount - counted, advanceLeft);
      if (amount <= 0) continue;
      advanceLeft -= amount;
      if (allocation.applied_on < from || allocation.applied_on > to) continue;
      result.push({
        month: allocation.applied_on.slice(0, 7),
        categoryCode: allocation.sale_type === 'other_income' ? 'other_farm_income' : 'bird_sales',
        costCentreId: allocation.cost_centre_id,
        amount: round2(amount),
      });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Management P&L
// ---------------------------------------------------------------------------

export type PnlLine = { categoryCode: string; categoryName: string; reportGroup: string; byMonth: Record<string, number>; total: number };

export async function managementPnl(params: { from: string; to: string; costCentreId?: number | null }) {
  assertRange(params.from, params.to);
  const months = monthsBetween(params.from, params.to);
  const centreFilter = params.costCentreId ? sql`AND e.cost_centre_id = ${params.costCentreId}` : sql``;

  const ledger = await rows<{ code: string; name: string; category_type: 'income' | 'expense'; report_group: string; sort_order: number; month: string; amount: string }>(sql`
    SELECT fc.code, fc.name, fc.category_type, fc.report_group, fc.sort_order, to_char(t.transaction_date, 'YYYY-MM') AS month,
      SUM(CASE
        WHEN fc.category_type = 'income' AND e.entry_direction = 'inflow' THEN e.amount::numeric
        WHEN fc.category_type = 'income' THEN -e.amount::numeric
        WHEN e.entry_direction = 'outflow' THEN e.amount::numeric
        ELSE -e.amount::numeric END) AS amount
    FROM treasury_transaction_entries e
    JOIN treasury_transactions t ON t.id = e.treasury_transaction_id
    JOIN finance_categories fc ON fc.id = e.category_id
    WHERE t.status IN ${POSTED} AND fc.category_type IN ('income', 'expense')
      AND t.transaction_date BETWEEN ${params.from} AND ${params.to} ${centreFilter}
    GROUP BY fc.code, fc.name, fc.category_type, fc.report_group, fc.sort_order, month
  `);

  const categories = await rows<{ code: string; name: string; category_type: string; report_group: string; sort_order: number }>(sql`
    SELECT code, name, category_type, report_group, sort_order FROM finance_categories WHERE category_type IN ('income', 'expense')
  `);
  const meta = new Map(categories.map((c) => [c.code, c]));

  const income = new Map<string, PnlLine>();
  const expenses = new Map<string, PnlLine>();
  const add = (code: string, month: string, amount: number) => {
    const category = meta.get(code);
    if (!category || amount === 0) return;
    const target = category.category_type === 'income' ? income : expenses;
    const line = target.get(code) ?? { categoryCode: code, categoryName: category.name, reportGroup: category.report_group, byMonth: {}, total: 0 };
    line.byMonth[month] = round2((line.byMonth[month] ?? 0) + amount);
    line.total = round2(line.total + amount);
    target.set(code, line);
  };
  for (const row of ledger) add(row.code, row.month, Number(row.amount));

  const reclass = (await advanceReclassifications(params.from, params.to))
    .filter((r) => !params.costCentreId || r.costCentreId === params.costCentreId);
  for (const r of reclass) add(r.categoryCode, r.month, r.amount);

  const order = (a: PnlLine, b: PnlLine) => (meta.get(a.categoryCode)!.sort_order - meta.get(b.categoryCode)!.sort_order);
  const incomeLines = [...income.values()].sort(order);
  const expenseLines = [...expenses.values()].sort(order);
  const sumBy = (lines: PnlLine[]) => {
    const byMonth: Record<string, number> = {};
    for (const month of months) byMonth[month] = round2(lines.reduce((sum, l) => sum + (l.byMonth[month] ?? 0), 0));
    return { byMonth, total: round2(lines.reduce((sum, l) => sum + l.total, 0)) };
  };
  const totalIncome = sumBy(incomeLines);
  const totalExpenses = sumBy(expenseLines);
  const net: Record<string, number> = {};
  for (const month of months) net[month] = round2(totalIncome.byMonth[month] - totalExpenses.byMonth[month]);

  return {
    from: params.from,
    to: params.to,
    months,
    costCentreId: params.costCentreId ?? null,
    income: incomeLines,
    expenses: expenseLines,
    totalIncome,
    totalExpenses,
    netProfit: { byMonth: net, total: round2(totalIncome.total - totalExpenses.total) },
    margin: totalIncome.total > 0 ? round2(((totalIncome.total - totalExpenses.total) / totalIncome.total) * 100) : null,
    advancesRecognised: round2(reclass.reduce((sum, r) => sum + r.amount, 0)),
  };
}

/** P&L side by side for every cost centre (farms, mill, admin). */
export async function pnlByCostCentre(params: { from: string; to: string }) {
  assertRange(params.from, params.to);
  const centres = await rows<{ id: number; name: string; centre_type: string }>(sql`SELECT id, name, centre_type FROM cost_centres WHERE status = 'active' ORDER BY centre_type, name`);
  const columns = [];
  for (const centre of centres) {
    const pnl = await managementPnl({ ...params, costCentreId: centre.id });
    columns.push({ costCentreId: centre.id, name: centre.name, centreType: centre.centre_type, income: pnl.totalIncome.total, expenses: pnl.totalExpenses.total, net: pnl.netProfit.total });
  }
  const all = await managementPnl(params);
  const tagged = columns.reduce((sum, c) => ({ income: sum.income + c.income, expenses: sum.expenses + c.expenses }), { income: 0, expenses: 0 });
  return {
    columns,
    untagged: { income: round2(all.totalIncome.total - tagged.income), expenses: round2(all.totalExpenses.total - tagged.expenses) },
    total: { income: all.totalIncome.total, expenses: all.totalExpenses.total, net: all.netProfit.total },
  };
}

// ---------------------------------------------------------------------------
// Cash flow
// ---------------------------------------------------------------------------

const SECTION: Record<string, 'operating' | 'financing' | 'other'> = { income: 'operating', expense: 'operating', financing: 'financing', suspense: 'other', transfer: 'other' };

export async function cashFlow(params: { from: string; to: string; financeAccountId?: number | null }) {
  assertRange(params.from, params.to);
  const months = monthsBetween(params.from, params.to);
  const accountFilter = params.financeAccountId ? sql`AND e.finance_account_id = ${params.financeAccountId}` : sql``;
  const accountFilterA = params.financeAccountId ? sql`AND a.id = ${params.financeAccountId}` : sql``;

  const [opening] = await rows<{ opening: string }>(sql`
    SELECT COALESCE(SUM(a.opening_balance::numeric), 0) + COALESCE((
      SELECT SUM(CASE WHEN e.entry_direction = 'inflow' THEN e.amount::numeric ELSE -e.amount::numeric END)
      FROM treasury_transaction_entries e JOIN treasury_transactions t ON t.id = e.treasury_transaction_id
      WHERE t.status IN ${POSTED} AND t.transaction_date < ${params.from} ${accountFilter}
    ), 0) AS opening
    FROM finance_accounts a WHERE true ${accountFilterA}
  `);

  const flows = await rows<{ code: string; name: string; category_type: string; sort_order: number; month: string; inflow: string; outflow: string }>(sql`
    SELECT fc.code, fc.name, fc.category_type, fc.sort_order, to_char(t.transaction_date, 'YYYY-MM') AS month,
      COALESCE(SUM(CASE WHEN e.entry_direction = 'inflow' THEN e.amount::numeric END), 0) AS inflow,
      COALESCE(SUM(CASE WHEN e.entry_direction = 'outflow' THEN e.amount::numeric END), 0) AS outflow
    FROM treasury_transaction_entries e
    JOIN treasury_transactions t ON t.id = e.treasury_transaction_id
    JOIN finance_categories fc ON fc.id = e.category_id
    WHERE t.status IN ${POSTED} AND t.transaction_date BETWEEN ${params.from} AND ${params.to} ${accountFilter}
    GROUP BY fc.code, fc.name, fc.category_type, fc.sort_order, month
    ORDER BY fc.sort_order
  `);

  type Line = { categoryCode: string; categoryName: string; byMonth: Record<string, number>; total: number };
  const sections: Record<'operating' | 'financing' | 'other', Map<string, Line>> = { operating: new Map(), financing: new Map(), other: new Map() };
  for (const flow of flows) {
    // Transfers between your own accounts cancel out across all accounts; only show them for one account
    if (flow.category_type === 'transfer' && !params.financeAccountId) continue;
    const section = sections[SECTION[flow.category_type] ?? 'other'];
    const line = section.get(flow.code) ?? { categoryCode: flow.code, categoryName: flow.name, byMonth: {}, total: 0 };
    const net = round2(Number(flow.inflow) - Number(flow.outflow));
    line.byMonth[flow.month] = round2((line.byMonth[flow.month] ?? 0) + net);
    line.total = round2(line.total + net);
    section.set(flow.code, line);
  }
  const summarise = (map: Map<string, Line>) => {
    const lines = [...map.values()];
    const byMonth: Record<string, number> = {};
    for (const month of months) byMonth[month] = round2(lines.reduce((sum, l) => sum + (l.byMonth[month] ?? 0), 0));
    return { lines, byMonth, total: round2(lines.reduce((sum, l) => sum + l.total, 0)) };
  };
  const operating = summarise(sections.operating);
  const financing = summarise(sections.financing);
  const other = summarise(sections.other);

  const openingBalance = round2(Number(opening?.opening ?? 0));
  const balances: Record<string, { opening: number; net: number; closing: number }> = {};
  let running = openingBalance;
  for (const month of months) {
    const net = round2(operating.byMonth[month] + financing.byMonth[month] + other.byMonth[month]);
    balances[month] = { opening: running, net, closing: round2(running + net) };
    running = round2(running + net);
  }

  return { from: params.from, to: params.to, months, openingBalance, operating, financing, other, balances, closingBalance: running, netChange: round2(running - openingBalance) };
}

// ---------------------------------------------------------------------------
// Payables
// ---------------------------------------------------------------------------

const BUCKETS = ['current', 'days1to30', 'days31to60', 'days61to90', 'over90'] as const;
type Bucket = (typeof BUCKETS)[number];
const emptyBuckets = (): Record<Bucket, number> => ({ current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0 });
const bucketFor = (days: number): Bucket => (days <= 0 ? 'current' : days <= 30 ? 'days1to30' : days <= 60 ? 'days31to60' : days <= 90 ? 'days61to90' : 'over90');
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

const PAID_ALLOCATIONS = (asOf: string) => sql`
  SELECT COALESCE(SUM(spa.allocated_amount::numeric), 0) FROM supplier_payment_allocations spa
  JOIN supplier_payments sp ON sp.id = spa.supplier_payment_id
  WHERE spa.supplier_invoice_id = i.id AND sp.payment_status <> 'bounced' AND sp.treasury_reversal_transaction_id IS NULL AND sp.payment_date <= ${asOf}`;

/** What you owe each supplier, by how late it is (from the invoice due date). */
export async function payablesAgeing(asOf = new Date().toISOString().slice(0, 10)) {
  const invoices = await rows<{ id: number; invoice_code: string; invoice_reference: string; invoice_date: string; due_date: string; amount: string; paid: string; supplier_id: number; supplier_name: string; status: string; match_status: string | null }>(sql`
    SELECT i.id, i.invoice_code, i.invoice_reference, to_char(i.invoice_date, 'YYYY-MM-DD') AS invoice_date, to_char(i.due_date, 'YYYY-MM-DD') AS due_date,
      i.invoice_amount AS amount, (${PAID_ALLOCATIONS(asOf)}) AS paid, s.id AS supplier_id, s.supplier_name, i.status, i.match_status
    FROM supplier_invoices i JOIN suppliers s ON s.id = i.supplier_id
    WHERE i.status NOT IN ('cancelled', 'rejected') AND i.invoice_date <= ${asOf}
    ORDER BY i.due_date
  `);
  const credits = await rows<{ supplier_id: number; unapplied: string }>(sql`
    SELECT sp.supplier_id, SUM(sp.amount::numeric - COALESCE((SELECT SUM(spa.allocated_amount::numeric) FROM supplier_payment_allocations spa WHERE spa.supplier_payment_id = sp.id), 0)) AS unapplied
    FROM supplier_payments sp
    WHERE sp.payment_status <> 'bounced' AND sp.treasury_reversal_transaction_id IS NULL AND sp.payment_date <= ${asOf}
    GROUP BY sp.supplier_id
  `);

  type Row = { supplierId: number; supplierName: string; buckets: Record<Bucket, number>; totalOwed: number; unappliedCredit: number; oldestDaysOverdue: number; awaitingApproval: number;
    invoices: Array<{ invoiceId: number; invoiceCode: string; reference: string; invoiceDate: string; dueDate: string; outstanding: number; daysOverdue: number; bucket: Bucket; status: string; matchStatus: string | null }> };
  const bySupplier = new Map<number, Row>();
  for (const inv of invoices) {
    const outstanding = round2(Number(inv.amount) - Number(inv.paid));
    if (outstanding <= 0.009) continue;
    const daysOverdue = daysBetween(inv.due_date, asOf);
    const bucket = bucketFor(daysOverdue);
    const row = bySupplier.get(inv.supplier_id) ?? { supplierId: inv.supplier_id, supplierName: inv.supplier_name, buckets: emptyBuckets(), totalOwed: 0, unappliedCredit: 0, oldestDaysOverdue: 0, awaitingApproval: 0, invoices: [] };
    row.buckets[bucket] = round2(row.buckets[bucket] + outstanding);
    row.totalOwed = round2(row.totalOwed + outstanding);
    row.oldestDaysOverdue = Math.max(row.oldestDaysOverdue, daysOverdue);
    if (inv.status === 'recorded') row.awaitingApproval = round2(row.awaitingApproval + outstanding);
    row.invoices.push({ invoiceId: inv.id, invoiceCode: inv.invoice_code, reference: inv.invoice_reference, invoiceDate: inv.invoice_date, dueDate: inv.due_date, outstanding, daysOverdue, bucket, status: inv.status, matchStatus: inv.match_status });
    bySupplier.set(inv.supplier_id, row);
  }
  for (const credit of credits) {
    const row = bySupplier.get(credit.supplier_id);
    if (row) row.unappliedCredit = Math.max(round2(Number(credit.unapplied)), 0);
  }
  const suppliersList = [...bySupplier.values()].sort((a, b) => b.oldestDaysOverdue - a.oldestDaysOverdue || b.totalOwed - a.totalOwed);
  const totals = emptyBuckets();
  for (const row of suppliersList) for (const key of BUCKETS) totals[key] = round2(totals[key] + row.buckets[key]);
  const totalOwed = round2(suppliersList.reduce((sum, r) => sum + r.totalOwed, 0));
  return { asOf, suppliers: suppliersList, totals, totalOwed, overdue: round2(totalOwed - totals.current) };
}

/** Supplier statement: invoices raise what you owe, payments reduce it. */
export async function supplierStatement(supplierId: number, from: string, to: string) {
  assertRange(from, to);
  const [supplier] = await rows<{ id: number; supplier_name: string; contact_person: string | null; phone: string | null }>(sql`
    SELECT id, supplier_name, contact_person, phone_number AS phone FROM suppliers WHERE id = ${supplierId}
  `);
  if (!supplier) throw new ReportInputError('Supplier not found');
  const entries = await rows<{ kind: 'invoice' | 'payment'; id: number; entry_date: string; reference: string; description: string; amount: string; status: string }>(sql`
    SELECT 'invoice' AS kind, i.id, to_char(i.invoice_date, 'YYYY-MM-DD') AS entry_date, i.invoice_code AS reference,
      'Invoice ' || i.invoice_reference AS description, i.invoice_amount AS amount, i.status
    FROM supplier_invoices i WHERE i.supplier_id = ${supplierId} AND i.status NOT IN ('cancelled', 'rejected') AND i.invoice_date <= ${to}
    UNION ALL
    SELECT 'payment', sp.id, to_char(sp.payment_date, 'YYYY-MM-DD'), sp.payment_code,
      'Payment (' || replace(sp.payment_method, '_', ' ') || ')', sp.amount, sp.payment_status
    FROM supplier_payments sp WHERE sp.supplier_id = ${supplierId} AND sp.payment_status <> 'bounced' AND sp.treasury_reversal_transaction_id IS NULL AND sp.payment_date <= ${to}
    ORDER BY entry_date, kind DESC, id
  `);
  let balance = 0;
  let openingBalance = 0;
  const lines = [];
  for (const entry of entries) {
    const amount = Number(entry.amount);
    balance = round2(balance + (entry.kind === 'invoice' ? amount : -amount));
    if (entry.entry_date < from) { openingBalance = balance; continue; }
    lines.push({ id: `${entry.kind}-${entry.id}`, entryType: entry.kind, entryDate: entry.entry_date, referenceCode: entry.reference, description: entry.description,
      charged: entry.kind === 'invoice' ? amount : 0, paid: entry.kind === 'payment' ? amount : 0, runningBalance: balance, status: entry.status });
  }
  return {
    supplier: { id: supplier.id, supplierName: supplier.supplier_name, contactPerson: supplier.contact_person, phone: supplier.phone },
    from, to, openingBalance,
    totalInvoiced: round2(lines.reduce((s, l) => s + l.charged, 0)),
    totalPaid: round2(lines.reduce((s, l) => s + l.paid, 0)),
    closingBalance: balance,
    entries: lines,
  };
}
