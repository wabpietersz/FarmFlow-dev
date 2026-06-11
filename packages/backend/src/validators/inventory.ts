import { z } from 'zod';

export const createInventoryItemTypeSchema = z.object({
  typeCode: z.string().min(1, 'Type code is required').max(50),
  typeName: z.string().min(1, 'Type name is required').max(100),
  category: z.string().min(1, 'Category is required').max(50),
  defaultUnit: z.string().min(1, 'Default unit is required').max(20),
  allowsBatchAllocation: z.boolean().optional().default(false),
  isFeed: z.boolean().optional().default(false),
  status: z.enum(['active', 'inactive']).optional().default('active'),
  description: z.string().max(500).nullable().optional(),
});

export const updateInventoryItemTypeSchema = createInventoryItemTypeSchema.partial();

export const createInventoryItemSchema = z.object({
  itemTypeId: z.number().int().positive('Inventory type is required'),
  itemCode: z.string().max(50).nullable().optional(),
  ingredientName: z.string().min(1, 'Item name is required').max(100),
  description: z.string().max(500).nullable().optional(),
  supplierId: z.number().int().positive('Supplier is required'),
  quantity: z.number().nonnegative('Quantity cannot be negative'),
  unit: z.string().min(1, 'Unit is required').max(20),
  costPerUnit: z.number().nonnegative('Cost per unit cannot be negative'),
  reorderLevel: z.number().min(0).nullable().optional(),
});

export const updateInventoryItemSchema = createInventoryItemSchema.partial();

export const consumeInventoryToBatchSchema = z.object({
  batchId: z.number().int().positive('Batch is required'),
  quantity: z.number().positive('Quantity must be positive'),
  consumptionDate: z.string().min(1, 'Consumption date is required'),
  notes: z.string().max(500).nullable().optional(),
});

export const consumeInventoryToSiteSchema = z.object({
  siteId: z.number().int().positive('Site is required'),
  quantity: z.number().positive('Quantity must be positive'),
  consumptionDate: z.string().min(1, 'Consumption date is required'),
  notes: z.string().max(500).nullable().optional(),
});

export const createInventoryPurchaseOrderSchema = z.object({
  supplierId: z.number().int().positive('Supplier is required'),
  contractId: z.number().int().positive().nullable().optional(),
  orderDate: z.string().min(1, 'Order date is required'),
  expectedDeliveryDate: z.string().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  items: z.array(
    z.object({
      inventoryItemId: z.number().int().positive('Inventory item is required'),
      orderedQuantity: z.number().positive('Quantity must be positive'),
      unitPrice: z.number().positive('Unit price must be positive'),
      unit: z.string().min(1).max(20),
      notes: z.string().max(500).nullable().optional(),
    }),
  ).min(1, 'At least one item is required'),
});

export const updateInventoryPurchaseOrderSchema = z.object({
  contractId: z.number().int().positive().nullable().optional(),
  expectedDeliveryDate: z.string().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  items: z.array(
    z.object({
      inventoryItemId: z.number().int().positive(),
      orderedQuantity: z.number().positive(),
      unitPrice: z.number().positive(),
      unit: z.string().min(1).max(20),
      notes: z.string().max(500).nullable().optional(),
    }),
  ).optional(),
});

export const updateInventoryPurchaseOrderStatusSchema = z.object({
  status: z.enum(['submitted', 'cancelled'], {
    errorMap: () => ({ message: 'Status must be submitted or cancelled' }),
  }),
});

export const receiveInventoryPurchaseOrderSchema = z.object({
  items: z.array(
    z.object({
      itemId: z.number().int().positive('Item ID is required'),
      receivedQuantity: z.number().positive('Received quantity must be positive'),
      batchAllocations: z.array(
        z.object({
          batchId: z.number().int().positive('Batch is required'),
          quantity: z.number().positive('Allocation quantity must be positive'),
          notes: z.string().max(500).nullable().optional(),
        }),
      ).optional().default([]),
    }),
  ).min(1, 'At least one item to receive is required'),
});

export const createSupplierPaymentSchema = z.object({
  purchaseOrderId: z.number().int().positive().nullable().optional(),
  supplierInvoiceId: z.number().int().positive().nullable().optional(),
  supplierInvoiceAllocations: z.array(
    z.object({
      supplierInvoiceId: z.number().int().positive('Supplier invoice is required'),
      allocatedAmount: z.number().positive('Allocated amount must be positive'),
    }),
  ).optional(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  financeAccountId: z.number().int().positive('Finance account is required'),
  paymentMethod: z.enum(['cash', 'cheque', 'bank_transfer']),
  amount: z.number().positive('Amount must be positive'),
  referenceNumber: z.string().max(100).nullable().optional(),
  chequeLeafId: z.number().int().positive().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.paymentMethod === 'cheque' && !data.chequeLeafId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Cheque leaf is required for cheque payments',
      path: ['chequeLeafId'],
    });
  }
  if (data.supplierInvoiceId && data.supplierInvoiceAllocations?.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Use either supplierInvoiceId or supplierInvoiceAllocations, not both',
      path: ['supplierInvoiceAllocations'],
    });
  }
});

export const updateSupplierPaymentStatusSchema = z.object({
  status: z.enum(['completed', 'bounced', 'voided']),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const createSupplierContractSchema = z.object({
  supplierId: z.number().int().positive('Supplier is required'),
  contractType: z.enum(['supplier', 'service', 'customer']).optional().default('supplier'),
  contractTitle: z.string().min(1, 'Contract title is required').max(200),
  description: z.string().max(2000).nullable().optional(),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  validTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').nullable().optional(),
  currencyCode: z.string().min(3).max(10).optional().default('LKR'),
  paymentTermsDays: z.number().int().min(0).optional().default(0),
  commercialTerms: z.string().max(5000).nullable().optional(),
  rateTable: z.record(z.unknown()).optional().default({}),
  attachmentUrls: z.array(z.string().max(500)).optional().default([]),
  alertDaysBeforeExpiry: z.number().int().min(0).optional().default(30),
  status: z.enum(['draft', 'active', 'expired', 'suspended']).optional().default('draft'),
  terms: z.array(
    z.object({
      termType: z.string().min(1).max(50),
      termKey: z.string().min(1).max(100),
      termValue: z.string().min(1).max(5000),
      sortOrder: z.number().int().min(0).optional().default(0),
    }),
  ).optional().default([]),
});

export const reviewSupplierContractSchema = z.object({
  status: z.enum(['active', 'rejected', 'suspended']),
  approvalNotes: z.string().max(1000).optional().or(z.literal('')),
});

export const createSupplierInvoiceSchema = z.object({
  supplierId: z.number().int().positive('Supplier is required'),
  purchaseOrderId: z.number().int().positive().nullable().optional(),
  contractId: z.number().int().positive().nullable().optional(),
  invoiceReference: z.string().min(1, 'Invoice reference is required').max(100),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  invoiceAmount: z.number().positive('Invoice amount must be positive'),
  currencyCode: z.string().min(3).max(10).optional().default('LKR'),
  status: z.enum(['recorded', 'cancelled']).optional().default('recorded'),
  notes: z.string().max(2000).nullable().optional(),
});

export const reviewSupplierInvoiceSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  approvalNotes: z.string().max(1000).optional().or(z.literal('')),
});

export const createServiceWorkOrderSchema = z.object({
  serviceType: z.enum(['utility', 'fuel', 'maintenance', 'service']),
  title: z.string().min(1, 'Title is required').max(200),
  supplierId: z.number().int().positive('Supplier is required'),
  contractId: z.number().int().positive().nullable().optional(),
  allocationType: z.enum(['batch', 'site', 'shared_overhead']).default('shared_overhead'),
  siteId: z.number().int().positive().nullable().optional(),
  batchId: z.number().int().positive().nullable().optional(),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  invoiceReference: z.string().max(100).nullable().optional(),
  quantity: z.number().positive().nullable().optional(),
  unit: z.string().max(20).nullable().optional(),
  unitRate: z.number().nonnegative().nullable().optional(),
  totalAmount: z.number().positive('Total amount must be positive'),
  notes: z.string().max(1000).nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.allocationType === 'batch' && !data.batchId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Batch is required for batch allocation',
      path: ['batchId'],
    });
  }
  if (data.allocationType === 'site' && !data.siteId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Site is required for site allocation',
      path: ['siteId'],
    });
  }
});

export const reviewServiceWorkOrderSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  approvalNotes: z.string().max(1000).optional().or(z.literal('')),
});

export const settleServiceWorkOrderSchema = z.object({
  financeAccountId: z.number().int().positive('Finance account is required'),
  paymentMethod: z.enum(['cash', 'cheque', 'bank_transfer']),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
  referenceNumber: z.string().max(100).optional().or(z.literal('')),
  chequeLeafId: z.number().int().positive().nullable().optional(),
});
