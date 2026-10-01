import { and, asc, eq, lte, sql } from 'drizzle-orm';
import { db } from '../db';
import { employees, payroll, payrollAllowances, payrollDeductions, staffLoanRecoveries, staffLoans, systemConfig } from '../db/schema';

/** Fully qualified: Drizzle drops the table name in single-table queries, which breaks correlated sub-queries. */
const LOAN_ID = sql.raw('"staff_loans"."id"');

type Executor = typeof db | any;

export type StatutoryRates = { epfEmployeeRate: number; epfEmployerRate: number; etfEmployerRate: number };
export const DEFAULT_STATUTORY_RATES: StatutoryRates = { epfEmployeeRate: 8, epfEmployerRate: 12, etfEmployerRate: 3 };
export const STATUTORY_CONFIG_KEY = 'payroll.statutory';

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** EPF/ETF rates from Settings (falls back to 8 / 12 / 3). */
export async function getStatutoryRates(executor: Executor = db): Promise<StatutoryRates> {
  const [row] = await executor.select().from(systemConfig).where(eq(systemConfig.configKey, STATUTORY_CONFIG_KEY)).limit(1);
  const value = (row?.configValue ?? {}) as Partial<StatutoryRates>;
  const pick = (key: keyof StatutoryRates) => {
    const n = Number(value[key]);
    return Number.isFinite(n) && n >= 0 && n <= 100 ? n : DEFAULT_STATUTORY_RATES[key];
  };
  return { epfEmployeeRate: pick('epfEmployeeRate'), epfEmployerRate: pick('epfEmployerRate'), etfEmployerRate: pick('etfEmployerRate') };
}

export async function setStatutoryRates(rates: StatutoryRates, userId: number) {
  await db
    .insert(systemConfig)
    .values({ configKey: STATUTORY_CONFIG_KEY, configValue: rates, description: 'EPF/ETF rates (%)', updatedBy: userId })
    .onConflictDoUpdate({ target: systemConfig.configKey, set: { configValue: rates, updatedBy: userId, updatedAt: new Date() } });
}

export type PayInput = {
  baseSalary: number;
  workingDays: number;
  attendedDays: number;
  overtimeHours: number;
  overtimeRate: number;
  allowances: Array<{ amount: number; countsForEpf?: boolean }>;
  /** Manual deductions only (not EPF, not loans) */
  otherDeductions: number;
  /** Loan/advance instalments due this month (before capping) */
  loanInstallments: number[];
  epfEligible: boolean;
  rates: StatutoryRates;
};

/**
 * One pay calculation for preview, generation and edits.
 * Order: gross → employee EPF → other deductions → loan recovery (capped so net pay is never negative).
 */
export function computePay(input: PayInput) {
  const proRatedBase = input.workingDays > 0 ? (input.baseSalary / input.workingDays) * input.attendedDays : 0;
  const overtimePay = input.overtimeHours * input.overtimeRate;
  const allowanceTotal = input.allowances.reduce((sum, a) => sum + Number(a.amount), 0);
  const epfAllowances = input.allowances.filter((a) => a.countsForEpf).reduce((sum, a) => sum + Number(a.amount), 0);
  const gross = round2(proRatedBase + overtimePay + allowanceTotal);

  const epfBase = input.epfEligible ? round2(proRatedBase + epfAllowances) : 0;
  const epfEmployee = round2((epfBase * input.rates.epfEmployeeRate) / 100);
  const epfEmployer = round2((epfBase * input.rates.epfEmployerRate) / 100);
  const etfEmployer = round2((epfBase * input.rates.etfEmployerRate) / 100);

  let available = Math.max(0, round2(gross - epfEmployee - input.otherDeductions));
  const loanRecoveries = input.loanInstallments.map((due) => {
    const take = round2(Math.min(due, available));
    available = round2(available - take);
    return take;
  });
  const loanRecovery = round2(loanRecoveries.reduce((sum, n) => sum + n, 0));
  const totalDeductions = round2(epfEmployee + input.otherDeductions + loanRecovery);

  return {
    proRatedBase: round2(proRatedBase),
    overtimePay: round2(overtimePay),
    allowanceTotal: round2(allowanceTotal),
    gross,
    epfBase,
    epfEmployee,
    epfEmployer,
    etfEmployer,
    otherDeductions: round2(input.otherDeductions),
    loanRecoveries,
    loanRecovery,
    totalDeductions,
    net: Math.max(0, round2(gross - totalDeductions)),
  };
}

/** Loans with something left to recover, due from this pay period. */
export async function loansDueForPeriod(employeeId: number, payPeriod: string, executor: Executor = db, excludePayrollId?: number): Promise<Array<{ loanId: number; outstanding: number; due: number }>> {
  const loans = await executor
    .select({
      id: staffLoans.id,
      principal: staffLoans.principal,
      installmentAmount: staffLoans.installmentAmount,
      recovered: sql<number>`COALESCE((
        SELECT SUM(${staffLoanRecoveries.amount}::numeric) FROM ${staffLoanRecoveries}
        WHERE ${staffLoanRecoveries.loanId} = ${LOAN_ID}
        ${excludePayrollId ? sql`AND (${staffLoanRecoveries.payrollId} IS NULL OR ${staffLoanRecoveries.payrollId} <> ${excludePayrollId})` : sql``}
      ), 0)::float`,
    })
    .from(staffLoans)
    .where(and(eq(staffLoans.employeeId, employeeId), eq(staffLoans.status, 'active'), lte(staffLoans.firstRecoveryPeriod, payPeriod)))
    .orderBy(asc(staffLoans.issuedDate), asc(staffLoans.id));
  return loans
    .map((loan: { id: number; principal: string; installmentAmount: string; recovered: number }) => {
      const outstanding = round2(Number(loan.principal) - loan.recovered);
      return { loanId: loan.id, outstanding, due: round2(Math.min(Number(loan.installmentAmount), outstanding)) };
    })
    .filter((loan: { due: number }) => loan.due > 0);
}

/**
 * Recomputes a payroll record from its lines and writes every total.
 * With `refreshLoans`, loan recoveries are (re)worked out from the employee's active loans — used on
 * draft payrolls; once reviewed, the recoveries stay as they are.
 */
export async function recomputePayroll(payrollId: number, executor: Executor = db, options: { refreshLoans?: boolean } = {}) {
  const [record] = await executor
    .select({ payroll, epfEligible: employees.epfEligible })
    .from(payroll)
    .innerJoin(employees, eq(payroll.employeeId, employees.id))
    .where(eq(payroll.id, payrollId))
    .limit(1);
  if (!record) return null;
  const row = record.payroll as typeof payroll.$inferSelect;

  const [allowances, deductions] = await Promise.all([
    executor.select().from(payrollAllowances).where(eq(payrollAllowances.payrollId, payrollId)),
    executor.select().from(payrollDeductions).where(eq(payrollDeductions.payrollId, payrollId)),
  ]);
  const rates = (row.statutoryRates as StatutoryRates | null) ?? await getStatutoryRates(executor);

  let installments: number[];
  let dueLoans: Array<{ loanId: number; due: number }> = [];
  if (options.refreshLoans) {
    dueLoans = await loansDueForPeriod(row.employeeId, String(row.payPeriod), executor, payrollId);
    installments = dueLoans.map((loan) => loan.due);
  } else {
    const existing = await executor.select({ amount: staffLoanRecoveries.amount }).from(staffLoanRecoveries).where(eq(staffLoanRecoveries.payrollId, payrollId));
    installments = existing.map((r: { amount: string }) => Number(r.amount));
  }

  const pay = computePay({
    baseSalary: Number(row.baseSalary),
    workingDays: row.workingDays,
    attendedDays: Number(row.attendedDays),
    overtimeHours: Number(row.overtimeHours ?? 0),
    overtimeRate: Number(row.overtimeRate ?? 0),
    allowances: allowances.map((a: typeof payrollAllowances.$inferSelect) => ({ amount: Number(a.amount), countsForEpf: a.countsForEpf })),
    otherDeductions: deductions.reduce((sum: number, d: typeof payrollDeductions.$inferSelect) => sum + Number(d.amount), 0),
    loanInstallments: installments,
    epfEligible: record.epfEligible,
    rates,
  });

  if (options.refreshLoans) {
    await executor.delete(staffLoanRecoveries).where(eq(staffLoanRecoveries.payrollId, payrollId));
    const rows = dueLoans
      .map((loan, i) => ({ loanId: loan.loanId, payrollId, amount: pay.loanRecoveries[i].toFixed(2), recoveryDate: String(row.payPeriod), notes: 'Recovered through payroll' }))
      .filter((r) => Number(r.amount) > 0);
    if (rows.length) await executor.insert(staffLoanRecoveries).values(rows);
  }

  const [updated] = await executor
    .update(payroll)
    .set({
      grossSalary: pay.gross.toFixed(2),
      epfBase: pay.epfBase.toFixed(2),
      epfEmployee: pay.epfEmployee.toFixed(2),
      epfEmployer: pay.epfEmployer.toFixed(2),
      etfEmployer: pay.etfEmployer.toFixed(2),
      otherDeductions: pay.otherDeductions.toFixed(2),
      loanRecovery: pay.loanRecovery.toFixed(2),
      statutoryRates: rates,
      netSalary: pay.net.toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(payroll.id, payrollId))
    .returning();
  return { record: updated, pay };
}
