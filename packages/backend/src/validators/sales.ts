import { z } from 'zod';

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
  totalBirds: z.number().int().positive('Number of birds must be positive'),
  pricePerBird: z.number().positive('Price per bird must be positive'),
  notes: z.string().max(1000).optional(),
});

export const updateSaleSchema = z.object({
  status: z.enum(['pending', 'completed', 'cancelled']).optional(),
  notes: z.string().max(1000).nullable().optional(),
});

// Payment validators
export const createPaymentSchema = z
  .object({
    paymentAmount: z.number().positive('Payment amount must be positive'),
    paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    paymentMethod: z.enum(['cash', 'cheque', 'bank_transfer']),
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

export const updatePaymentSchema = z.object({
  paymentStatus: z.enum(['pending', 'completed', 'bounced']).optional(),
  notes: z.string().max(1000).nullable().optional(),
});
