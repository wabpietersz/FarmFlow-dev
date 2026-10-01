export enum PaymentMethod {
  Cash = 'cash',
  Cheque = 'cheque',
  BankTransfer = 'bank_transfer',
}

export enum PaymentStatus {
  Pending = 'pending',
  Completed = 'completed',
  Bounced = 'bounced',
}

export enum SaleStatus {
  Draft = 'draft',
  Reviewed = 'reviewed',
  Pending = 'pending',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

export interface Buyer {
  id: number;
  buyerName: string;
  contactPerson?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  address?: string | null;
  creditTerms: number;
  /** Most the buyer may owe at once; null = no limit */
  creditLimit?: number | string | null;
  status: string;
  totalSales?: number;
  totalReceiptsCompleted?: number;
  totalAppliedToSales?: number;
  outstandingBalance?: number;
  advanceCredit?: number;
  netBalance?: number;
  createdAt: Date;
  updatedAt: Date;
}

export type SaleType = 'live_birds' | 'other_income';

export interface Sale {
  id: number;
  saleCode: string;
  /** live_birds, or other_income (manure, litter, scrap…) */
  saleType?: SaleType;
  batchId: number | null;
  siteId?: number | null;
  buyerId: number;
  bookingId?: number | null;
  saleDate: Date;
  dueDate?: string | null;
  itemDescription?: string | null;
  quantity?: number | string | null;
  unit?: string | null;
  unitPrice?: number | string | null;
  totalBirds: number;
  totalWeight: number;
  pricePerKg: number;
  totalAmount: number;
  status: SaleStatus;
  totalPaid?: number;
  outstandingBalance?: number;
  settlementStatus?: string;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Payment {
  id: number | string;
  saleId: number;
  paymentAmount: number;
  paymentDate: Date;
  paymentMethod: PaymentMethod;
  financeAccountId?: number | null;
  financeAccountName?: string | null;
  treasuryTransactionId?: number | null;
  treasuryReversalTransactionId?: number | null;
  chequeNumber?: string | null;
  chequeDate?: Date | null;
  bankName?: string | null;
  paymentStatus: PaymentStatus;
  notes?: string | null;
  recordedBy?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SaleLorry {
  id?: number;
  saleId?: number;
  lineSequence?: number;
  lorryNumber: string;
  birdsCount: number;
  previousWeight: number;
  loadedWeight: number;
  netWeight?: number;
  notes?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ReceiptPaymentLine {
  paymentAmount: number;
  paymentMethod: PaymentMethod;
  financeAccountId?: number;
  referenceNumber?: string;
  chequeNumber?: string;
  chequeDate?: string;
  bankName?: string;
  notes?: string;
}

export interface CreateSaleRequest {
  batchId: number;
  buyerId: number;
  saleDate: string;
  pricePerKg: number;
  totalBirds?: number;
  totalWeight?: number;
  lorries?: SaleLorry[];
  notes?: string;
}

export interface CreatePaymentRequest {
  saleId: number;
  paymentAmount?: number;
  paymentDate?: string;
  paymentMethod?: PaymentMethod;
  financeAccountId?: number;
  referenceNumber?: string;
  chequeNumber?: string;
  chequeDate?: string;
  bankName?: string;
  notes?: string;
  receiptDate?: string;
  receiptNotes?: string;
  lines?: ReceiptPaymentLine[];
}

export type SaleBookingStatus = 'booked' | 'converted' | 'cancelled';

export interface SaleBooking {
  id: number;
  bookingCode: string;
  buyerId: number;
  buyerName: string;
  batchId: number;
  batchCode: string;
  siteId: number;
  siteName: string | null;
  catchDate: string;
  expectedBirds: number;
  expectedAvgWeightKg: number | null;
  expectedWeightKg: number | null;
  expectedValue: number | null;
  pricePerKg: number;
  status: SaleBookingStatus;
  saleId: number | null;
  saleCode: string | null;
  notes: string | null;
}

export type AgeingBucket = 'current' | 'days1to30' | 'days31to60' | 'days61to90' | 'over90';

export interface ReceivablesAgeing {
  asOf: string;
  totals: Record<AgeingBucket, number>;
  totalOwed: number;
  overdue: number;
  buyers: Array<{
    buyerId: number;
    buyerName: string;
    phoneNumber: string | null;
    creditTerms: number;
    creditLimit: number | null;
    buckets: Record<AgeingBucket, number>;
    totalOwed: number;
    unappliedCredit: number;
    oldestDaysOverdue: number;
    sales: Array<{ saleId: number; saleCode: string; saleDate: string; dueDate: string; outstanding: number; daysOverdue: number; bucket: AgeingBucket }>;
  }>;
}

export interface BuyerStatement {
  buyer: { id: number; buyerName: string; contactPerson: string | null; phoneNumber: string | null; address: string | null; creditTerms: number; creditLimit: number | null };
  from: string;
  to: string;
  openingBalance: number;
  totalSales: number;
  totalReceived: number;
  closingBalance: number;
  entries: Array<{ id: string; entryType: 'sale' | 'receipt'; entryDate: string; referenceCode: string; description: string; debit: number; credit: number; runningBalance: number; status: string; paymentMethod?: string | null }>;
  ageing: Record<AgeingBucket, number>;
}
