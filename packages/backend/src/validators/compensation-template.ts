import { z } from 'zod';

export const createCompensationTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.enum(['allowance', 'deduction']),
  defaultAmount: z.number().min(0).optional(),
  description: z.string().max(1000).optional(),
  isActive: z.boolean().optional(),
});

export const updateCompensationTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  category: z.enum(['allowance', 'deduction']).optional(),
  defaultAmount: z.number().min(0).nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const compensationTemplateQuerySchema = z.object({
  category: z.enum(['allowance', 'deduction']).optional(),
  active: z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      return value === 'true';
    }),
});
