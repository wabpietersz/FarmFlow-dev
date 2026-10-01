import { z } from 'zod';

const payPeriodSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)');

const allowanceInputSchema = z.object({
  allowanceType: z.string().min(1, 'Allowance type is required').max(100),
  amount: z.number().min(0, 'Allowance amount cannot be negative'),
  countsForEpf: z.boolean().optional(),
  remarks: z.string().max(500).optional(),
  included: z.boolean().optional(),
});

const deductionInputSchema = z.object({
  deductionType: z.string().min(1, 'Deduction type is required').max(100),
  amount: z.number().min(0, 'Deduction amount cannot be negative'),
  remarks: z.string().max(500).optional(),
  included: z.boolean().optional(),
});

const payrollEntrySchema = z.object({
  employeeId: z.number().int().positive('Employee is required'),
  baseSalary: z.number().min(0, 'Base salary cannot be negative'),
  workingDays: z.number().min(0, 'Working days cannot be negative'),
  attendedDays: z.number().min(0, 'Attended days cannot be negative').optional(),
  overtimeHours: z.number().min(0).default(0).optional(),
  overtimeRate: z.number().min(0).default(0).optional(),
  notes: z.string().max(1000).optional(),
  allowances: z.array(allowanceInputSchema).optional(),
  deductions: z.array(deductionInputSchema).optional(),
  compensationRevisionId: z.number().int().positive().nullable().optional(),
});

export const createPayrollSchema = z.object({
  employeeId: z.number().int().positive('Employee is required'),
  payPeriod: payPeriodSchema,
  baseSalary: z.number().min(0, 'Base salary cannot be negative'),
  workingDays: z.number().min(0, 'Working days cannot be negative'),
  attendedDays: z.number().min(0, 'Attended days cannot be negative').optional(),
  overtimeHours: z.number().min(0).default(0).optional(),
  overtimeRate: z.number().min(0).optional(),
  notes: z.string().max(1000).optional(),
  allowances: z.array(allowanceInputSchema).optional(),
  deductions: z.array(deductionInputSchema).optional(),
  compensationRevisionId: z.number().int().positive().nullable().optional(),
});

export const generatePayrollSchema = z.object({
  payPeriod: payPeriodSchema,
  workingDays: z.number().int().positive('Working days must be positive').optional(),
  entries: z.array(payrollEntrySchema).optional(),
}).refine((data) => {
  const hasEntries = Array.isArray(data.entries) && data.entries.length > 0;
  return hasEntries || typeof data.workingDays === 'number';
}, {
  message: 'Either workingDays or at least one payroll entry is required',
  path: ['workingDays'],
});

export const generatePayrollPrecheckSchema = z.object({
  payPeriod: payPeriodSchema,
});

export const payrollPreviewSchema = z.object({
  payPeriod: payPeriodSchema,
  employeeId: z.number().int().positive().optional(),
});

export const updatePayrollSchema = z.object({
  notes: z.string().max(1000).nullable().optional(),
  overtimeHours: z.number().min(0).optional(),
  overtimeRate: z.number().min(0).optional(),
});

export const updatePayrollStatusSchema = z.object({
  status: z.enum(['reviewed', 'approved', 'paid']),
  financeAccountId: z.number().int().positive().optional(),
  paymentMethod: z.enum(['cash', 'cheque', 'bank_transfer']).optional(),
  chequeLeafId: z.number().int().positive().optional(),
}).superRefine((data, ctx) => {
  if (data.status === 'paid' && !data.financeAccountId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Treasury account is required when marking payroll as paid',
      path: ['financeAccountId'],
    });
  }

  if (data.status === 'paid' && data.paymentMethod === 'cheque' && !data.chequeLeafId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Cheque leaf is required for cheque payroll disbursement',
      path: ['chequeLeafId'],
    });
  }
});

export const createDeductionSchema = z.object({
  deductionType: z.string().min(1, 'Deduction type is required').max(100),
  amount: z.number().positive('Amount must be positive'),
  remarks: z.string().max(500).optional(),
});

export const createAllowanceSchema = z.object({
  allowanceType: z.string().min(1, 'Allowance type is required').max(100),
  amount: z.number().positive('Amount must be positive'),
  countsForEpf: z.boolean().optional(),
  remarks: z.string().max(500).optional(),
});
