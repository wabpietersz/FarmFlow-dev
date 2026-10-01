import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import type {
  FinanceAccount,
  PettyCashAllocation,
  PettyCashExpense,
  TreasuryManager,
  TreasuryTransaction,
} from '@farmflow/shared';

function buildQueryString(params: Record<string, unknown>) {
  return new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== '')
      .map(([key, value]) => [key, String(value)]),
  ).toString();
}

export interface TreasuryTransactionEntry {
  id: number;
  financeAccountId: number;
  accountCode?: string | null;
  accountName?: string | null;
  entryDirection: string;
  amount: string;
  valueDate: string;
  notes?: string | null;
  categoryId?: number | null;
  categoryName?: string | null;
  categoryType?: string | null;
  costCentreId?: number | null;
  costCentreName?: string | null;
  batchId?: number | null;
  batchCode?: string | null;
}

export interface TreasuryTransactionLink {
  id: number;
  treasuryTransactionId: number;
  sourceModule: string;
  sourceEntityType: string;
  sourceEntityId: number;
  sourceCodeSnapshot?: string | null;
  allocatedAmount?: string | null;
  createdAt: string;
}

export interface TreasuryTransactionDetailResponse {
  transaction: TreasuryTransaction;
  entries: TreasuryTransactionEntry[];
  links: TreasuryTransactionLink[];
}

export interface ChequeBook {
  id: number;
  financeAccountId: number;
  bookCode: string;
  startNumber: number;
  endNumber: number;
  issuedDate: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChequeLeaf {
  id: number;
  chequeBookId: number;
  financeAccountId: number;
  chequeNumber: string;
  status: string;
  issueDate?: string | null;
  clearDate?: string | null;
  amount?: number | string | null;
  payeeName?: string | null;
  treasuryTransactionId?: number | null;
  sourceModule?: string | null;
  sourceEntityType?: string | null;
  sourceEntityId?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PendingBuyerChequeReceipt {
  id: string;
  receiptId: number;
  receiptCode: string;
  buyerId: number;
  buyerName: string;
  receiptDate: string;
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

export interface BouncedBuyerChequeReceipt extends PendingBuyerChequeReceipt {}

export interface CreateFinanceAccountPayload {
  accountCode: string;
  accountName: string;
  accountType: 'bank' | 'current' | 'cash' | 'petty_cash';
  bankName?: string;
  branchName?: string;
  accountNumberMasked?: string;
  currencyCode?: string;
  allowsCheque?: boolean;
  openingBalance?: number;
  openingBalanceDate?: string;
  status?: 'active' | 'inactive';
}

export interface CreateManualTreasuryTransactionPayload {
  transactionDate: string;
  transactionType: 'manual_inflow' | 'manual_outflow' | 'internal_transfer';
  financeAccountId?: number;
  sourceFinanceAccountId?: number;
  destinationFinanceAccountId?: number;
  amount: number;
  referenceNumber?: string;
  counterpartyName?: string;
  narrative: string;
  sourceEntityType?: string;
  sourceEntityId?: number;
  sourceCodeSnapshot?: string;
  categoryId?: number;
  costCentreId?: number;
  batchId?: number;
}

export interface CreatePettyCashAllocationPayload {
  sourceFinanceAccountId: number;
  pettyCashAccountId: number;
  allocatedToUserId: number;
  amount: number;
  allocationDate: string;
  purpose: string;
}

export interface CreatePettyCashExpensePayload {
  expenseDate: string;
  categoryId: number;
  costCentreId?: number;
  amount: number;
  justification: string;
}

export interface ReviewPettyCashExpensePayload {
  status: 'approved' | 'rejected';
  reviewNotes?: string;
}

export interface PettyCashAllocationDetailResponse {
  allocation: PettyCashAllocation;
  expenses: PettyCashExpense[];
}

export interface ChequeBookSummary extends ChequeBook {
  accountName?: string | null;
  availableLeaves: number;
  issuedLeaves: number;
}

export interface ChequeLeafRow extends ChequeLeaf {
  accountName?: string | null;
  bookCode?: string | null;
}

export interface ChequeOverviewResponse {
  outgoingCheques: ChequeLeafRow[];
  pendingIncomingReceipts: PendingBuyerChequeReceipt[];
  bouncedIncomingReceipts: BouncedBuyerChequeReceipt[];
}

export interface CreateChequeBookPayload {
  financeAccountId: number;
  bookCode?: string;
  startNumber: number;
  endNumber: number;
  issuedDate: string;
}

export interface UpdateChequeLeafStatusPayload {
  status: 'cleared' | 'bounced' | 'voided';
  effectiveDate?: string;
  notes?: string;
}

export interface PeriodLock {
  id: number;
  lockCode: string;
  periodStart: string;
  periodEnd: string;
  scope: string;
  status: string;
  notes?: string | null;
  createdBy: number;
  releasedBy?: number | null;
  releasedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useTreasuryAccounts() {
  return useQuery({
    queryKey: ['treasury', 'accounts'],
    queryFn: () => apiGet<FinanceAccount[]>('/treasury/accounts'),
  });
}

export function useCreateTreasuryAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateFinanceAccountPayload) =>
      apiPost<FinanceAccount>('/treasury/accounts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury', 'accounts'] });
      queryClient.invalidateQueries({ queryKey: ['treasury', 'transactions'] });
    },
  });
}

export function useCreateManualTreasuryTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateManualTreasuryTransactionPayload) =>
      apiPost<TreasuryTransaction>('/treasury/transactions/manual', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury', 'accounts'] });
      queryClient.invalidateQueries({ queryKey: ['treasury', 'transactions'] });
    },
  });
}

export function useChequeBooks() {
  return useQuery({
    queryKey: ['treasury', 'cheque-books'],
    queryFn: () => apiGet<ChequeBookSummary[]>('/treasury/cheque-books'),
  });
}

export function useCreateChequeBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateChequeBookPayload) => apiPost<ChequeBookSummary>('/treasury/cheque-books', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury', 'cheque-books'] });
      queryClient.invalidateQueries({ queryKey: ['treasury', 'cheque-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['treasury', 'cheques', 'overview'] });
    },
  });
}

export function useChequeLeaves(params: { accountId?: number; status?: string } = {}) {
  const queryString = buildQueryString(params);
  return useQuery({
    queryKey: ['treasury', 'cheque-leaves', params],
    queryFn: () => apiGet<ChequeLeafRow[]>(`/treasury/cheque-leaves${queryString ? `?${queryString}` : ''}`),
  });
}

export function useChequeOverview() {
  return useQuery({
    queryKey: ['treasury', 'cheques', 'overview'],
    queryFn: () => apiGet<ChequeOverviewResponse>('/treasury/cheques/overview'),
  });
}

export function useUpdateChequeLeafStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chequeLeafId, data }: { chequeLeafId: number; data: UpdateChequeLeafStatusPayload }) =>
      apiPut<ChequeLeafRow>(`/treasury/cheque-leaves/${chequeLeafId}/status`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury', 'transactions'] });
      queryClient.invalidateQueries({ queryKey: ['treasury', 'cheque-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['treasury', 'cheques', 'overview'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-management'] });
      queryClient.invalidateQueries({ queryKey: ['payrolls'] });
    },
  });
}

export function usePeriodLocks() {
  return useQuery({
    queryKey: ['treasury', 'period-locks'],
    queryFn: () => apiGet<PeriodLock[]>('/treasury/period-locks'),
  });
}

export function useCreatePeriodLock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { periodStart: string; periodEnd: string; scope: 'financial' | 'inventory' | 'costing' | 'all'; notes?: string }) =>
      apiPost<PeriodLock>('/treasury/period-locks', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury', 'period-locks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'exceptions'] });
    },
  });
}

export function useReleasePeriodLock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: number; notes?: string }) =>
      apiPut<PeriodLock>(`/treasury/period-locks/${id}/release`, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury', 'period-locks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'exceptions'] });
    },
  });
}

export function useTreasuryTransactions(params: {
  accountId?: number;
  transactionType?: string;
  status?: string;
} = {}) {
  const queryString = buildQueryString(params);
  return useQuery({
    queryKey: ['treasury', 'transactions', params],
    queryFn: () =>
      apiGet<TreasuryTransaction[]>(`/treasury/transactions${queryString ? `?${queryString}` : ''}`),
  });
}

export function useTreasuryTransaction(id: number | undefined) {
  return useQuery({
    queryKey: ['treasury', 'transactions', id],
    queryFn: () => apiGet<TreasuryTransactionDetailResponse>(`/treasury/transactions/${id}`),
    enabled: !!id,
  });
}

export function useTreasuryManagers() {
  return useQuery({
    queryKey: ['treasury', 'managers'],
    queryFn: () => apiGet<TreasuryManager[]>('/treasury/managers'),
  });
}

export function usePettyCashAllocations() {
  return useQuery({
    queryKey: ['treasury', 'petty-cash', 'allocations'],
    queryFn: () => apiGet<PettyCashAllocation[]>('/treasury/petty-cash/allocations'),
  });
}

export function usePettyCashAllocation(id: number | undefined) {
  return useQuery({
    queryKey: ['treasury', 'petty-cash', 'allocations', id],
    queryFn: () => apiGet<PettyCashAllocationDetailResponse>(`/treasury/petty-cash/allocations/${id}`),
    enabled: !!id,
  });
}

export function useCreatePettyCashAllocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePettyCashAllocationPayload) =>
      apiPost<PettyCashAllocation>('/treasury/petty-cash/allocations', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury', 'accounts'] });
      queryClient.invalidateQueries({ queryKey: ['treasury', 'transactions'] });
      queryClient.invalidateQueries({ queryKey: ['treasury', 'petty-cash'] });
    },
  });
}

export function useCreatePettyCashExpense(allocationId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePettyCashExpensePayload) =>
      apiPost<PettyCashExpense>(`/treasury/petty-cash/allocations/${allocationId}/expenses`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury', 'accounts'] });
      queryClient.invalidateQueries({ queryKey: ['treasury', 'transactions'] });
      queryClient.invalidateQueries({ queryKey: ['treasury', 'petty-cash'] });
      queryClient.invalidateQueries({ queryKey: ['treasury', 'petty-cash', 'allocations', allocationId] });
    },
  });
}

export function useReviewPettyCashExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ expenseId, data }: { expenseId: number; data: ReviewPettyCashExpensePayload }) =>
      apiPut<PettyCashExpense>(`/treasury/petty-cash/expenses/${expenseId}/review`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury', 'accounts'] });
      queryClient.invalidateQueries({ queryKey: ['treasury', 'transactions'] });
      queryClient.invalidateQueries({ queryKey: ['treasury', 'petty-cash'] });
    },
  });
}
