import { z } from 'zod';

export const saleLorryFormSchema = z.object({
  lorryNumber: z.string().min(1, 'Lorry is required').max(100),
  birdsCount: z.coerce.number().int().positive('Bird count must be positive'),
  previousWeight: z.coerce.number().min(0, 'Previous weight must be zero or positive'),
  loadedWeight: z.coerce.number().positive('Loaded weight must be positive'),
  notes: z.string().max(1000).optional().or(z.literal('')),
});

export const buyerFormSchema = z.object({
  buyerName: z.string().min(1, 'Buyer name is required').max(100),
  contactPerson: z.string().max(100).optional().or(z.literal('')),
  phoneNumber: z.string().max(20).optional().or(z.literal('')),
  email: z.string().email('Invalid email').max(100).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  creditTerms: z.coerce.number().int().min(0).default(0),
  /** Blank = no limit */
  creditLimit: z.union([z.literal(''), z.coerce.number().nonnegative('Credit limit cannot be negative')]).optional(),
});

export type BuyerFormValues = z.infer<typeof buyerFormSchema>;

export const saleFormSchema = z.object({
  batchId: z.coerce.number({ required_error: 'Batch is required' }).int().positive('Batch is required'),
  buyerId: z.coerce.number({ required_error: 'Buyer is required' }).int().positive('Buyer is required'),
  saleDate: z.string().min(1, 'Sale date is required'),
  pricePerKg: z.coerce.number().positive('Price per kg must be positive'),
  lorries: z.array(saleLorryFormSchema).min(1, 'Add at least one lorry line'),
  notes: z.string().max(1000).optional().or(z.literal('')),
});

export type SaleFormValues = z.infer<typeof saleFormSchema>;

export const draftSaleDetailSchema = z.object({
  pricePerKg: z.coerce.number().positive('Price per kg must be positive'),
  lorries: z.array(saleLorryFormSchema).min(1, 'Add at least one lorry line'),
  notes: z.string().max(1000).optional().or(z.literal('')),
});

export type DraftSaleDetailValues = z.infer<typeof draftSaleDetailSchema>;

export const receiptPaymentLineFormSchema = z
  .object({
    paymentAmount: z.coerce.number().positive('Payment amount must be positive'),
    paymentMethod: z.enum(['cash', 'cheque', 'bank_transfer'], {
      required_error: 'Payment method is required',
    }),
    financeAccountId: z.coerce.number().int().positive('Treasury account is required'),
    referenceNumber: z.string().max(100).optional().or(z.literal('')),
    chequeNumber: z.string().max(50).optional().or(z.literal('')),
    chequeDate: z.string().optional().or(z.literal('')),
    bankName: z.string().max(100).optional().or(z.literal('')),
    notes: z.string().max(1000).optional().or(z.literal('')),
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

export const receiptFormSchema = z.object({
  receiptDate: z.string().min(1, 'Receipt date is required'),
  receiptNotes: z.string().max(1000).optional().or(z.literal('')),
  lines: z.array(receiptPaymentLineFormSchema).min(1, 'Add at least one payment line'),
});

export type ReceiptFormValues = z.infer<typeof receiptFormSchema>;
export type ReceiptPaymentLineFormValues = z.infer<typeof receiptPaymentLineFormSchema>;
