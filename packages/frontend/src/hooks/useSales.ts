import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import type { Buyer, Sale } from '@farmflow/shared';

// --- Response interfaces ---

interface BuyerListResponse {
  data: BuyerListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface BuyerListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

export interface BuyerBalanceSummary {
  totalSales: number;
  totalReceiptsCompleted: number;
  totalAppliedToSales: number;
  outstandingBalance: number;
  advanceCredit: number;
  netBalance: number;
}

export type BuyerListItem = Omit<
  Buyer,
  'totalSales' | 'totalReceiptsCompleted' | 'totalAppliedToSales' | 'outstandingBalance' | 'advanceCredit' | 'netBalance'
> &
  BuyerBalanceSummary;

export interface ReceiptSummary {
  id: string;
  receiptId: number;
  receiptCode: string;
  receiptDate: string;
  paymentAmount: number;
  paymentMethod: string;
  financeAccountId?: number | null;
  financeAccountName?: string | null;
  treasuryTransactionId?: number | null;
  treasuryReversalTransactionId?: number | null;
  referenceNumber?: string | null;
  chequeNumber?: string | null;
  chequeDate?: string | null;
  bankName?: string | null;
  paymentStatus: string;
  notes?: string | null;
  appliedAmount: number;
  unappliedAmount: number;
}

export interface BuyerLedgerEntry {
  id: string;
  entryType: 'sale' | 'receipt';
  entryDate: string;
  referenceCode: string;
  description: string;
  amount: number;
  debit: number;
  credit: number;
  runningBalance: number;
  status: string;
  paymentMethod?: string | null;
}

interface BuyerDetail {
  buyer: BuyerListItem;
  summary: BuyerBalanceSummary;
  salesHistory: SaleListItem[];
  receipts: ReceiptSummary[];
  ledger: BuyerLedgerEntry[];
}

export interface SaleListItem extends Sale {
  buyerName?: string | null;
  batchCode?: string | null;
  siteName?: string | null;
  totalPaid?: number;
  outstandingBalance?: number;
  settlementStatus?: string;
  buyerAdvanceCredit?: number;
  buyerNetBalance?: number;
}

interface SaleListResponse {
  data: SaleListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface SaleListParams {
  page?: number;
  limit?: number;
  status?: string;
  buyerId?: number;
  batchId?: number;
  startDate?: string;
  endDate?: string;
}

interface SaleDetail {
  sale: SaleListItem;
  buyer: BuyerListItem | null;
  lorryLines: SaleLorryRow[];
  payments: SalePaymentRow[];
  totalPaid: number;
  outstandingBalance: number;
  availableBuyerCredit: number;
  buyerBalance: BuyerBalanceSummary;
}

export interface SaleLorryRow {
  id?: number;
  saleId?: number;
  lineSequence?: number;
  lorryNumber: string;
  birdsCount: number;
  previousWeight: number;
  loadedWeight: number;
  netWeight?: number;
  notes?: string | null;
}

export interface SalePaymentRow {
  id: string;
  source: 'legacy' | 'receipt_line';
  saleId: number;
  receiptId?: number | null;
  receiptCode?: string | null;
  paymentAmount: string;
  paymentDate: string;
  paymentMethod: string;
  financeAccountId?: number | null;
  financeAccountName?: string | null;
  treasuryTransactionId?: number | null;
  treasuryReversalTransactionId?: number | null;
  referenceNumber?: string | null;
  chequeNumber?: string | null;
  chequeDate?: string | null;
  bankName?: string | null;
  paymentStatus: string;
  notes?: string | null;
}

export interface CreateSalePayload {
  batchId: number;
  buyerId: number;
  saleDate: string;
  pricePerKg: number;
  totalBirds?: number;
  totalWeight?: number;
  lorries?: Array<{
    lorryNumber: string;
    birdsCount: number;
    previousWeight: number;
    loadedWeight: number;
    notes?: string;
  }>;
  notes?: string;
}

export interface UpdateSalePayload {
  status?: 'draft' | 'reviewed' | 'completed' | 'cancelled';
  pricePerKg?: number;
  lorries?: Array<{
    lorryNumber: string;
    birdsCount: number;
    previousWeight: number;
    loadedWeight: number;
    notes?: string;
  }>;
  notes?: string | null;
}

export interface CreateReceiptPayload {
  paymentAmount?: number;
  paymentDate?: string;
  paymentMethod?: 'cash' | 'cheque' | 'bank_transfer';
  financeAccountId?: number;
  referenceNumber?: string;
  chequeNumber?: string;
  chequeDate?: string;
  bankName?: string;
  notes?: string;
  receiptDate?: string;
  receiptNotes?: string;
  lines?: Array<{
    paymentAmount: number;
    paymentMethod: 'cash' | 'cheque' | 'bank_transfer';
    financeAccountId?: number;
    referenceNumber?: string;
    chequeNumber?: string;
    chequeDate?: string;
    bankName?: string;
    notes?: string;
  }>;
}

// --- Buyer hooks ---

export function useBuyers(params: BuyerListParams) {
  const queryString = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();

  return useQuery({
    queryKey: ['buyers', params],
    queryFn: () => apiGet<BuyerListItem[]>(`/buyers?${queryString}`) as unknown as Promise<BuyerListResponse>,
  });
}

export function useBuyer(id: string | undefined) {
  return useQuery({
    queryKey: ['buyers', id],
    queryFn: () => apiGet<BuyerDetail>(`/buyers/${id}`),
    enabled: !!id,
  });
}

export function useCreateBuyer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Buyer, 'id' | 'status' | 'createdAt' | 'updatedAt'>) =>
      apiPost<Buyer>('/buyers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyers'] });
    },
  });
}

export function useUpdateBuyer(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Buyer>) =>
      apiPut<Buyer>(`/buyers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyers'] });
      queryClient.invalidateQueries({ queryKey: ['buyers', id] });
    },
  });
}

export function useDeleteBuyer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete<void>(`/buyers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyers'] });
    },
  });
}

// --- Sale hooks ---

export function useSales(params: SaleListParams) {
  const queryString = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();

  return useQuery({
    queryKey: ['sales', params],
    queryFn: () => apiGet<SaleListItem[]>(`/sales?${queryString}`) as unknown as Promise<SaleListResponse>,
  });
}

export function useSale(id: string | undefined) {
  return useQuery({
    queryKey: ['sales', id],
    queryFn: () => apiGet<SaleDetail>(`/sales/${id}`),
    enabled: !!id,
  });
}

export function useCreateSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSalePayload) =>
      apiPost<Sale>('/sales', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['buyers'] });
    },
  });
}

export function useUpdateSale(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateSalePayload) =>
      apiPut<Sale>(`/sales/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['sales', id] });
      queryClient.invalidateQueries({ queryKey: ['buyers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// --- Payment hooks ---

export function useCreatePayment(saleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateReceiptPayload) =>
      apiPost<{ receipt: { id: number; receiptCode: string }; lines: Array<{ id: number }> }>(`/sales/${saleId}/payments`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', saleId] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['buyers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['treasury'] });
    },
  });
}

export function useUpdatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, data }: { paymentId: string; data: { paymentStatus?: string; notes?: string; financeAccountId?: number } }) =>
      apiPut<SalePaymentRow>(`/payments/${paymentId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['buyers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['treasury'] });
    },
  });
}
