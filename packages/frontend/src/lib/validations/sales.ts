import { z } from 'zod';

export const buyerFormSchema = z.object({
  buyerName: z.string().min(1, 'Buyer name is required').max(100),
  contactPerson: z.string().max(100).optional().or(z.literal('')),
  phoneNumber: z.string().max(20).optional().or(z.literal('')),
  email: z.string().email('Invalid email').max(100).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  creditTerms: z.coerce.number().int().min(0).default(0),
});

export type BuyerFormValues = z.infer<typeof buyerFormSchema>;

export const saleFormSchema = z.object({
  batchId: z.coerce.number({ required_error: 'Batch is required' }).int().positive('Batch is required'),
  buyerId: z.coerce.number({ required_error: 'Buyer is required' }).int().positive('Buyer is required'),
  saleDate: z.string().min(1, 'Sale date is required'),
  totalBirds: z.coerce.number().int().positive('Number of birds must be positive'),
  pricePerBird: z.coerce.number().positive('Price per bird must be positive'),
  notes: z.string().max(1000).optional().or(z.literal('')),
});

export type SaleFormValues = z.infer<typeof saleFormSchema>;

export const paymentFormSchema = z
  .object({
    paymentAmount: z.coerce.number().positive('Payment amount must be positive'),
    paymentDate: z.string().min(1, 'Payment date is required'),
    paymentMethod: z.enum(['cash', 'cheque', 'bank_transfer'], {
      required_error: 'Payment method is required',
    }),
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

export type PaymentFormValues = z.infer<typeof paymentFormSchema>;
