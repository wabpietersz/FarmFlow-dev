import { eq } from 'drizzle-orm';
import { db } from '../db';
import { employees, financeCategories, payroll, payrollAllowances, staffLoans, treasuryTransactionEntries } from '../db/schema';
import { computePay, DEFAULT_STATUTORY_RATES, recomputePayroll } from '../lib/payroll-calc';
import { issueStaffLoan, listStaffLoans, payPeriod, payrollRegister, remitStatutory, repayStaffLoan, statutoryReturn } from '../lib/staff-payroll';
import { getFinanceAccountBalance } from '../lib/treasury';
import { costCentreId, createAccount, createEmployee, createSiteWithBatch, createUser, entriesFor, resetDatabase } from './fixtures';

beforeEach(async () => {
  await resetDatabase();
});

async function draftPayroll(employeeId: number, period: string, baseSalary: number, allowances: Array<{ amount: number; countsForEpf: boolean }> = []) {
  const [run] = await db.insert(payroll).values({
    employeeId, payPeriod: period, baseSalary: baseSalary.toFixed(2), workingDays: 26, attendedDays: '26',
    grossSalary: '0', netSalary: '0', status: 'draft',
  }).returning();
  if (allowances.length) {
    await db.insert(payrollAllowances).values(allowances.map((a, i) => ({ payrollId: run.id, allowanceType: `A${i}`, amount: a.amount.toFixed(2), countsForEpf: a.countsForEpf })));
  }
  return (await recomputePayroll(run.id, db, { refreshLoans: true }))!.record;
}

describe('pay calculation', () => {
  it('works out EPF on basic plus EPF allowances, and never pays below zero', () => {
    const pay = computePay({
      baseSalary: 50000, workingDays: 26, attendedDays: 26, overtimeHours: 4, overtimeRate: 500,
      allowances: [{ amount: 5000, countsForEpf: true }, { amount: 3000, countsForEpf: false }],
      otherDeductions: 1000, loanInstallments: [], epfEligible: true, rates: DEFAULT_STATUTORY_RATES,
    });
    expect(pay).toEqual(expect.objectContaining({
      gross: 60000, epfBase: 55000, epfEmployee: 4400, epfEmployer: 6600, etfEmployer: 1650, totalDeductions: 5400, net: 54600,
    }));

    const capped = computePay({
      baseSalary: 20000, workingDays: 26, attendedDays: 26, overtimeHours: 0, overtimeRate: 0, allowances: [],
      otherDeductions: 0, loanInstallments: [15000, 10000], epfEligible: true, rates: DEFAULT_STATUTORY_RATES,
    });
    // 20,000 − 1,600 EPF = 18,400 available: first loan takes 15,000, second gets the 3,400 left
    expect(capped.loanRecoveries).toEqual([15000, 3400]);
    expect(capped.net).toBe(0);

    const casual = computePay({ baseSalary: 30000, workingDays: 26, attendedDays: 13, overtimeHours: 0, overtimeRate: 0, allowances: [], otherDeductions: 0, loanInstallments: [], epfEligible: false, rates: DEFAULT_STATUTORY_RATES });
    expect(casual).toEqual(expect.objectContaining({ gross: 15000, epfEmployee: 0, etfEmployer: 0, net: 15000 }));
  });
});

describe('advances, paying and EPF/ETF', () => {
  it('recovers an advance through payroll, pays the month, then pays EPF/ETF over', async () => {
    const user = await createUser();
    const account = await createAccount('bank', 1_000_000);
    const { site, centre } = await createSiteWithBatch();
    const mill = await costCentreId('MILL');
    const farmHand = await createEmployee(site.id, centre.id);
    const millHand = await createEmployee(site.id, mill);

    // Advance of 10,000 paid out in September, recovered from September pay
    const advance = await issueStaffLoan({
      employeeId: farmHand.id, loanType: 'advance', principal: 10000, issuedDate: '2026-09-10', firstRecoveryPeriod: '2026-09',
      financeAccountId: account.id, paymentMethod: 'cash', userId: user.id,
    });
    expect(await entriesFor(advance.treasuryTransactionId!)).toEqual([
      expect.objectContaining({ amount: '10000.00', direction: 'outflow', categoryCode: 'staff_advances', costCentreId: centre.id }),
    ]);

    const farmRun = await draftPayroll(farmHand.id, '2026-09-01', 50000, [{ amount: 5000, countsForEpf: true }]);
    const _millRun = await draftPayroll(millHand.id, '2026-09-01', 40000);
    expect(farmRun).toEqual(expect.objectContaining({ grossSalary: '55000.00', epfEmployee: '4400.00', loanRecovery: '10000.00', netSalary: '40600.00' }));
    expect((await listStaffLoans())[0]).toEqual(expect.objectContaining({ outstanding: 10000, leftAfterScheduled: 0 }));

    // EPF/ETF can't be paid before the payroll is
    await expect(remitStatutory({ payPeriod: '2026-09', financeAccountId: account.id, paidDate: '2026-10-10', userId: user.id })).rejects.toThrow(/Pay the 2 remaining/);

    await db.update(payroll).set({ status: 'approved' }).where(eq(payroll.payPeriod, '2026-09-01'));
    const before = await getFinanceAccountBalance(account.id);
    const paid = await payPeriod({ payPeriod: '2026-09', financeAccountId: account.id, paymentMethod: 'bank_transfer', payDate: '2026-09-30', userId: user.id });
    expect(paid).toEqual({ paid: 2, total: 40600 + 36800 });
    // Only net pay leaves the bank
    expect(before - (await getFinanceAccountBalance(account.id))).toBeCloseTo(77400, 2);

    const [farmPaid] = await db.select().from(payroll).where(eq(payroll.id, farmRun.id));
    expect(await entriesFor(farmPaid.treasuryTransactionId!)).toEqual([
      expect.objectContaining({ amount: '55000.00', direction: 'outflow', categoryCode: 'wages_salaries', costCentreId: centre.id }),
      expect.objectContaining({ amount: '4400.00', direction: 'inflow', categoryCode: 'epf_withheld', costCentreId: centre.id }),
      expect.objectContaining({ amount: '10000.00', direction: 'inflow', categoryCode: 'staff_advances', costCentreId: centre.id }),
    ]);
    const [settled] = await db.select().from(staffLoans).where(eq(staffLoans.id, advance.id));
    expect(settled.status).toBe('settled');

    const ret = await statutoryReturn('2026-09');
    expect(ret.totals).toEqual({ epfBase: 95000, epfEmployee: 7600, epfEmployer: 11400, epfTotal: 19000, etfEmployer: 2850 });

    const remittance = await remitStatutory({ payPeriod: '2026-09', financeAccountId: account.id, paidDate: '2026-10-10', epfReference: 'EPF-123', userId: user.id });
    const lines = await entriesFor(remittance.treasuryTransactionId!);
    // Employee EPF clears the withheld balance; employer EPF+ETF is labour cost per cost centre
    expect(lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ amount: '4400.00', categoryCode: 'epf_withheld', costCentreId: centre.id }),
      expect.objectContaining({ amount: '8250.00', categoryCode: 'epf_etf', costCentreId: centre.id }),
      expect.objectContaining({ amount: '3200.00', categoryCode: 'epf_withheld', costCentreId: mill }),
      expect.objectContaining({ amount: '6000.00', categoryCode: 'epf_etf', costCentreId: mill }),
    ]));
    await expect(remitStatutory({ payPeriod: '2026-09', financeAccountId: account.id, paidDate: '2026-10-11', userId: user.id })).rejects.toThrow(/already paid/);

    // Withheld EPF nets to zero across payroll + remittance
    const withheld = await db
      .select({ direction: treasuryTransactionEntries.entryDirection, amount: treasuryTransactionEntries.amount })
      .from(treasuryTransactionEntries)
      .innerJoin(financeCategories, eq(treasuryTransactionEntries.categoryId, financeCategories.id))
      .where(eq(financeCategories.code, 'epf_withheld'));
    expect(withheld.reduce((sum, e) => sum + (e.direction === 'inflow' ? 1 : -1) * Number(e.amount), 0)).toBeCloseTo(0, 2);

    const register = await payrollRegister('2026-09');
    expect(register.totals).toEqual(expect.objectContaining({ employees: 2, grossSalary: 95000, netSalary: 77400, employerCost: 95000 + 11400 + 2850 }));
    expect(register.rows.find((r) => r.employeeId === farmHand.id)?.loanRecoveries).toEqual([{ name: `Advance ${advance.loanCode}`, amount: 10000 }]);
  });

  it('takes a loan back in instalments, and accepts a direct repayment', async () => {
    const user = await createUser();
    const account = await createAccount();
    const { site, centre } = await createSiteWithBatch();
    const worker = await createEmployee(site.id, centre.id);
    await db.update(employees).set({ epfEligible: false }).where(eq(employees.id, worker.id));

    const loan = await issueStaffLoan({
      employeeId: worker.id, loanType: 'loan', principal: 30000, installmentAmount: 12000, issuedDate: '2026-08-05', firstRecoveryPeriod: '2026-09',
      financeAccountId: account.id, paymentMethod: 'bank_transfer', userId: user.id,
    });
    const aug = await draftPayroll(worker.id, '2026-08-01', 40000);
    expect(aug.loanRecovery).toBe('0.00'); // not due until September
    const sep = await draftPayroll(worker.id, '2026-09-01', 40000);
    expect(sep).toEqual(expect.objectContaining({ epfEmployee: '0.00', loanRecovery: '12000.00', netSalary: '28000.00' }));

    await expect(repayStaffLoan({ loanId: loan.id, amount: 20000, date: '2026-09-20', financeAccountId: account.id, userId: user.id })).rejects.toThrow(/18,000/);
    await repayStaffLoan({ loanId: loan.id, amount: 8000, date: '2026-09-20', financeAccountId: account.id, userId: user.id });
    const oct = await draftPayroll(worker.id, '2026-10-01', 40000);
    expect(oct.loanRecovery).toBe('10000.00'); // 30,000 − 12,000 − 8,000
  });
});
