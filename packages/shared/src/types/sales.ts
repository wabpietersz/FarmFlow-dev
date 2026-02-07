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
  pricePerBird: number;
  totalAmount: number;
  status: SaleStatus;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Payment {
  id: number;
  saleId: number;
  paymentAmount: number;
  paymentDate: Date;
  paymentMethod: PaymentMethod;
  chequeNumber?: string | null;
  chequeDate?: Date | null;
  bankName?: string | null;
  paymentStatus: PaymentStatus;
  notes?: string | null;
  recordedBy?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSaleRequest {
  batchId: number;
  buyerId: number;
  saleDate: string;
  totalBirds: number;
  pricePerBird: number;
  notes?: string;
}

export interface CreatePaymentRequest {
  saleId: number;
  paymentAmount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  chequeNumber?: string;
  chequeDate?: string;
  bankName?: string;
  notes?: string;
}
