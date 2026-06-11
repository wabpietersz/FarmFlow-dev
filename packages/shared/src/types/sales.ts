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

export interface Sale {
  id: number;
  saleCode: string;
  batchId: number;
  buyerId: number;
  saleDate: Date;
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
