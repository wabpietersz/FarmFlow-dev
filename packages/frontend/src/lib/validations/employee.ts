import { z } from 'zod';

export const employeeFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  designation: z.string().min(1, 'Designation is required').max(100),
  siteId: z.coerce.number({ required_error: 'Site is required' }).int().positive('Site is required'),
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
