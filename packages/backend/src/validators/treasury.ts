import { z } from 'zod';

export const createFinanceAccountSchema = z
  .object({
    accountCode: z.string().min(1, 'Account code is required').max(50),
    accountName: z.string().min(1, 'Account name is required').max(100),
    accountType: z.enum(['bank', 'current', 'cash', 'petty_cash']),
    bankName: z.string().max(100).optional().or(z.literal('')),
    branchName: z.string().max(100).optional().or(z.literal('')),
    accountNumberMasked: z.string().max(50).optional().or(z.literal('')),
    currencyCode: z.string().max(10).optional().default('LKR'),
    allowsCheque: z.boolean().optional().default(false),
    openingBalance: z.number().min(0).optional().default(0),
    openingBalanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
    status: z.enum(['active', 'inactive']).optional().default('active'),
  })
  .superRefine((data, ctx) => {
    if (data.allowsCheque && data.accountType !== 'current') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Cheque issuance is only allowed for current accounts',
        path: ['allowsCheque'],
      });
    }
  });

export const createManualTreasuryTransactionSchema = z
  .object({
    transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    transactionType: z.enum(['manual_inflow', 'manual_outflow', 'internal_transfer']),
    financeAccountId: z.number().int().positive().optional(),
    sourceFinanceAccountId: z.number().int().positive().optional(),
    destinationFinanceAccountId: z.number().int().positive().optional(),
    amount: z.number().positive('Amount must be positive'),
    referenceNumber: z.string().max(100).optional().or(z.literal('')),
    counterpartyName: z.string().max(200).optional().or(z.literal('')),
    narrative: z.string().min(1, 'Narrative is required').max(1000),
    sourceEntityType: z.string().max(50).optional().or(z.literal('')),
    sourceEntityId: z.number().int().positive().optional(),
    sourceCodeSnapshot: z.string().max(100).optional().or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    if (data.transactionType === 'manual_inflow' || data.transactionType === 'manual_outflow') {
      if (!data.financeAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Account is required',
          path: ['financeAccountId'],
        });
      }
    }

    if (data.transactionType === 'internal_transfer') {
      if (!data.sourceFinanceAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Source account is required',
          path: ['sourceFinanceAccountId'],
        });
      }
      if (!data.destinationFinanceAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Destination account is required',
          path: ['destinationFinanceAccountId'],
        });
      }
      if (
        data.sourceFinanceAccountId
        && data.destinationFinanceAccountId
        && data.sourceFinanceAccountId === data.destinationFinanceAccountId
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Transfer accounts must be different',
          path: ['destinationFinanceAccountId'],
        });
      }
    }
  });

export const createOperationalExpenseSchema = z.object({
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  expenseCategory: z.string().min(1, 'Expense category is required').max(100),
  counterpartyName: z.string().max(200).optional().or(z.literal('')),
  allocationType: z.enum(['batch', 'site', 'shared_overhead']).default('shared_overhead'),
  siteId: z.number().int().positive().optional(),
  batchId: z.number().int().positive().optional(),
  amount: z.number().positive('Amount must be positive'),
  notes: z.string().max(1000).optional().or(z.literal('')),
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

export const reviewOperationalExpenseSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  approvalNotes: z.string().max(1000).optional().or(z.literal('')),
});

export const settleOperationalExpenseSchema = z.object({
  financeAccountId: z.number().int().positive('Treasury account is required'),
  paymentMethod: z.enum(['cash', 'cheque', 'bank_transfer']),
  referenceNumber: z.string().max(100).optional().or(z.literal('')),
  chequeLeafId: z.number().int().positive().optional(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
});

export const createFinanceReconciliationSchema = z.object({
  financeAccountId: z.number().int().positive('Finance account is required'),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  statementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  statementBalance: z.number(),
  clearedEntryIds: z.array(z.number().int().positive()).default([]),
  notes: z.string().max(1000).optional().or(z.literal('')),
}).superRefine((data, ctx) => {
  if (data.periodEnd < data.periodStart) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Period end must be on or after period start',
      path: ['periodEnd'],
    });
  }
});

export const createPettyCashAllocationSchema = z.object({
  sourceFinanceAccountId: z.number().int().positive('Source account is required'),
  pettyCashAccountId: z.number().int().positive('Petty cash account is required'),
  allocatedToUserId: z.number().int().positive('Manager is required'),
  amount: z.number().positive('Amount must be positive'),
  allocationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  purpose: z.string().min(1, 'Purpose is required').max(1000),
});

export const createPettyCashExpenseSchema = z.object({
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  expenseCategory: z.string().min(1, 'Expense category is required').max(100),
  amount: z.number().positive('Amount must be positive'),
  justification: z.string().min(1, 'Justification is required').max(1000),
});

export const reviewPettyCashExpenseSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reviewNotes: z.string().max(1000).optional().or(z.literal('')),
});

export const createChequeBookSchema = z.object({
  financeAccountId: z.number().int().positive('Current account is required'),
  bookCode: z.string().max(50).optional().or(z.literal('')),
  startNumber: z.number().int().positive('Start number is required'),
  endNumber: z.number().int().positive('End number is required'),
  issuedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
}).superRefine((data, ctx) => {
  if (data.endNumber < data.startNumber) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'End number must be greater than or equal to start number',
      path: ['endNumber'],
    });
  }
});

export const updateChequeLeafStatusSchema = z.object({
  status: z.enum(['cleared', 'bounced', 'voided']),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
  notes: z.string().max(1000).optional().or(z.literal('')),
});

export const createPeriodLockSchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  scope: z.enum(['financial', 'inventory', 'costing', 'all']).default('all'),
  notes: z.string().max(1000).optional().or(z.literal('')),
}).superRefine((data, ctx) => {
  if (data.periodEnd < data.periodStart) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Period end must be on or after period start',
      path: ['periodEnd'],
    });
  }
});

export const releasePeriodLockSchema = z.object({
  notes: z.string().max(1000).optional().or(z.literal('')),
});
