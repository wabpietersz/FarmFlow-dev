import { z } from 'zod';

export const createPayrollSchema = z.object({
  employeeId: z.number().int().positive('Employee is required'),
  payPeriod: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  baseSalary: z.number().positive('Base salary must be positive'),
  workingDays: z.number().int().positive('Working days must be positive'),
  overtimeHours: z.number().min(0).default(0).optional(),
  overtimeRate: z.number().min(0).optional(),
  notes: z.string().max(1000).optional(),
});

export const generatePayrollSchema = z.object({
  payPeriod: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  workingDays: z.number().int().positive('Working days must be positive'),
});

export const updatePayrollSchema = z.object({
  notes: z.string().max(1000).nullable().optional(),
  overtimeHours: z.number().min(0).optional(),
  overtimeRate: z.number().min(0).optional(),
});

export const updatePayrollStatusSchema = z.object({
  status: z.enum(['reviewed', 'approved', 'paid']),
});

export const createDeductionSchema = z.object({
  deductionType: z.string().min(1, 'Deduction type is required').max(100),
  amount: z.number().positive('Amount must be positive'),
  remarks: z.string().max(500).optional(),
});

export const createAllowanceSchema = z.object({
  allowanceType: z.string().min(1, 'Allowance type is required').max(100),
  amount: z.number().positive('Amount must be positive'),
  remarks: z.string().max(500).optional(),
});
