/**
 * Writes docs/testing/Test-Data-Sheet.md from what is actually in the database after a build:
 * the real codes, dates and balances the test plans refer to.
 */
import fs from 'fs';
import path from 'path';
import { sql } from 'drizzle-orm';
import { money, month, TODAY, weekday } from './harness';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw SQL rows
type Row = Record<string, any>;
type PersonaRow = { key: string; email: string; firstName: string; lastName: string; role: string; farm: string | null };

const ROLE_LABEL: Record<string, string> = {
  system_admin: 'System admin', farm_manager: 'Farm manager', accountant: 'Accountant', supervisor: 'Supervisor',
  feed_mill_operator: 'Feed mill operator', farm_worker: 'Farm worker', viewer: 'Viewer',
};
const FARM_LABEL: Record<string, string> = { main: 'Main Farm', expansion: 'Expansion 1' };

const date = (value: unknown) => (value ? String(value instanceof Date ? value.toISOString() : value).slice(0, 10) : '');
const num = (value: unknown) => money(value as number);
const words = (value: unknown) => String(value ?? '').replace(/_/g, ' ');

function table(headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  if (rows.length === 0) return '_None._\n';
  const line = (cells: Array<string | number | null | undefined>) => `| ${cells.map((cell) => String(cell ?? '').replace(/\|/g, '/')).join(' | ')} |`;
  return `${line(headers)}\n${line(headers.map(() => '---'))}\n${rows.map(line).join('\n')}\n`;
}

export async function writeDataSheet(params: { file: string; copiedUsers: string[]; personas: PersonaRow[] }) {
  const { db } = await import('../index');
  const q = async (query: string) => (await db.execute(sql.raw(query))) as unknown as Row[];
  const M1 = month(1);
  const M2 = month(2);
  const M3 = month(3);

  const batches = await q(`
    SELECT b.batch_code, s.site_name, c.cage_number, b.status, b.placement_date, b.chicks_placed,
      (DATE '${TODAY}' - b.placement_date) AS age,
      COALESCE((SELECT SUM(mortality_count) FROM daily_records d WHERE d.batch_id = b.id), 0) AS deaths,
      COALESCE((SELECT SUM(total_birds) FROM sales x WHERE x.batch_id = b.id AND x.status <> 'cancelled'), 0) AS sold,
      COALESCE((SELECT SUM(expected_birds) FROM sale_bookings k WHERE k.batch_id = b.id AND k.status = 'booked'), 0) AS booked,
      (SELECT MAX(record_date) FROM daily_records d WHERE d.batch_id = b.id) AS last_check
    FROM batches b JOIN sites s ON s.id = b.site_id JOIN cages c ON c.id = b.cage_id ORDER BY b.placement_date`);
  const closed = await q(`
    SELECT b.batch_code, c.revenue, c.total_cost, c.profit, c.kpis FROM batch_close_snapshots c JOIN batches b ON b.id = c.batch_id ORDER BY c.id`);
  const houses = await q(`SELECT s.site_name, c.cage_number, c.status, c.capacity FROM cages c JOIN sites s ON s.id = c.site_id ORDER BY s.id, c.id`);
  const tasks = await q(`
    SELECT b.batch_code, t.name, t.due_date, t.planned_quantity, i.ingredient_name
    FROM batch_health_tasks t JOIN batches b ON b.id = t.batch_id LEFT JOIN feed_inventory i ON i.id = t.inventory_item_id
    WHERE t.status = 'pending' ORDER BY t.due_date`);
  const stock = await q(`
    SELECT i.ingredient_name, i.unit, i.reorder_level, i.quantity,
      COALESCE(SUM(l.remaining_quantity) FILTER (WHERE x.code = 'MAIN'), 0) AS main,
      COALESCE(SUM(l.remaining_quantity) FILTER (WHERE x.code = 'MILL'), 0) AS mill,
      COALESCE(SUM(l.remaining_quantity) FILTER (WHERE x.site_id = (SELECT id FROM sites WHERE site_name = 'Main Farm')), 0) AS main_farm,
      COALESCE(SUM(l.remaining_quantity) FILTER (WHERE x.site_id = (SELECT id FROM sites WHERE site_name = 'Expansion 1')), 0) AS expansion
    FROM feed_inventory i LEFT JOIN inventory_lots l ON l.inventory_item_id = i.id LEFT JOIN stock_locations x ON x.id = l.location_id
    GROUP BY i.id ORDER BY i.id`);
  const dated = await q(`
    SELECT l.lot_code, i.ingredient_name, x.name AS store, l.remaining_quantity, i.unit, l.expiry_date
    FROM inventory_lots l JOIN feed_inventory i ON i.id = l.inventory_item_id JOIN stock_locations x ON x.id = l.location_id
    WHERE l.expiry_date IS NOT NULL AND l.remaining_quantity > 0 AND l.expiry_date <= DATE '${TODAY}' + 30 ORDER BY l.expiry_date`);
  const orders = await q(`
    SELECT p.order_code, s.supplier_name, p.order_date, p.status, p.total_cost, p.notes,
      (SELECT string_agg(i.ingredient_name || ' ' || trim(to_char(pi.received_quantity, 'FM999,999,990')) || '/' || trim(to_char(pi.ordered_quantity, 'FM999,999,990')), '; ' ORDER BY pi.id)
         FROM purchase_order_items pi JOIN feed_inventory i ON i.id = pi.inventory_item_id WHERE pi.purchase_order_id = p.id) AS lines
    FROM purchase_orders p JOIN suppliers s ON s.id = p.supplier_id ORDER BY p.id`);
  const invoices = await q(`
    SELECT v.invoice_reference, s.supplier_name, p.order_code, v.invoice_date, v.due_date, v.invoice_amount, v.status, v.match_status,
      COALESCE((SELECT SUM(a.allocated_amount) FROM supplier_payment_allocations a WHERE a.supplier_invoice_id = v.id), 0) AS paid
    FROM supplier_invoices v JOIN suppliers s ON s.id = v.supplier_id LEFT JOIN purchase_orders p ON p.id = v.purchase_order_id ORDER BY v.id`);
  const requests = await q(`
    SELECT r.requisition_code, u.full_name, c.name AS centre, r.status,
      (SELECT string_agg(i.ingredient_name || ' × ' || trim(to_char(ri.quantity, 'FM999,990')), '; ') FROM purchase_requisition_items ri JOIN feed_inventory i ON i.id = ri.inventory_item_id WHERE ri.requisition_id = r.id) AS lines
    FROM purchase_requisitions r JOIN users u ON u.id = r.requested_by JOIN cost_centres c ON c.id = r.cost_centre_id ORDER BY r.id`);
  const workOrders = await q(`SELECT w.work_order_code, w.title, s.supplier_name, w.total_amount, w.status FROM service_work_orders w JOIN suppliers s ON s.id = w.supplier_id ORDER BY w.id`);
  const runs = await q(`
    SELECT p.production_code, r.recipe_name, p.production_date, p.status, p.planned_quantity, p.actual_quantity,
      COALESCE((SELECT SUM(d.quantity) FROM feed_distributions d WHERE d.production_batch_id = p.id), 0) AS sent
    FROM feed_production_batches p JOIN feed_recipes r ON r.id = p.recipe_id ORDER BY p.production_date, p.id`);
  // "Owes" follows the app: draft sales don't count yet, and a cheque counts only once it has cleared
  const buyers = await q(`
    SELECT b.buyer_name, b.credit_terms, b.credit_limit,
      COALESCE((SELECT SUM(x.total_amount) FROM sales x WHERE x.buyer_id = b.id AND x.status NOT IN ('cancelled', 'draft')), 0)
      - COALESCE((SELECT SUM(a.allocated_amount) FROM buyer_receipt_allocations a JOIN sales x ON x.id = a.sale_id
                  JOIN buyer_receipt_lines l ON l.id = a.receipt_line_id WHERE x.buyer_id = b.id AND l.payment_status = 'completed'), 0) AS owed
    FROM buyers b ORDER BY b.id`);
  const sales = await q(`
    SELECT x.sale_code, b.buyer_name, COALESCE(t.batch_code, x.item_description) AS what, x.sale_date, x.due_date, x.status, x.total_birds, x.total_weight, x.total_amount,
      COALESCE((SELECT SUM(a.allocated_amount) FROM buyer_receipt_allocations a JOIN buyer_receipt_lines l ON l.id = a.receipt_line_id WHERE a.sale_id = x.id AND l.payment_status = 'completed'), 0) AS received,
      COALESCE((SELECT SUM(a.allocated_amount) FROM buyer_receipt_allocations a JOIN buyer_receipt_lines l ON l.id = a.receipt_line_id WHERE a.sale_id = x.id AND l.payment_status = 'pending'), 0) AS cheques
    FROM sales x JOIN buyers b ON b.id = x.buyer_id LEFT JOIN batches t ON t.id = x.batch_id ORDER BY x.sale_date, x.id`);
  const bookings = await q(`
    SELECT k.booking_code, b.buyer_name, t.batch_code, k.catch_date, k.expected_birds, k.expected_avg_weight_kg, k.price_per_kg, k.status
    FROM sale_bookings k JOIN buyers b ON b.id = k.buyer_id JOIN batches t ON t.id = k.batch_id ORDER BY k.catch_date`);
  const cheques = await q(`
    SELECT l.cheque_number, l.bank_name, l.cheque_date, l.payment_amount, l.payment_status, b.buyer_name
    FROM buyer_receipt_lines l JOIN buyer_receipts r ON r.id = l.receipt_id JOIN buyers b ON b.id = r.buyer_id WHERE l.payment_method = 'cheque' ORDER BY l.id`);
  const staff = await q(`
    SELECT e.first_name || ' ' || e.last_name AS name, e.designation, s.site_name, c.name AS centre, e.employment_type, e.epf_number, e.epf_eligible,
      r.pay_type, r.base_rate,
      (SELECT string_agg(k.name || ' ' || trim(to_char(k.value, 'FM999,990')), '; ') FROM employee_compensation_components k WHERE k.revision_id = r.id) AS extras,
      EXISTS (SELECT 1 FROM bank_details d WHERE d.employee_id = e.id) AS has_bank
    FROM employees e JOIN sites s ON s.id = e.site_id LEFT JOIN cost_centres c ON c.id = e.cost_centre_id
    LEFT JOIN employee_compensation_revisions r ON r.employee_id = e.id AND r.is_active ORDER BY e.id`);
  const loans = await q(`
    SELECT l.loan_code, e.first_name || ' ' || e.last_name AS name, l.loan_type, l.principal, l.installment_amount, l.issued_date, l.first_recovery_period, l.status,
      COALESCE((SELECT SUM(amount) FROM staff_loan_recoveries r WHERE r.loan_id = l.id), 0) AS recovered
    FROM staff_loans l JOIN employees e ON e.id = l.employee_id ORDER BY l.id`);
  // What last month's payroll should come to by the documented rule (basic ÷ working days × days attended)
  const workingDays = M1.days.filter((d) => weekday(d) !== 0).length;
  const expectedPay = (await q(`
    SELECT e.first_name || ' ' || e.last_name AS name, e.epf_eligible, r.pay_type, r.base_rate,
      COALESCE((SELECT SUM(CASE WHEN a.status = 'present' THEN 1 WHEN a.status = 'half_day' THEN 0.5 ELSE 0 END) FROM attendance a
                WHERE a.employee_id = e.id AND a.attendance_date BETWEEN DATE '${M1.start}' AND DATE '${M1.end}'), 0) AS attended,
      COALESCE((SELECT SUM(k.value) FROM employee_compensation_components k WHERE k.revision_id = r.id AND k.component_type = 'earning'), 0) AS allowances,
      COALESCE((SELECT SUM(k.value) FROM employee_compensation_components k WHERE k.revision_id = r.id AND k.component_type = 'earning' AND k.counts_for_epf), 0) AS epf_allowances,
      COALESCE((SELECT SUM(LEAST(COALESCE(l.installment_amount, l.principal), l.principal - COALESCE((SELECT SUM(amount) FROM staff_loan_recoveries v WHERE v.loan_id = l.id), 0)))
                FROM staff_loans l WHERE l.employee_id = e.id AND l.status = 'active' AND l.first_recovery_period <= DATE '${M1.start}'), 0) AS recovery
    FROM employees e JOIN employee_compensation_revisions r ON r.employee_id = e.id AND r.is_active ORDER BY e.id`)).map((row) => {
    const attended = Number(row.attended);
    const basic = row.pay_type === 'monthly' ? (Number(row.base_rate) / workingDays) * attended : Number(row.base_rate) * attended;
    const gross = basic + Number(row.allowances);
    const epf = row.epf_eligible ? (basic + Number(row.epf_allowances)) * 0.08 : 0;
    const epfBase = row.epf_eligible ? basic + Number(row.epf_allowances) : 0;
    const recovery = Math.min(Number(row.recovery), gross - epf);
    return { name: row.name, attended, basic, allowances: Number(row.allowances), gross, epf, recovery, net: gross - epf - recovery, employer: epfBase * 0.12, etf: epfBase * 0.03 };
  });
  const sum = (key: 'gross' | 'epf' | 'recovery' | 'net' | 'employer' | 'etf') => expectedPay.reduce((total, row) => total + row[key], 0);
  const absences = await q(`
    SELECT a.attendance_date, e.first_name || ' ' || e.last_name AS name, a.status, a.leave_type
    FROM attendance a JOIN employees e ON e.id = a.employee_id WHERE a.status <> 'present' ORDER BY a.attendance_date, e.id`);
  const payrolls = await q(`SELECT to_char(pay_period, 'YYYY-MM') AS period, status, COUNT(*) AS people, SUM(gross_salary) AS gross, SUM(net_salary) AS net FROM payroll GROUP BY 1, 2 ORDER BY 1`);
  const accounts = await q(`
    SELECT a.id, a.account_name, a.account_type, a.opening_balance,
      COALESCE(SUM(e.amount) FILTER (WHERE e.entry_direction = 'inflow' AND t.status IN ('posted', 'cleared')), 0) AS money_in,
      COALESCE(SUM(e.amount) FILTER (WHERE e.entry_direction = 'outflow' AND t.status IN ('posted', 'cleared')), 0) AS money_out
    FROM finance_accounts a LEFT JOIN treasury_transaction_entries e ON e.finance_account_id = a.id
    LEFT JOIN treasury_transactions t ON t.id = e.treasury_transaction_id GROUP BY a.id ORDER BY a.id`);
  const ledger = await q(`
    SELECT t.transaction_date, t.transaction_code, a.account_name, e.entry_direction, e.amount, f.name AS category, c.name AS centre, b.batch_code,
      COALESCE(NULLIF(t.counterparty_name_snapshot, ''), '') AS who, t.narrative, t.status
    FROM treasury_transaction_entries e JOIN treasury_transactions t ON t.id = e.treasury_transaction_id
    JOIN finance_accounts a ON a.id = e.finance_account_id LEFT JOIN finance_categories f ON f.id = e.category_id
    LEFT JOIN cost_centres c ON c.id = e.cost_centre_id LEFT JOIN batches b ON b.id = e.batch_id
    ORDER BY t.transaction_date, t.id, e.id`);
  const bankLoans = await q(`
    SELECT l.loan_code, l.lender, l.principal, l.received_date,
      COALESCE((SELECT SUM(principal_amount) FROM business_loan_repayments r WHERE r.loan_id = l.id), 0) AS repaid,
      COALESCE((SELECT SUM(interest_amount) FROM business_loan_repayments r WHERE r.loan_id = l.id), 0) AS interest
    FROM business_loans l ORDER BY l.id`);
  const [limits] = await q(`SELECT config_value FROM system_config WHERE config_key = 'approvals.limits'`);
  const pettyWaiting = await q(`SELECT expense_date, amount, justification FROM petty_cash_expenses WHERE status NOT IN ('approved', 'rejected') ORDER BY id`);
  const expensesWaiting = await q(`SELECT expense_code, expense_date, counterparty_name, amount, status FROM operational_expenses ORDER BY id`);
  const approvals = await q(`SELECT a.summary, a.amount, u.full_name FROM approval_requests a JOIN users u ON u.id = a.requested_by WHERE a.status = 'pending'`);
  const admins = await q(`SELECT email, full_name, user_role FROM users WHERE firebase_uid NOT LIKE 'uat:%' ORDER BY id`);

  const live = (b: Row) => Number(b.chicks_placed) - Number(b.deaths) - Number(b.sold);
  const totalCash = accounts.reduce((sum, a) => sum + Number(a.opening_balance) + Number(a.money_in) - Number(a.money_out), 0);
  const approvalLimits = (typeof limits?.config_value === 'string' ? JSON.parse(limits.config_value) : limits?.config_value) ?? {};

  const out: string[] = [];
  const add = (...lines: string[]) => out.push(...lines);

  add(
    '# Test data sheet',
    '',
    '> **Do not edit by hand.** This file is written by `npm run db:testdata` and replaced every time the test data is rebuilt.',
    '',
    `**Built as of:** ${TODAY}. Every date below is counted back (or forward) from that day, so the picture is the same whenever it is rebuilt.`,
    '',
    'This sheet lists what is already in the system before any tester starts: the codes, dates and amounts the test plans refer to. Keep it open beside the plan you are working through. Once testers start changing things, the app is the truth and this sheet is the starting point.',
    '',
    '| Name used in the plans | Month |',
    '|---|---|',
    `| **This month** | ${month(0).label} |`,
    `| **Last month** (attendance complete, payroll not yet run) | ${M1.label} |`,
    `| **Two months ago** (payroll run and paid, EPF/ETF paid) | ${M2.label} |`,
    `| **Three months ago** (nothing happened; free for the period-lock test) | ${M3.label} |`,
    '',
    '## 1. Sign-ins',
    '',
    table(['Person', 'Email', 'Role', 'Farm', 'Can sign in now?'], [
      ...admins.map((u) => [u.full_name, u.email, ROLE_LABEL[u.user_role] ?? u.user_role, 'All farms', 'Yes (same password as the development system)']),
      ...params.personas.map((p) => [`${p.firstName} ${p.lastName}`, p.email, ROLE_LABEL[p.role] ?? p.role, p.farm ? FARM_LABEL[p.farm] : 'All farms', 'After `npm run db:testdata:signins`']),
    ]),
    'The people with `@farmflow.test` addresses are made-up staff, one per role. They exist so the access tests have someone to sign in as. See the README for how to give them passwords, or register your real testers under **Settings → Users** with the same role and farm.',
    '',
    `**Approval limits:** purchase orders at or above Rs ${num(approvalLimits.purchaseOrder)}; money going out at or above Rs ${num(approvalLimits.moneyOut)}. System admins and accountants are approvers, so nothing they raise waits.`,
    '',
    '## 2. Farms, houses and batches',
    '',
    table(['Farm', 'House', 'State'], houses.map((h) => [h.site_name, h.cage_number, h.status === 'maintenance' ? 'Being cleaned out (turnaround in progress)' : words(h.status)])),
    table(['Batch', 'Farm / house', 'Status', 'Placed on', 'Age today', 'Chicks placed', 'Deaths', 'Sold', 'Live birds', 'Booked', 'Last daily check'],
      batches.map((b) => [`**${b.batch_code}**`, `${b.site_name} / ${b.cage_number}`, words(b.status), date(b.placement_date), b.status === 'closed' ? '—' : `${b.age} days`,
        num(b.chicks_placed), num(b.deaths), num(b.sold), num(live(b)), num(b.booked), date(b.last_check)])),
    '**Closed batches: the figures frozen when the batch was closed**',
    '',
    table(['Batch', 'Revenue (Rs)', 'Total cost (Rs)', 'Profit (Rs)', 'Birds sold', 'Kg sold', 'Mortality', 'FCR', 'Cost per kg (Rs)'],
      closed.map((c) => { const k = typeof c.kpis === 'string' ? JSON.parse(c.kpis) : c.kpis; return [`**${c.batch_code}**`, num(c.revenue), num(c.total_cost), num(c.profit), num(k.birdsSold), num(k.kgSold), `${k.mortalityPct}%`, k.fcr, num(k.costPerKg)]; })),
    '**Health tasks still to do**',
    '',
    table(['Batch', 'Task', 'Due', 'Uses'], tasks.map((t) => [t.batch_code, t.name, `${date(t.due_date)}${date(t.due_date) < TODAY ? ' (overdue)' : ''}`, t.ingredient_name ? `${num(t.planned_quantity)} × ${t.ingredient_name}` : ''])),
    '## 3. Stock',
    '',
    table(['Item', 'Unit', 'Main store', 'Feed mill store', 'Main Farm store', 'Expansion 1 store', 'Total', 'Reorder level'],
      stock.map((s) => [s.ingredient_name, s.unit, num(s.main), num(s.mill), num(s.main_farm), num(s.expansion), num(s.quantity),
        `${num(s.reorder_level)}${Number(s.quantity) <= Number(s.reorder_level) ? ' (**low**)' : ''}`])),
    '**Lots that are expired or expire within 30 days**',
    '',
    table(['Lot', 'Item', 'Store', 'Left', 'Expiry'], dated.map((l) => [l.lot_code, l.ingredient_name, l.store, `${num(l.remaining_quantity)} ${l.unit}`, `${date(l.expiry_date)}${date(l.expiry_date) < TODAY ? ' (**expired**)' : ''}`])),
    '**Purchase orders**',
    '',
    table(['Order', 'Supplier', 'Ordered on', 'Status', 'Total (Rs)', 'Received / ordered', 'Note on the order'],
      orders.map((o) => [`**${o.order_code}**`, o.supplier_name, date(o.order_date), words(o.status), num(o.total_cost), o.lines, o.notes])),
    '**Supplier invoices**',
    '',
    table(['Invoice', 'Supplier', 'Order', 'Dated', 'Due', 'Amount (Rs)', 'Status', 'Match', 'Paid (Rs)', 'Still owed (Rs)'],
      invoices.map((v) => [`**${v.invoice_reference}**`, v.supplier_name, v.order_code, date(v.invoice_date), date(v.due_date), num(v.invoice_amount), words(v.status), words(v.match_status), num(v.paid), num(Number(v.invoice_amount) - Number(v.paid))])),
    '**Stock requests**',
    '',
    table(['Request', 'From', 'For', 'Items', 'Status'], requests.map((r) => [r.requisition_code, r.full_name, r.centre, r.lines, words(r.status)])),
    '**Service work**',
    '',
    table(['Work order', 'What', 'Supplier', 'Amount (Rs)', 'Status'], workOrders.map((w) => [w.work_order_code, w.title, w.supplier_name, num(w.total_amount), words(w.status)])),
    '## 4. Feed mill',
    '',
    table(['Run', 'Recipe', 'Date', 'Status', 'Planned (kg)', 'Made (kg)', 'Sent to farms (kg)', 'Left at the mill (kg)'],
      runs.map((r) => [`**${r.production_code}**`, r.recipe_name, date(r.production_date), words(r.status), num(r.planned_quantity), r.actual_quantity ? num(r.actual_quantity) : '', num(r.sent),
        r.actual_quantity ? num(Number(r.actual_quantity) - Number(r.sent)) : ''])),
    '## 5. Sales',
    '',
    table(['Buyer', 'Credit terms', 'Credit limit (Rs)', 'Owes now (Rs)'], buyers.map((b) => [`**${b.buyer_name}**`, `${b.credit_terms} days`, b.credit_limit == null ? 'No limit' : num(b.credit_limit), num(b.owed)])),
    table(['Sale', 'Buyer', 'Batch / item', 'Date', 'Due', 'Status', 'Birds', 'Kg', 'Amount (Rs)', 'Received (Rs)', 'Cheques not yet cleared (Rs)', 'Outstanding (Rs)'],
      sales.map((s) => [`**${s.sale_code}**`, s.buyer_name, s.what, date(s.sale_date), date(s.due_date), words(s.status), num(s.total_birds), num(s.total_weight), num(s.total_amount), num(s.received), num(s.cheques), num(Number(s.total_amount) - Number(s.received))])),
    'A cheque is not money until it clears: it stays in Outstanding, and out of the bank balance, until it is marked cleared. A draft sale is not counted in what a buyer owes until it is marked reviewed.',
    '',
    '**Bookings**',
    '',
    table(['Booking', 'Buyer', 'Batch', 'Catch date', 'Birds', 'Expected kg each', 'Rs per kg', 'Status'],
      bookings.map((k) => [k.booking_code, k.buyer_name, k.batch_code, date(k.catch_date), num(k.expected_birds), k.expected_avg_weight_kg, num(k.price_per_kg), words(k.status)])),
    '**Cheques received from buyers**',
    '',
    table(['Cheque no.', 'Bank', 'Cheque date', 'Amount (Rs)', 'From', 'Status'], cheques.map((c) => [`**${c.cheque_number}**`, c.bank_name, date(c.cheque_date), num(c.payment_amount), c.buyer_name, words(c.payment_status)])),
    '## 6. People and payroll',
    '',
    table(['Employee', 'Job', 'Works at', 'Cost goes to', 'Type', 'EPF no.', 'Pay', 'Allowances', 'Bank details'],
      staff.map((e) => [`**${e.name}**`, e.designation, e.site_name, e.centre ?? e.site_name, e.employment_type, e.epf_eligible ? e.epf_number : 'Not a member',
        `Rs ${num(e.base_rate)} ${e.pay_type === 'monthly' ? 'a month' : `a ${e.pay_type === 'daily' ? 'day' : 'hour'}`}`, e.extras ?? '', e.has_bank ? 'Yes' : '**None**'])),
    table(['Month', 'Payroll status', 'People', 'Gross (Rs)', 'Net (Rs)'], payrolls.map((p) => [p.period, words(p.status), p.people, num(p.gross), num(p.net)])),
    `Attendance is recorded for every working day (Monday to Saturday) of ${M2.label} and ${M1.label}, and for this month up to yesterday.`,
    '',
    '**Days not worked** (everyone else was present on every working day; Ajith Kumara works Mondays, Wednesdays and Fridays)',
    '',
    table(['Date', 'Employee', 'Recorded as', 'Leave type'], absences.map((a) => [date(a.attendance_date), a.name, words(a.status), a.leave_type ?? ''])),
    `**What ${M1.label}'s payroll should come to** (it has not been run yet; the payroll plan has you run it). ${M1.label} has **${workingDays} working days**. Basic pay = basic ÷ working days × days attended; EPF 8% is taken on basic for days attended plus allowances that count for EPF; an advance or loan instalment is then taken back.`,
    '',
    table(['Employee', 'Days attended', 'Basic for days attended', 'Allowances', 'Gross', 'Employee EPF 8%', 'Advance / loan taken back', '**Net pay**', 'Employer EPF 12%', 'ETF 3%'],
      [...expectedPay.map((p) => [p.name, `${p.attended} of ${workingDays}`, num(p.basic), num(p.allowances), num(p.gross), num(p.epf), num(p.recovery), `**${num(p.net)}**`, num(p.employer), num(p.etf)]),
        ['**Total**', '', '', '', `**${num(sum('gross'))}**`, `**${num(sum('epf'))}**`, `**${num(sum('recovery'))}**`, `**${num(sum('net'))}**`, `**${num(sum('employer'))}**`, `**${num(sum('etf'))}**`]]),
    `EPF/ETF to pay over for ${M1.label}: ${num(sum('epf'))} + ${num(sum('employer'))} + ${num(sum('etf'))} = **Rs ${num(sum('epf') + sum('employer') + sum('etf'))}**. Labour cost to the business: gross + employer EPF + ETF = **Rs ${num(sum('gross') + sum('employer') + sum('etf'))}**.`,
    '',
    '**Advances and loans to staff**',
    '',
    table(['Code', 'Employee', 'Type', 'Amount (Rs)', 'Instalment (Rs)', 'Paid out', 'Taken back from', 'Taken back so far (Rs)', 'Still owed (Rs)'],
      loans.map((l) => [l.loan_code, l.name, l.loan_type, num(l.principal), l.installment_amount ? num(l.installment_amount) : 'All at once', date(l.issued_date), String(l.first_recovery_period).slice(0, 7), num(l.recovered), num(Number(l.principal) - Number(l.recovered))])),
    '## 7. Money',
    '',
    table(['Account', 'Type', 'Opening (Rs)', 'In (Rs)', 'Out (Rs)', 'Balance (Rs)'],
      [...accounts.map((a) => [`**${a.account_name}**`, words(a.account_type), num(a.opening_balance), num(a.money_in), num(a.money_out), `**${num(Number(a.opening_balance) + Number(a.money_in) - Number(a.money_out))}**`]),
        ['**Cash on hand (Home)**', '', '', '', '', `**${num(totalCash)}**`]]),
    `Opening balances are dated ${M3.start}.`,
    '',
    table(['Loan', 'Lender', 'Received', 'Amount (Rs)', 'Principal repaid (Rs)', 'Interest paid (Rs)', 'Still owed (Rs)'],
      bankLoans.map((l) => [l.loan_code, l.lender, date(l.received_date), num(l.principal), num(l.repaid), num(l.interest), num(Number(l.principal) - Number(l.repaid))])),
    '**Waiting for someone**',
    '',
    table(['What', 'Detail', 'Amount (Rs)'], [
      ...approvals.map((a) => ['Over the approval limit', `${a.summary}, raised by ${a.full_name}`, num(a.amount)]),
      ...pettyWaiting.map((p) => ['Petty cash spend to review', `${date(p.expense_date)} · ${p.justification}`, num(p.amount)]),
      ...expensesWaiting.filter((e) => !['settled', 'paid', 'rejected'].includes(e.status)).map((e) => ['Expense', `${e.expense_code} · ${e.counterparty_name} · ${words(e.status)}`, num(e.amount)]),
      ...invoices.filter((v) => v.status === 'recorded').map((v) => ['Supplier invoice to approve', `${v.invoice_reference} (${words(v.match_status)})`, num(v.invoice_amount)]),
      ...workOrders.filter((w) => !['approved', 'settled', 'rejected'].includes(w.status)).map((w) => ['Service work to review', w.title, num(w.total_amount)]),
      ...requests.filter((r) => r.status === 'pending' || r.status === 'submitted').map((r) => ['Stock request to review', `${r.requisition_code} from ${r.full_name}`, '']),
      ...sales.filter((s) => s.status === 'draft').map((s) => ['Draft sale to review', `${s.sale_code} · ${s.buyer_name}`, num(s.total_amount)]),
    ]),
    '### Every money movement so far',
    '',
    'For the "work the balance out by hand" checks. In and out are per account; a transfer between accounts appears once on each.',
    '',
    table(['Date', 'Transaction', 'Account', 'In (Rs)', 'Out (Rs)', 'Category', 'Cost centre', 'Batch', 'What'],
      ledger.map((e) => [date(e.transaction_date), e.transaction_code, e.account_name, e.entry_direction === 'inflow' ? num(e.amount) : '', e.entry_direction === 'outflow' ? num(e.amount) : '',
        e.category ?? '', e.centre ?? '', e.batch_code ?? '', `${[e.who, e.narrative].filter(Boolean).join(' · ')}${['posted', 'cleared'].includes(e.status) ? '' : ` (${words(e.status)}: not in the balance)`}`])),
  );

  fs.mkdirSync(path.dirname(params.file), { recursive: true });
  fs.writeFileSync(params.file, `${out.join('\n').replace(/\n{3,}/g, '\n\n')}\n`);
}
