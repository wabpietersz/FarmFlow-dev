import { z } from 'zod';

export const employeeFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  designation: z.string().min(1, 'Designation is required').max(100),
  siteId: z.coerce.number({ required_error: 'Site is required' }).int().positive('Site is required'),
  /** Blank = the site's cost centre. Set to Feed Mill / Admin for staff whose wages belong there. */
  costCentreId: z.string().optional(),
  employmentType: z.enum(['permanent', 'contract', 'seasonal'], {
    required_error: 'Employment type is required',
  }),
  joinDate: z.string().min(1, 'Join date is required'),
  phone: z.string().max(20).optional().or(z.literal('')),
});

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

export const emergencyContactFormSchema = z.object({
  contactName: z.string().min(1, 'Contact name is required').max(100),
  relationship: z.string().min(1, 'Relationship is required').max(50),
  phoneNumber: z.string().min(1, 'Phone number is required').max(20),
});

export type EmergencyContactFormValues = z.infer<typeof emergencyContactFormSchema>;

export const bankDetailsFormSchema = z.object({
  accountHolderName: z.string().min(1, 'Account holder name is required').max(100),
  bankName: z.string().min(1, 'Bank name is required').max(100),
  branchCode: z.string().max(20).optional().or(z.literal('')),
  accountNumber: z.string().min(1, 'Account number is required').max(50),
  ifscCode: z.string().max(20).optional().or(z.literal('')),
});

export type BankDetailsFormValues = z.infer<typeof bankDetailsFormSchema>;

export const compensationFormSchema = z.object({
  payType: z.enum(['monthly', 'daily', 'hourly']),
  baseRate: z.coerce.number().positive('Base rate must be positive'),
  overtimeRate: z.coerce.number().min(0, 'Overtime rate cannot be negative').default(0),
  effectiveFrom: z.string().min(1, 'Effective date is required'),
  notes: z.string().max(2000).optional().or(z.literal('')),
});

export type CompensationFormValues = z.infer<typeof compensationFormSchema>;

export const compensationComponentFormSchema = z.object({
  componentType: z.enum(['earning', 'deduction']),
  name: z.string().min(1, 'Component name is required').max(100),
  calculationType: z.enum(['fixed', 'percentage']),
  value: z.coerce.number().positive('Value must be positive'),
  isTaxable: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const compensationRevisionFormSchema = z.object({
  payType: z.enum(['monthly', 'daily', 'hourly']),
  baseRate: z.coerce.number().positive('Base rate must be positive'),
  overtimeRate: z.coerce.number().min(0, 'Overtime rate cannot be negative').default(0),
  effectiveFrom: z.string().min(1, 'Effective from date is required'),
  effectiveTo: z.string().optional().or(z.literal('')),
  standardHoursPerDay: z.coerce.number().min(1).max(24).default(8),
  notes: z.string().max(2000).optional().or(z.literal('')),
  isActive: z.boolean().default(true),
  components: z.array(compensationComponentFormSchema).default([]),
}).superRefine((values, ctx) => {
  if (values.effectiveTo && values.effectiveTo < values.effectiveFrom) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['effectiveTo'],
      message: 'Effective to date must be on or after effective from date',
    });
  }
});

export type CompensationComponentFormValues = z.infer<typeof compensationComponentFormSchema>;
export type CompensationRevisionFormValues = z.infer<typeof compensationRevisionFormSchema>;
