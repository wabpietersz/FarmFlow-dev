import { z } from 'zod';

export const payrollFormSchema = z.object({
  employeeId: z.coerce.number().int().positive('Employee is required'),
  payPeriod: z.string().min(1, 'Pay period is required'),
  baseSalary: z.coerce.number().positive('Base salary must be positive'),
  workingDays: z.coerce.number().int().positive('Working days must be positive'),
  overtimeHours: z.coerce.number().min(0).default(0),
  overtimeRate: z.coerce.number().min(0).default(0),
  notes: z.string().max(1000).optional(),
});

export type PayrollFormValues = z.infer<typeof payrollFormSchema>;

export const generatePayrollFormSchema = z.object({
  payPeriod: z.string().min(1, 'Pay period is required'),
  workingDays: z.coerce.number().int().positive('Working days must be positive'),
});

export type GeneratePayrollFormValues = z.infer<typeof generatePayrollFormSchema>;

export const deductionFormSchema = z.object({
  deductionType: z.string().min(1, 'Deduction type is required').max(100),
  amount: z.coerce.number().positive('Amount must be positive'),
  remarks: z.string().max(500).optional(),
});

export type DeductionFormValues = z.infer<typeof deductionFormSchema>;

export const allowanceFormSchema = z.object({
  allowanceType: z.string().min(1, 'Allowance type is required').max(100),
  amount: z.coerce.number().positive('Amount must be positive'),
  remarks: z.string().max(500).optional(),
});

export type AllowanceFormValues = z.infer<typeof allowanceFormSchema>;
