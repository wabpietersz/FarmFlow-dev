import { z } from 'zod';

const saleLorrySchema = z.object({
  lorryNumber: z.string().min(1, 'Lorry is required').max(100),
  birdsCount: z.number().int().positive('Number of birds must be positive'),
  previousWeight: z.number().nonnegative('Previous weight must be zero or positive'),
  loadedWeight: z.number().positive('Loaded weight must be positive'),
  notes: z.string().max(1000).optional(),
});

// Buyer validators
export const createBuyerSchema = z.object({
  buyerName: z.string().min(1, 'Buyer name is required').max(100),
  contactPerson: z.string().max(100).nullable().optional(),
  phoneNumber: z.string().max(20).nullable().optional(),
  email: z.string().email('Invalid email').max(100).nullable().optional().or(z.literal('')),
  address: z.string().max(500).nullable().optional(),
  creditTerms: z.number().int().min(0).default(0),
});

export const updateBuyerSchema = z.object({
  buyerName: z.string().min(1).max(100).optional(),
  contactPerson: z.string().max(100).nullable().optional(),
  phoneNumber: z.string().max(20).nullable().optional(),
  email: z.string().email().max(100).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  creditTerms: z.number().int().min(0).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

// Sale validators
export const createSaleSchema = z.object({
  batchId: z.number().int().positive('Batch is required'),
  buyerId: z.number().int().positive('Buyer is required'),
  saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  totalBirds: z.number().int().positive('Number of birds must be positive').optional(),
  totalWeight: z.number().positive('Total weight must be positive').optional(),
  pricePerKg: z.number().positive('Price per kg must be positive'),
  lorries: z.array(saleLorrySchema).min(1, 'At least one lorry line is required').optional(),
  notes: z.string().max(1000).optional(),
}).superRefine((data, ctx) => {
  if (!data.lorries?.length && (!data.totalBirds || !data.totalWeight)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide lorry lines or total birds and weight',
      path: ['lorries'],
    });
  }
});

export const updateSaleSchema = z.object({
  status: z.enum(['draft', 'reviewed', 'pending', 'completed', 'cancelled']).optional(),
  pricePerKg: z.number().positive('Price per kg must be positive').optional(),
  lorries: z.array(saleLorrySchema).min(1, 'At least one lorry line is required').optional(),
  notes: z.string().max(1000).nullable().optional(),
});

// Payment validators
const paymentLineSchema = z
  .object({
    paymentAmount: z.number().positive('Payment amount must be positive'),
    paymentMethod: z.enum(['cash', 'cheque', 'bank_transfer']),
    financeAccountId: z.number().int().positive('Treasury account is required').optional(),
    referenceNumber: z.string().max(100).optional(),
    chequeNumber: z.string().max(50).optional(),
    chequeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    bankName: z.string().max(100).optional(),
    notes: z.string().max(1000).optional(),
  })
  .refine(
    (data) => {
      if (data.paymentMethod === 'cheque') {
        return !!data.chequeNumber && !!data.chequeDate;
      }
      return true;
    },
    { message: 'Cheque number and date are required for cheque payments', path: ['chequeNumber'] },
  );

export const createPaymentSchema = z.object({
  paymentAmount: z.number().positive('Payment amount must be positive').optional(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
  paymentMethod: z.enum(['cash', 'cheque', 'bank_transfer']).optional(),
  financeAccountId: z.number().int().positive('Treasury account is required').optional(),
  referenceNumber: z.string().max(100).optional(),
  chequeNumber: z.string().max(50).optional(),
  chequeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  bankName: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
  receiptDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
  receiptNotes: z.string().max(1000).optional(),
  lines: z.array(paymentLineSchema).min(1, 'At least one payment line is required').optional(),
}).superRefine((data, ctx) => {
  if (data.lines?.length) {
    if (!data.receiptDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Receipt date is required',
        path: ['receiptDate'],
      });
    }
    data.lines.forEach((line, index) => {
      if (!line.financeAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Treasury account is required',
          path: ['lines', index, 'financeAccountId'],
        });
      }
    });
    return;
  }

  if (!data.paymentAmount || !data.paymentDate || !data.paymentMethod) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Payment amount, date, and method are required',
      path: ['paymentAmount'],
    });
    return;
  }

  if (data.paymentMethod === 'cheque' && (!data.chequeNumber || !data.chequeDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Cheque number and date are required for cheque payments',
      path: ['chequeNumber'],
    });
  }

  if (!data.financeAccountId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Treasury account is required',
      path: ['financeAccountId'],
    });
  }
});

export const updatePaymentSchema = z.object({
  paymentStatus: z.enum(['pending', 'completed', 'bounced']).optional(),
  financeAccountId: z.number().int().positive().optional(),
  notes: z.string().max(1000).nullable().optional(),
});
