import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  bankDetails,
  costCentres,
  employees,
  payroll,
  payrollAllowances,
  payrollDeductions,
  sites,
  staffLoanRecoveries,
  staffLoans,
  statutoryRemittances,
} from '../db/schema';
import { assertPeriodOpen } from './period-locks';
import { createTreasuryTransactionRecord, ensureActiveFinanceAccount, postPayrollWithin, type TreasuryEntryInput } from './treasury';

/** Fully qualified: Drizzle drops the table name in single-table queries, which breaks correlated sub-queries. */
const LOAN_ID = sql.raw('"staff_loans"."id"');

/** A rule the person can fix (400, not a server error). */
export class PayrollRuleError extends Error {
  constructor(message: string, public code = 'PAYROLL_RULE') {
    super(message);
  }
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const employeeName = sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`;

export function normalizePeriod(value: string) {
  const match = /^(\d{4})-(\d{2})/.exec(value);
  if (!match) throw new PayrollRuleError('Pay period must be YYYY-MM', 'BAD_PERIOD');
  return `${match[1]}-${match[2]}-01`;
}

// ---------------------------------------------------------------------------
// Advances & loans
// ---------------------------------------------------------------------------

async function nextLoanCode(issuedDate: string, executor: typeof db | any) {
  const prefix = `ADV-${issuedDate.slice(0, 7).replace('-', '')}-`;
  const [row] = await executor
    .select({ count: sql<number>`count(*)::int` })
    .from(staffLoans)
    .where(sql`${staffLoans.loanCode} LIKE ${prefix + '%'}`);
  return `${prefix}${String((row?.count ?? 0) + 1).padStart(3, '0')}`;
}

export async function listStaffLoans(filters: { status?: string; employeeId?: number; siteId?: number | null } = {}) {
  const conditions = [];
  if (filters.status) conditions.push(eq(staffLoans.status, filters.status));
  if (filters.employeeId) conditions.push(eq(staffLoans.employeeId, filters.employeeId));
  if (filters.siteId) conditions.push(eq(employees.siteId, filters.siteId));

  const rows = await db
    .select({
      id: staffLoans.id,
      loanCode: staffLoans.loanCode,
      employeeId: staffLoans.employeeId,
      employeeName,
      siteName: sites.siteName,
      loanType: staffLoans.loanType,
      principal: staffLoans.principal,
      installmentAmount: staffLoans.installmentAmount,
      issuedDate: staffLoans.issuedDate,
      firstRecoveryPeriod: staffLoans.firstRecoveryPeriod,
      status: staffLoans.status,
      notes: staffLoans.notes,
      // Recovered = paid payrolls + direct repayments; scheduled = in payrolls not yet paid
      recovered: sql<number>`COALESCE((SELECT SUM(r.amount::numeric) FROM ${staffLoanRecoveries} r LEFT JOIN ${payroll} p ON p.id = r.payroll_id
        WHERE r.loan_id = ${LOAN_ID} AND (r.payroll_id IS NULL OR p.status = 'paid')), 0)::float`,
      scheduled: sql<number>`COALESCE((SELECT SUM(r.amount::numeric) FROM ${staffLoanRecoveries} r JOIN ${payroll} p ON p.id = r.payroll_id
        WHERE r.loan_id = ${LOAN_ID} AND p.status <> 'paid'), 0)::float`,
    })
    .from(staffLoans)
    .innerJoin(employees, eq(staffLoans.employeeId, employees.id))
    .leftJoin(sites, eq(employees.siteId, sites.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(staffLoans.issuedDate), desc(staffLoans.id));

  return rows.map((row) => {
    const principal = Number(row.principal);
    return {
      ...row,
      principal,
      installmentAmount: Number(row.installmentAmount),
      outstanding: round2(principal - row.recovered),
      leftAfterScheduled: round2(principal - row.recovered - row.scheduled),
    };
  });
}

export async function issueStaffLoan(input: {
  employeeId: number;
  loanType: 'advance' | 'loan';
  principal: number;
  installmentAmount?: number;
  issuedDate: string;
  firstRecoveryPeriod: string;
  financeAccountId: number;
  paymentMethod: 'cash' | 'bank_transfer';
  notes?: string | null;
  userId: number;
}) {
  const firstRecoveryPeriod = normalizePeriod(input.firstRecoveryPeriod);
  if (firstRecoveryPeriod < normalizePeriod(input.issuedDate)) {
    throw new PayrollRuleError('Recovery cannot start before the month it is paid out', 'BAD_PERIOD');
  }
  const installment = input.loanType === 'advance' ? input.principal : (input.installmentAmount ?? 0);
  if (installment <= 0) throw new PayrollRuleError('Monthly instalment is required for a loan', 'INSTALLMENT_REQUIRED');
  if (installment > input.principal) throw new PayrollRuleError('Instalment cannot be more than the amount lent', 'INSTALLMENT_TOO_HIGH');

  return db.transaction(async (tx) => {
    const [employee] = await tx
      .select({ id: employees.id, name: employeeName, status: employees.status, costCentreId: employees.costCentreId, siteId: employees.siteId })
      .from(employees)
      .where(eq(employees.id, input.employeeId))
      .limit(1);
    if (!employee) throw new PayrollRuleError('Employee not found', 'NOT_FOUND');
    if (employee.status !== 'active') throw new PayrollRuleError('Only active employees can be given an advance or loan', 'EMPLOYEE_INACTIVE');

    await assertPeriodOpen(input.issuedDate, 'financial');
    await ensureActiveFinanceAccount(input.financeAccountId, tx);
    const loanCode = await nextLoanCode(input.issuedDate, tx);

    const transaction = await createTreasuryTransactionRecord({
      transactionType: 'staff_advance',
      transactionDate: input.issuedDate,
      referenceNumber: loanCode,
      counterpartyType: 'employee',
      counterpartyId: employee.id,
      counterpartyNameSnapshot: employee.name,
      sourceModule: 'payroll',
      narrative: `${input.loanType === 'advance' ? 'Salary advance' : 'Staff loan'} to ${employee.name}`,
      createdBy: input.userId,
      entries: [{
        financeAccountId: input.financeAccountId,
        entryDirection: 'outflow',
        amount: input.principal,
        valueDate: input.issuedDate,
        notes: loanCode,
        tags: { categoryCode: 'staff_advances', costCentreId: employee.costCentreId, siteId: employee.siteId },
      }],
      executor: tx,
    });

    const [loan] = await tx
      .insert(staffLoans)
      .values({
        loanCode,
        employeeId: employee.id,
        loanType: input.loanType,
        principal: input.principal.toFixed(2),
        installmentAmount: installment.toFixed(2),
        issuedDate: input.issuedDate,
        firstRecoveryPeriod,
        financeAccountId: input.financeAccountId,
        paymentMethod: input.paymentMethod,
        treasuryTransactionId: transaction.id,
        notes: input.notes || null,
        createdBy: input.userId,
      })
      .returning();
    return loan;
  });
}

async function outstandingFor(loanId: number, executor: typeof db | any) {
  const [loan] = await executor.select().from(staffLoans).where(eq(staffLoans.id, loanId)).limit(1);
  if (!loan) throw new PayrollRuleError('Loan not found', 'NOT_FOUND');
  const [sum] = await executor
    .select({ total: sql<number>`COALESCE(SUM(${staffLoanRecoveries.amount}::numeric), 0)::float` })
    .from(staffLoanRecoveries)
    .where(eq(staffLoanRecoveries.loanId, loanId));
  return { loan, outstanding: round2(Number(loan.principal) - (sum?.total ?? 0)) };
}

/** Marks a loan settled once everything is recovered (counting payroll recoveries that are paid). */
export async function refreshLoanStatuses(loanIds: number[], executor: typeof db | any = db) {
  for (const loanId of new Set(loanIds)) {
    const [row] = await executor
      .select({
        principal: staffLoans.principal,
        status: staffLoans.status,
        recovered: sql<number>`COALESCE((SELECT SUM(r.amount::numeric) FROM ${staffLoanRecoveries} r LEFT JOIN ${payroll} p ON p.id = r.payroll_id
          WHERE r.loan_id = ${LOAN_ID} AND (r.payroll_id IS NULL OR p.status = 'paid')), 0)::float`,
      })
      .from(staffLoans)
      .where(eq(staffLoans.id, loanId))
      .limit(1);
    if (!row || row.status === 'written_off') continue;
    const next = round2(Number(row.principal) - row.recovered) <= 0 ? 'settled' : 'active';
    if (next !== row.status) {
      await executor.update(staffLoans).set({ status: next, updatedAt: new Date() }).where(eq(staffLoans.id, loanId));
    }
  }
}

/** Employee pays back in cash/bank instead of through payroll. */
export async function repayStaffLoan(input: { loanId: number; amount: number; date: string; financeAccountId: number; notes?: string | null; userId: number }) {
  return db.transaction(async (tx) => {
    const { loan, outstanding } = await outstandingFor(input.loanId, tx);
    if (loan.status !== 'active') throw new PayrollRuleError(`This ${loan.loanType} is ${loan.status}`, 'LOAN_NOT_ACTIVE');
    if (input.amount > outstanding + 0.001) {
      throw new PayrollRuleError(`Only Rs ${outstanding.toLocaleString('en-US')} is left to pay (including amounts already in unpaid payrolls)`, 'REPAYMENT_TOO_HIGH');
    }
    await assertPeriodOpen(input.date, 'financial');
    await ensureActiveFinanceAccount(input.financeAccountId, tx);
    const [employee] = await tx
      .select({ name: employeeName, costCentreId: employees.costCentreId, siteId: employees.siteId })
      .from(employees)
      .where(eq(employees.id, loan.employeeId))
      .limit(1);
    const transaction = await createTreasuryTransactionRecord({
      transactionType: 'staff_advance_repayment',
      transactionDate: input.date,
      referenceNumber: loan.loanCode,
      counterpartyType: 'employee',
      counterpartyId: loan.employeeId,
      counterpartyNameSnapshot: employee.name,
      sourceModule: 'payroll',
      narrative: `Repayment of ${loan.loanCode} by ${employee.name}`,
      createdBy: input.userId,
      entries: [{
        financeAccountId: input.financeAccountId,
        entryDirection: 'inflow',
        amount: input.amount,
        valueDate: input.date,
        notes: loan.loanCode,
        tags: { categoryCode: 'staff_advances', costCentreId: employee.costCentreId, siteId: employee.siteId },
      }],
      executor: tx,
    });
    const [recovery] = await tx
      .insert(staffLoanRecoveries)
      .values({ loanId: loan.id, amount: input.amount.toFixed(2), recoveryDate: input.date, treasuryTransactionId: transaction.id, notes: input.notes || 'Paid back directly' })
      .returning();
    await refreshLoanStatuses([loan.id], tx);
    return recovery;
  });
}

/** Stops recovering a loan (e.g. staff left). Unpaid draft payrolls drop the instalment on recalculation. */
export async function writeOffStaffLoan(loanId: number, reason: string) {
  const [loan] = await db.select().from(staffLoans).where(eq(staffLoans.id, loanId)).limit(1);
  if (!loan) throw new PayrollRuleError('Loan not found', 'NOT_FOUND');
  if (loan.status !== 'active') throw new PayrollRuleError(`This ${loan.loanType} is already ${loan.status}`, 'LOAN_NOT_ACTIVE');
  const [updated] = await db
    .update(staffLoans)
    .set({ status: 'written_off', notes: [loan.notes, `Written off: ${reason}`].filter(Boolean).join('\n'), updatedAt: new Date() })
    .where(eq(staffLoans.id, loanId))
    .returning();
  return updated;
}

// ---------------------------------------------------------------------------
// Paying a whole month
// ---------------------------------------------------------------------------

/** Pays every approved payroll in the period from one account, all or nothing. */
export async function payPeriod(input: { payPeriod: string; financeAccountId: number; paymentMethod: 'cash' | 'bank_transfer'; payDate?: string; siteId?: number | null; userId: number }) {
  const period = normalizePeriod(input.payPeriod);
  return db.transaction(async (tx) => {
    const conditions = [eq(payroll.payPeriod, period), eq(payroll.status, 'approved')];
    if (input.siteId) conditions.push(eq(employees.siteId, input.siteId));
    const rows = await tx
      .select({ id: payroll.id, net: payroll.netSalary })
      .from(payroll)
      .innerJoin(employees, eq(payroll.employeeId, employees.id))
      .where(and(...conditions));
    if (rows.length === 0) throw new PayrollRuleError('No approved payroll to pay for this month', 'NOTHING_TO_PAY');

    for (const row of rows) {
      await postPayrollWithin(tx, { payrollId: row.id, financeAccountId: input.financeAccountId, paymentMethod: input.paymentMethod, payDate: input.payDate, postedBy: input.userId });
    }
    const loanIds = await tx
      .select({ loanId: staffLoanRecoveries.loanId })
      .from(staffLoanRecoveries)
      .where(inArray(staffLoanRecoveries.payrollId, rows.map((row) => row.id)));
    await refreshLoanStatuses(loanIds.map((row: { loanId: number }) => row.loanId), tx);

    return { paid: rows.length, total: round2(rows.reduce((sum, row) => sum + Number(row.net), 0)) };
  });
}

// ---------------------------------------------------------------------------
// Register, bank list, payslips (one query feeds all three)
// ---------------------------------------------------------------------------

export async function payrollRegister(payPeriod: string, siteId?: number | null) {
  const period = normalizePeriod(payPeriod);
  const conditions = [eq(payroll.payPeriod, period)];
  if (siteId) conditions.push(eq(employees.siteId, siteId));

  const rows = await db
    .select({
      payrollId: payroll.id,
      status: payroll.status,
      employeeId: employees.id,
      employeeName,
      designation: employees.designation,
      epfNumber: employees.epfNumber,
      siteName: sites.siteName,
      costCentreName: costCentres.name,
      baseSalary: payroll.baseSalary,
      workingDays: payroll.workingDays,
      attendedDays: payroll.attendedDays,
      overtimeHours: payroll.overtimeHours,
      overtimeRate: payroll.overtimeRate,
      grossSalary: payroll.grossSalary,
      epfBase: payroll.epfBase,
      epfEmployee: payroll.epfEmployee,
      epfEmployer: payroll.epfEmployer,
      etfEmployer: payroll.etfEmployer,
      otherDeductions: payroll.otherDeductions,
      loanRecovery: payroll.loanRecovery,
      netSalary: payroll.netSalary,
      statutoryRates: payroll.statutoryRates,
      paidDate: payroll.paidDate,
      paymentMethod: payroll.paymentMethod,
      bankName: bankDetails.bankName,
      branchCode: bankDetails.branchCode,
      accountNumber: bankDetails.accountNumber,
      accountHolderName: bankDetails.accountHolderName,
    })
    .from(payroll)
    .innerJoin(employees, eq(payroll.employeeId, employees.id))
    .leftJoin(sites, eq(employees.siteId, sites.id))
    .leftJoin(costCentres, eq(employees.costCentreId, costCentres.id))
    .leftJoin(bankDetails, eq(bankDetails.employeeId, employees.id))
    .where(and(...conditions))
    .orderBy(asc(employees.firstName), asc(employees.lastName));

  const ids = rows.map((row) => row.payrollId);
  const [allowances, deductions, recoveries] = ids.length
    ? await Promise.all([
        db.select().from(payrollAllowances).where(inArray(payrollAllowances.payrollId, ids)),
        db.select().from(payrollDeductions).where(inArray(payrollDeductions.payrollId, ids)),
        db.select({ payrollId: staffLoanRecoveries.payrollId, amount: staffLoanRecoveries.amount, loanCode: staffLoans.loanCode, loanType: staffLoans.loanType })
          .from(staffLoanRecoveries)
          .innerJoin(staffLoans, eq(staffLoanRecoveries.loanId, staffLoans.id))
          .where(inArray(staffLoanRecoveries.payrollId, ids)),
      ])
    : [[], [], []];

  const n = (value: unknown) => Number(value ?? 0);
  const list = rows.map((row) => {
    const proRatedBase = row.workingDays > 0 ? (n(row.baseSalary) / row.workingDays) * n(row.attendedDays) : 0;
    return {
      ...row,
      baseSalary: n(row.baseSalary),
      attendedDays: n(row.attendedDays),
      overtimeHours: n(row.overtimeHours),
      overtimeRate: n(row.overtimeRate),
      basicEarned: round2(proRatedBase),
      overtimePay: round2(n(row.overtimeHours) * n(row.overtimeRate)),
      grossSalary: n(row.grossSalary),
      epfBase: n(row.epfBase),
      epfEmployee: n(row.epfEmployee),
      epfEmployer: n(row.epfEmployer),
      etfEmployer: n(row.etfEmployer),
      otherDeductions: n(row.otherDeductions),
      loanRecovery: n(row.loanRecovery),
      netSalary: n(row.netSalary),
      allowances: allowances.filter((a) => a.payrollId === row.payrollId).map((a) => ({ name: a.allowanceType, amount: n(a.amount), countsForEpf: a.countsForEpf })),
      deductions: deductions.filter((d) => d.payrollId === row.payrollId).map((d) => ({ name: d.deductionType, amount: n(d.amount) })),
      loanRecoveries: recoveries.filter((r) => r.payrollId === row.payrollId).map((r) => ({ name: `${r.loanType === 'advance' ? 'Advance' : 'Loan'} ${r.loanCode}`, amount: n(r.amount) })),
    };
  });

  const sum = (key: keyof (typeof list)[number]) => round2(list.reduce((total, row) => total + Number(row[key] ?? 0), 0));
  return {
    payPeriod: period,
    rows: list,
    totals: {
      employees: list.length,
      grossSalary: sum('grossSalary'),
      epfEmployee: sum('epfEmployee'),
      otherDeductions: sum('otherDeductions'),
      loanRecovery: sum('loanRecovery'),
      netSalary: sum('netSalary'),
      epfEmployer: sum('epfEmployer'),
      etfEmployer: sum('etfEmployer'),
      employerCost: round2(sum('grossSalary') + sum('epfEmployer') + sum('etfEmployer')),
    },
  };
}

// ---------------------------------------------------------------------------
// EPF / ETF monthly return
// ---------------------------------------------------------------------------

export async function statutoryReturn(payPeriod: string) {
  const period = normalizePeriod(payPeriod);
  const rows = await db
    .select({
      payrollId: payroll.id,
      status: payroll.status,
      employeeId: employees.id,
      employeeName,
      epfNumber: employees.epfNumber,
      costCentreId: employees.costCentreId,
      siteId: employees.siteId,
      epfBase: payroll.epfBase,
      epfEmployee: payroll.epfEmployee,
      epfEmployer: payroll.epfEmployer,
      etfEmployer: payroll.etfEmployer,
    })
    .from(payroll)
    .innerJoin(employees, eq(payroll.employeeId, employees.id))
    .where(and(eq(payroll.payPeriod, period), sql`${payroll.epfBase}::numeric > 0`))
    .orderBy(asc(employees.firstName));

  const [remittance] = await db.select().from(statutoryRemittances).where(eq(statutoryRemittances.payPeriod, period)).limit(1);
  const lines = rows.map((row) => ({
    ...row,
    epfBase: Number(row.epfBase),
    epfEmployee: Number(row.epfEmployee),
    epfEmployer: Number(row.epfEmployer),
    epfTotal: round2(Number(row.epfEmployee) + Number(row.epfEmployer)),
    etfEmployer: Number(row.etfEmployer),
  }));
  const total = (key: 'epfBase' | 'epfEmployee' | 'epfEmployer' | 'epfTotal' | 'etfEmployer', from = lines) => round2(from.reduce((sum, row) => sum + row[key], 0));
  const paidLines = lines.filter((line) => line.status === 'paid');
  return {
    payPeriod: period,
    lines,
    totals: { epfBase: total('epfBase'), epfEmployee: total('epfEmployee'), epfEmployer: total('epfEmployer'), epfTotal: total('epfTotal'), etfEmployer: total('etfEmployer') },
    /** Only paid payroll is paid over */
    payable: { employees: paidLines.length, epfEmployee: total('epfEmployee', paidLines), epfEmployer: total('epfEmployer', paidLines), etfEmployer: total('etfEmployer', paidLines) },
    unpaidPayrolls: lines.filter((line) => line.status !== 'paid').length,
    remittance: remittance ?? null,
  };
}

/**
 * Pays the month's EPF (employee 8% withheld + employer 12%) and ETF (employer 3%).
 * Employee EPF clears the "EPF withheld" category; the employer part is the EPF/ETF expense,
 * split by each employee's cost centre so farms, mill and admin carry their own labour cost.
 */
export async function remitStatutory(input: { payPeriod: string; financeAccountId: number; paidDate: string; epfReference?: string | null; etfReference?: string | null; userId: number }) {
  const ret = await statutoryReturn(input.payPeriod);
  if (ret.remittance) throw new PayrollRuleError(`EPF/ETF for this month was already paid on ${ret.remittance.paidDate}`, 'ALREADY_REMITTED');
  if (ret.unpaidPayrolls > 0) throw new PayrollRuleError(`Pay the ${ret.unpaidPayrolls} remaining payroll${ret.unpaidPayrolls === 1 ? '' : 's'} for this month first`, 'PAYROLL_NOT_PAID');
  if (ret.payable.employees === 0) throw new PayrollRuleError('No EPF/ETF to pay for this month', 'NOTHING_TO_PAY');

  return db.transaction(async (tx) => {
    await assertPeriodOpen(input.paidDate, 'financial');
    await ensureActiveFinanceAccount(input.financeAccountId, tx);

    type Group = { costCentreId: number | null; siteId: number; withheld: number; employer: number };
    const groups = new Map<string, Group>();
    for (const line of ret.lines) {
      const key = `${line.costCentreId ?? 'site'}-${line.siteId}`;
      const group = groups.get(key) ?? { costCentreId: line.costCentreId, siteId: line.siteId, withheld: 0, employer: 0 };
      group.withheld = round2(group.withheld + line.epfEmployee);
      group.employer = round2(group.employer + line.epfEmployer + line.etfEmployer);
      groups.set(key, group);
    }
    const entries: TreasuryEntryInput[] = [];
    for (const group of groups.values()) {
      const tags = { costCentreId: group.costCentreId, siteId: group.siteId };
      if (group.withheld > 0) entries.push({ financeAccountId: input.financeAccountId, entryDirection: 'outflow', amount: group.withheld, valueDate: input.paidDate, notes: 'Employee EPF paid over', tags: { categoryCode: 'epf_withheld', ...tags } });
      if (group.employer > 0) entries.push({ financeAccountId: input.financeAccountId, entryDirection: 'outflow', amount: group.employer, valueDate: input.paidDate, notes: 'Employer EPF + ETF', tags: { categoryCode: 'epf_etf', ...tags } });
    }

    const month = ret.payPeriod.slice(0, 7);
    const transaction = await createTreasuryTransactionRecord({
      transactionType: 'statutory_remittance',
      transactionDate: input.paidDate,
      referenceNumber: [input.epfReference, input.etfReference].filter(Boolean).join(' / ') || `EPF-ETF-${month}`,
      sourceModule: 'payroll',
      narrative: `EPF/ETF for ${month}`,
      createdBy: input.userId,
      entries,
      executor: tx,
    });

    const [remittance] = await tx
      .insert(statutoryRemittances)
      .values({
        payPeriod: ret.payPeriod,
        epfEmployee: ret.payable.epfEmployee.toFixed(2),
        epfEmployer: ret.payable.epfEmployer.toFixed(2),
        etfEmployer: ret.payable.etfEmployer.toFixed(2),
        employeeCount: ret.payable.employees,
        paidDate: input.paidDate,
        financeAccountId: input.financeAccountId,
        epfReference: input.epfReference || null,
        etfReference: input.etfReference || null,
        treasuryTransactionId: transaction.id,
        createdBy: input.userId,
      })
      .returning();
    return remittance;
  });
}
