export type FinanceAccountType = 'bank' | 'current' | 'cash' | 'petty_cash';
export type TreasuryTransactionType =
  | 'customer_receipt'
  | 'customer_receipt_reversal'
  | 'payroll_disbursement'
  | 'manual_inflow'
  | 'manual_outflow'
  | 'internal_transfer'
  | 'supplier_payment'
  | 'petty_cash_allocation'
  | 'petty_cash_expense'
  | 'operational_expense';

export type ChequeLeafStatus = 'available' | 'issued' | 'cleared' | 'bounced' | 'voided';

export interface FinanceAccount {
  id: number;
  accountCode: string;
  accountName: string;
  accountType: FinanceAccountType;
  bankName?: string | null;
  branchName?: string | null;
  accountNumberMasked?: string | null;
  currencyCode: string;
  allowsCheque: boolean;
  openingBalance: number;
  openingBalanceDate?: Date | string | null;
  status: 'active' | 'inactive';
  currentBalance?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TreasuryTransaction {
  id: number;
  transactionCode: string;
  transactionType: TreasuryTransactionType | string;
  transactionDate: Date | string;
  status: string;
  referenceNumber?: string | null;
  counterpartyType?: string | null;
  counterpartyId?: number | null;
  counterpartyNameSnapshot?: string | null;
  sourceModule?: string | null;
  sourceEntityType?: string | null;
  sourceEntityId?: number | null;
  sourceCodeSnapshot?: string | null;
  narrative?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SettlementLink {
  sourceModule: string;
  sourceEntityType: string;
  sourceEntityId: number;
  sourceCodeSnapshot?: string | null;
  allocatedAmount?: number | null;
}

export interface SettlementDetails {
  settlementStatus?: string;
  financeAccountId?: number | null;
  financeAccountName?: string | null;
  treasuryTransactionId?: number | null;
  treasuryReversalTransactionId?: number | null;
  paymentMethod?: string | null;
  referenceNumber?: string | null;
  linkedSources?: SettlementLink[];
}

export interface ChequeBook {
  id: number;
  financeAccountId: number;
  bookCode: string;
  startNumber: number;
  endNumber: number;
  issuedDate: Date | string;
  status: 'active' | 'inactive' | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ChequeLeaf {
  id: number;
  chequeBookId: number;
  financeAccountId: number;
  chequeNumber: string;
  status: ChequeLeafStatus | string;
  issueDate?: Date | string | null;
  clearDate?: Date | string | null;
  amount?: number | null;
  payeeName?: string | null;
  treasuryTransactionId?: number | null;
  sourceModule?: string | null;
  sourceEntityType?: string | null;
  sourceEntityId?: number | null;
  notes?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface TreasuryManager {
  id: number;
  fullName: string;
  email: string;
  siteId?: number | null;
  siteName?: string | null;
}

export interface PettyCashAllocation {
  id: number;
  allocationCode: string;
  sourceFinanceAccountId: number;
  pettyCashAccountId: number;
  allocatedToUserId: number;
  allocatedToName?: string | null;
  siteId?: number | null;
  siteName?: string | null;
  purpose: string;
  amount: number;
  allocationDate: Date | string;
  status: 'allocated' | 'submitted' | 'reviewed' | string;
  treasuryTransactionId: number;
  reviewedBy?: number | null;
  reviewedAt?: Date | string | null;
  reviewNotes?: string | null;
  createdBy: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  approvedExpenseAmount?: number;
  submittedExpenseAmount?: number;
}

export interface PettyCashExpense {
  id: number;
  allocationId: number;
  expenseDate: Date | string;
  expenseCategory: string;
  amount: number;
  justification: string;
  status: 'submitted' | 'approved' | 'rejected' | string;
  treasuryTransactionId?: number | null;
  reviewedBy?: number | null;
  reviewedAt?: Date | string | null;
  reviewNotes?: string | null;
  createdBy: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PendingBuyerChequeReceipt {
  id: string;
  receiptId: number;
  receiptCode: string;
  buyerId: number;
  buyerName: string;
  receiptDate: Date | string;
  paymentAmount: number;
  financeAccountId?: number | null;
  financeAccountName?: string | null;
  chequeNumber?: string | null;
  chequeDate?: string | null;
  bankName?: string | null;
  paymentStatus: string;
  treasuryTransactionId?: number | null;
  treasuryReversalTransactionId?: number | null;
}

export interface OperationalExpense extends SettlementDetails {
  id: number;
  expenseCode: string;
  expenseDate: Date | string;
  expenseCategory: string;
  counterpartyName?: string | null;
  allocationType: 'batch' | 'site' | 'shared_overhead' | string;
  siteId?: number | null;
  siteName?: string | null;
  batchId?: number | null;
  batchCode?: string | null;
  amount: number;
  status: 'pending_approval' | 'approved' | 'rejected' | 'paid' | string;
  approvalNotes?: string | null;
  approvedBy?: number | null;
  approvedAt?: Date | string | null;
  chequeLeafId?: number | null;
  chequeNumber?: string | null;
  chequeDate?: Date | string | null;
  bankName?: string | null;
  requestedBy: number;
  requestedByName?: string | null;
  notes?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface FinanceReconciliation {
  id: number;
  financeAccountId: number;
  financeAccountName?: string | null;
  periodStart: Date | string;
  periodEnd: Date | string;
  statementDate: Date | string;
  bookBalance: number;
  clearedBalance: number;
  statementBalance: number;
  varianceAmount: number;
  status: 'closed' | string;
  notes?: string | null;
  createdBy: number;
  createdByName?: string | null;
  closedBy?: number | null;
  closedAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  clearedEntryCount?: number;
}
