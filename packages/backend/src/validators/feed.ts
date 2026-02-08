import { z } from 'zod';

// Supplier validators
export const createSupplierSchema = z.object({
  supplierName: z.string().min(1, 'Supplier name is required').max(100),
  contactPerson: z.string().max(100).nullable().optional(),
  phoneNumber: z.string().max(20).nullable().optional(),
  email: z.string().email('Invalid email').max(100).nullable().optional().or(z.literal('')),
  address: z.string().max(500).nullable().optional(),
});

export const updateSupplierSchema = z.object({
  supplierName: z.string().min(1).max(100).optional(),
  contactPerson: z.string().max(100).nullable().optional(),
  phoneNumber: z.string().max(20).nullable().optional(),
  email: z.string().email().max(100).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

// Recipe validators
export const createRecipeSchema = z.object({
  recipeName: z.string().min(1, 'Recipe name is required').max(100),
  feedType: z.enum(['starter', 'grower', 'finisher'], {
    errorMap: () => ({ message: 'Feed type must be starter, grower, or finisher' }),
  }),
  cost: z.number().positive('Cost must be positive'),
  ingredients: z
    .array(
      z.object({
        ingredientName: z.string().min(1, 'Ingredient name is required').max(100),
        supplierId: z.number().int().positive().nullable().optional(),
        proportion: z.number().positive('Proportion must be positive'),
        unit: z.string().min(1, 'Unit is required').max(20),
      }),
    )
    .min(1, 'At least one ingredient is required'),
});

export const updateRecipeSchema = z.object({
  recipeName: z.string().min(1).max(100).optional(),
  feedType: z.enum(['starter', 'grower', 'finisher']).optional(),
  cost: z.number().positive().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  ingredients: z
    .array(
      z.object({
        ingredientName: z.string().min(1).max(100),
        supplierId: z.number().int().positive().nullable().optional(),
        proportion: z.number().positive(),
        unit: z.string().min(1).max(20),
      }),
    )
    .optional(),
});

// Inventory validators
export const createInventorySchema = z.object({
  ingredientName: z.string().min(1, 'Ingredient name is required').max(100),
  supplierId: z.number().int().positive().nullable().optional(),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().min(1, 'Unit is required').max(20),
  costPerUnit: z.number().positive('Cost per unit must be positive'),
  reorderLevel: z.number().min(0).nullable().optional(),
});

export const updateInventorySchema = z.object({
  ingredientName: z.string().min(1).max(100).optional(),
  supplierId: z.number().int().positive().nullable().optional(),
  quantity: z.number().positive().optional(),
  unit: z.string().min(1).max(20).optional(),
  costPerUnit: z.number().positive().optional(),
  reorderLevel: z.number().min(0).nullable().optional(),
});

// Restock validator
export const restockSchema = z.object({
  quantity: z.number().positive('Restock quantity must be positive'),
});
