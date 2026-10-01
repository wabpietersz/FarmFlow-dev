/** The bits of a payroll preview row the live totals need. */
export type PreviewRowInput = {
  baseSalary: number | string;
  workingDays: number | string;
  attendedDays: number | string;
  overtimeHours: number | string;
  overtimeRate: number | string;
  allowances: Array<{ amount: number | string; included?: boolean; countsForEpf?: boolean }>;
  deductions: Array<{ amount: number | string; included?: boolean }>;
  /** From the server preview: 0 with some gross means "not an EPF member" */
  epfEmployeePreview?: number;
  grossSalaryPreview: number;
  loanRecoveryPreview?: number;
};

/** Live totals while editing; EPF and loan recovery follow the server's preview for this employee. */
export function calculateRowTotals(row: PreviewRowInput, epfRate = 8) {
  const workingDays = Number(row.workingDays);
  const attendedDays = Number(row.attendedDays);
  const baseSalary = Number(row.baseSalary);
  const overtimeHours = Number(row.overtimeHours);
  const overtimeRate = Number(row.overtimeRate);

  const allowanceTotal = row.allowances
    .filter((allowance) => allowance.included !== false)
    .reduce((sum, allowance) => sum + Number(allowance.amount), 0);
  const deductionTotal = row.deductions
    .filter((deduction) => deduction.included !== false)
    .reduce((sum, deduction) => sum + Number(deduction.amount), 0);

  const proRatedBase = workingDays > 0 ? (baseSalary / workingDays) * attendedDays : 0;
  const overtimePay = overtimeHours * overtimeRate;
  const gross = proRatedBase + overtimePay + allowanceTotal;

  const epfEligible = row.epfEmployeePreview === undefined || row.epfEmployeePreview > 0 || row.grossSalaryPreview === 0;
  const epfAllowances = row.allowances
    .filter((allowance) => allowance.included !== false && allowance.countsForEpf)
    .reduce((sum, allowance) => sum + Number(allowance.amount), 0);
  const epf = epfEligible ? Math.round((proRatedBase + epfAllowances) * epfRate) / 100 : 0;
  const loan = Math.min(row.loanRecoveryPreview ?? 0, Math.max(0, gross - epf - deductionTotal));
  const net = Math.max(0, gross - epf - deductionTotal - loan);

  return {
    allowanceTotal,
    deductionTotal: deductionTotal + epf + loan,
    epf,
    loan,
    gross,
    net,
  };
}
