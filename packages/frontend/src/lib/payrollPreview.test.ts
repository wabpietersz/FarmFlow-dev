import { describe, expect, it } from 'vitest';
import { calculateRowTotals, type PreviewRowInput } from './payrollPreview';

const row = (overrides: Partial<PreviewRowInput> = {}): PreviewRowInput => ({
  baseSalary: 52000, workingDays: 26, attendedDays: 26, overtimeHours: 0, overtimeRate: 0,
  allowances: [], deductions: [], grossSalaryPreview: 52000, epfEmployeePreview: 4160, ...overrides,
});

describe('payroll preview totals', () => {
  it('takes 8% EPF on basic plus allowances that count for EPF', () => {
    const totals = calculateRowTotals(row({
      allowances: [{ amount: 5000, countsForEpf: true }, { amount: 3000 }],
      deductions: [{ amount: 1000 }],
    }));
    expect(totals.gross).toBe(60000);
    expect(totals.epf).toBe(4560); // 8% of 57,000
    expect(totals.net).toBe(60000 - 4560 - 1000);
  });

  it('pro-rates the basic for days not worked and adds overtime', () => {
    const totals = calculateRowTotals(row({ attendedDays: 13, overtimeHours: 4, overtimeRate: 500 }));
    expect(totals.gross).toBe(26000 + 2000);
    expect(totals.epf).toBe(2080); // overtime is not EPF earnings
  });

  it('skips EPF for non-members and ignores lines that are switched off', () => {
    const totals = calculateRowTotals(row({ epfEmployeePreview: 0, allowances: [{ amount: 9999, included: false }] }));
    expect(totals.epf).toBe(0);
    expect(totals.gross).toBe(52000);
  });

  it('never takes more advance back than the pay left after EPF', () => {
    const totals = calculateRowTotals(row({ baseSalary: 20000, grossSalaryPreview: 20000, loanRecoveryPreview: 25000 }));
    expect(totals.loan).toBe(20000 - 1600);
    expect(totals.net).toBe(0);
  });

  it('follows a changed EPF rate', () => {
    expect(calculateRowTotals(row(), 10).epf).toBe(5200);
  });
});
