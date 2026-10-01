import { z } from 'zod';

export const createEmployeeSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  designation: z.string().min(1).max(100),
  siteId: z.number().int().positive(),
  costCentreId: z.number().int().positive().optional(),
  employmentType: z.enum(['permanent', 'contract', 'seasonal']),
  joinDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  phone: z.string().max(20).optional(),
  epfNumber: z.string().trim().max(30).optional(),
  epfEligible: z.boolean().optional(),
  emergencyContacts: z
    .array(
      z.object({
        contactName: z.string().min(1).max(100),
        relationship: z.string().min(1).max(50),
        phoneNumber: z.string().min(1).max(20),
      }),
    )
    .optional(),
  bankDetails: z
    .object({
      accountHolderName: z.string().min(1).max(100),
      bankName: z.string().min(1).max(100),
      branchCode: z.string().max(20).optional(),
      accountNumber: z.string().min(1).max(50),
      ifscCode: z.string().max(20).optional(),
    })
    .optional(),
});

export const updateEmployeeSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  designation: z.string().min(1).max(100).optional(),
  siteId: z.number().int().positive().optional(),
  /** null = follow the site's cost centre */
  costCentreId: z.number().int().positive().nullable().optional(),
  employmentType: z.enum(['permanent', 'contract', 'seasonal']).optional(),
  phone: z.string().max(20).nullable().optional(),
  epfNumber: z.string().trim().max(30).nullable().optional(),
  epfEligible: z.boolean().optional(),
  status: z.enum(['active', 'on_leave', 'terminated']).optional(),
});

export const emergencyContactSchema = z.object({
  contactName: z.string().min(1).max(100),
  relationship: z.string().min(1).max(50),
  phoneNumber: z.string().min(1).max(20),
});

export const bankDetailsSchema = z.object({
  accountHolderName: z.string().min(1).max(100),
  bankName: z.string().min(1).max(100),
  branchCode: z.string().max(20).optional(),
  accountNumber: z.string().min(1).max(50),
  ifscCode: z.string().max(20).optional(),
});

export const employeeQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  sortBy: z
    .enum(['firstName', 'lastName', 'designation', 'joinDate', 'status'])
    .default('firstName'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  search: z.string().optional(),
  siteId: z.coerce.number().int().positive().optional(),
  designation: z.string().optional(),
  status: z.enum(['active', 'on_leave', 'terminated']).optional(),
});

export const upsertCompensationSchema = z.object({
  payType: z.enum(['monthly', 'daily', 'hourly']),
  baseRate: z.number().positive('Base rate must be positive'),
  overtimeRate: z.number().min(0).default(0).optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  notes: z.string().max(2000).optional(),
});

export const compensationComponentSchema = z.object({
  componentType: z.enum(['earning', 'deduction']),
  name: z.string().min(1).max(100),
  calculationType: z.enum(['fixed', 'percentage']),
  value: z.number().positive('Component value must be positive'),
  isTaxable: z.boolean().optional(),
  countsForEpf: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const effectiveDateShape = {
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid effectiveFrom date format (YYYY-MM-DD)'),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid effectiveTo date format (YYYY-MM-DD)').nullable().optional(),
};

export const createCompensationRevisionSchema = z.object({
  payType: z.enum(['monthly', 'daily', 'hourly']),
  baseRate: z.number().positive('Base rate must be positive'),
  overtimeRate: z.number().min(0).default(0).optional(),
  ...effectiveDateShape,
  standardHoursPerDay: z.number().min(1).max(24).default(8).optional(),
  notes: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
  components: z.array(compensationComponentSchema).max(25).optional(),
}).refine((payload) => {
  if (!payload.effectiveTo) return true;
  return payload.effectiveTo >= payload.effectiveFrom;
}, {
  message: 'effectiveTo must be on or after effectiveFrom',
  path: ['effectiveTo'],
});

export const updateCompensationRevisionSchema = z.object({
  payType: z.enum(['monthly', 'daily', 'hourly']).optional(),
  baseRate: z.number().positive('Base rate must be positive').optional(),
  overtimeRate: z.number().min(0).optional(),
  effectiveFrom: effectiveDateShape.effectiveFrom.optional(),
  effectiveTo: effectiveDateShape.effectiveTo,
  standardHoursPerDay: z.number().min(1).max(24).optional(),
  notes: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
  components: z.array(compensationComponentSchema).max(25).optional(),
}).refine((payload) => {
  if (!payload.effectiveFrom || !payload.effectiveTo) return true;
  return payload.effectiveTo >= payload.effectiveFrom;
}, {
  message: 'effectiveTo must be on or after effectiveFrom',
  path: ['effectiveTo'],
});

export const compensationHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
