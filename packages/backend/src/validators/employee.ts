import { z } from 'zod';

export const createEmployeeSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  designation: z.string().min(1).max(100),
  siteId: z.number().int().positive(),
  employmentType: z.enum(['permanent', 'contract', 'seasonal']),
  joinDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  phone: z.string().max(20).optional(),
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
  employmentType: z.enum(['permanent', 'contract', 'seasonal']).optional(),
  phone: z.string().max(20).nullable().optional(),
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
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(['firstName', 'lastName', 'designation', 'joinDate', 'status'])
    .default('firstName'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  search: z.string().optional(),
  siteId: z.coerce.number().int().positive().optional(),
  designation: z.string().optional(),
  status: z.enum(['active', 'on_leave', 'terminated']).optional(),
});
