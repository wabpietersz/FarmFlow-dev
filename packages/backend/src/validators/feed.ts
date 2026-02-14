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
  cost: z.number().nonnegative('Cost must be zero or positive'),
  targetProtein: z.number().min(0).max(100).nullable().optional(),
  targetEnergy: z.number().min(0).nullable().optional(),
  targetFiber: z.number().min(0).max(100).nullable().optional(),
  targetCalcium: z.number().min(0).max(100).nullable().optional(),
  ingredients: z
    .array(
      z.object({
        inventoryItemId: z.number().int().positive('Inventory item ID is required'),
        proportion: z.number().positive('Proportion must be positive'),
        unit: z.string().min(1, 'Unit is required').max(20),
      }),
    )
    .min(1, 'At least one ingredient is required'),
});

export const updateRecipeSchema = z.object({
  recipeName: z.string().min(1).max(100).optional(),
  feedType: z.enum(['starter', 'grower', 'finisher']).optional(),
  cost: z.number().nonnegative().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  targetProtein: z.number().min(0).max(100).nullable().optional(),
  targetEnergy: z.number().min(0).nullable().optional(),
  targetFiber: z.number().min(0).max(100).nullable().optional(),
  targetCalcium: z.number().min(0).max(100).nullable().optional(),
  ingredients: z
    .array(
      z.object({
        inventoryItemId: z.number().int().positive(),
        proportion: z.number().positive(),
        unit: z.string().min(1).max(20),
      }),
    )
    .optional(),
});

// Inventory validators
export const createInventorySchema = z.object({
  ingredientName: z.string().min(1, 'Ingredient name is required').max(100),
  supplierId: z.number().int().positive('Supplier is required'),
  quantity: z.number().nonnegative('Quantity cannot be negative'),
  unit: z.string().min(1, 'Unit is required').max(20),
  costPerUnit: z.number().nonnegative('Cost per unit cannot be negative'),
  reorderLevel: z.number().min(0).nullable().optional(),
});

export const updateInventorySchema = z.object({
  ingredientName: z.string().min(1).max(100).optional(),
  supplierId: z.number().int().positive().optional(),
  quantity: z.number().nonnegative().optional(),
  unit: z.string().min(1).max(20).optional(),
  costPerUnit: z.number().nonnegative().optional(),
  reorderLevel: z.number().min(0).nullable().optional(),
});

// Restock validator
export const restockSchema = z.object({
  quantity: z.number().positive('Restock quantity must be positive'),
});

// --- Feed Production validators ---

export const createProductionSchema = z.object({
  recipeId: z.number().int().positive('Recipe ID is required'),
  plannedQuantity: z.number().positive('Planned quantity must be positive'),
  unit: z.string().min(1).max(20).optional().default('kg'),
  productionDate: z.string().min(1, 'Production date is required'),
  scheduledDate: z.string().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const updateProductionStatusSchema = z.object({
  status: z.enum(['in_progress', 'completed', 'cancelled'], {
    errorMap: () => ({ message: 'Status must be in_progress, completed, or cancelled' }),
  }),
});

export const completeProductionSchema = z.object({
  actualQuantity: z.number().positive('Actual quantity must be positive'),
  wasteQuantity: z.number().min(0).nullable().optional(),
  wasteReason: z.string().max(500).nullable().optional(),
  materials: z
    .array(
      z.object({
        inventoryItemId: z.number().int().positive(),
        actualQuantity: z.number().positive('Material quantity must be positive'),
      }),
    )
    .min(1, 'At least one material is required'),
});

// QC checkpoint validator
export const qcCheckpointSchema = z.object({
  qcNotes: z.string().max(1000).nullable().optional(),
});

// --- Feed Distribution validators ---

export const createDistributionSchema = z.object({
  productionBatchId: z.number().int().positive().nullable().optional(),
  farmBatchId: z.number().int().positive('Farm batch ID is required'),
  feedType: z.enum(['starter', 'grower', 'finisher'], {
    errorMap: () => ({ message: 'Feed type must be starter, grower, or finisher' }),
  }),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().min(1).max(20).optional().default('kg'),
  distributionDate: z.string().min(1, 'Distribution date is required'),
  notes: z.string().max(1000).nullable().optional(),
});

// --- Inventory adjustment validator ---

export const inventoryAdjustmentSchema = z.object({
  quantity: z.number().refine((v) => v !== 0, { message: 'Adjustment quantity cannot be zero' }),
  reason: z.string().min(1, 'Reason is required').max(500),
  costPerUnit: z.number().positive('Cost per unit must be positive').optional(),
}).refine(
  (data) => data.quantity <= 0 || data.costPerUnit !== undefined,
  { message: 'Cost per unit is required for positive adjustments (adding stock)', path: ['costPerUnit'] },
);

// --- Purchase Order validators ---

export const createPurchaseOrderSchema = z.object({
  supplierId: z.number().int().positive('Supplier is required'),
  orderDate: z.string().min(1, 'Order date is required'),
  expectedDeliveryDate: z.string().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  items: z
    .array(
      z.object({
        inventoryItemId: z.number().int().positive('Inventory item is required'),
        orderedQuantity: z.number().positive('Quantity must be positive'),
        unitPrice: z.number().positive('Unit price must be positive'),
        unit: z.string().min(1).max(20),
        notes: z.string().max(500).nullable().optional(),
      }),
    )
    .min(1, 'At least one item is required'),
});

export const updatePurchaseOrderSchema = z.object({
  expectedDeliveryDate: z.string().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  items: z
    .array(
      z.object({
        inventoryItemId: z.number().int().positive(),
        orderedQuantity: z.number().positive(),
        unitPrice: z.number().positive(),
        unit: z.string().min(1).max(20),
        notes: z.string().max(500).nullable().optional(),
      }),
    )
    .optional(),
});

export const updatePurchaseOrderStatusSchema = z.object({
  status: z.enum(['submitted', 'cancelled'], {
    errorMap: () => ({ message: 'Status must be submitted or cancelled' }),
  }),
});

export const receivePurchaseOrderSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.number().int().positive('Item ID is required'),
        receivedQuantity: z.number().positive('Received quantity must be positive'),
      }),
    )
    .min(1, 'At least one item to receive is required'),
});

// --- Report schedule validators ---

export const createReportScheduleSchema = z.object({
  reportType: z.enum([
    'batch-performance', 'sales-summary', 'mortality-trends',
    'feed-consumption', 'financial-overview', 'batch-profitability',
    'hr-analytics', 'feed-analytics',
  ], { errorMap: () => ({ message: 'Invalid report type' }) }),
  scheduleName: z.string().min(1, 'Schedule name is required').max(100),
  cronExpression: z.string().min(1, 'Cron expression is required').max(50),
  filters: z.record(z.unknown()).optional().default({}),
  recipientEmails: z.array(z.string().email('Invalid email')).min(1, 'At least one recipient email is required'),
});

export const updateReportScheduleSchema = z.object({
  scheduleName: z.string().min(1).max(100).optional(),
  cronExpression: z.string().min(1).max(50).optional(),
  filters: z.record(z.unknown()).optional(),
  recipientEmails: z.array(z.string().email()).optional(),
  isActive: z.boolean().optional(),
});
