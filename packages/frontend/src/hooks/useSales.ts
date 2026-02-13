import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import type { Buyer, Sale, Payment, CreatePaymentRequest } from '@farmflow/shared';

// --- Response interfaces ---

interface BuyerListResponse {
  data: Buyer[];
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

interface BuyerDetail {
  buyer: Buyer;
  salesHistory: SaleListItem[];
}

interface SaleListItem extends Sale {
  buyerName?: string | null;
  batchCode?: string | null;
  siteName?: string | null;
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
  buyer: Buyer;
  payments: Payment[];
  totalPaid: number;
  outstandingBalance: number;
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
    queryFn: () => apiGet<Buyer[]>(`/buyers?${queryString}`) as unknown as Promise<BuyerListResponse>,
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
    mutationFn: (data: { batchId: number; buyerId: number; saleDate: string; totalBirds: number; totalWeight: number; pricePerKg: number; notes?: string }) =>
      apiPost<Sale>('/sales', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateSale(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { status?: string; notes?: string }) =>
      apiPut<Sale>(`/sales/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['sales', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// --- Payment hooks ---

export function useCreatePayment(saleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<CreatePaymentRequest, 'saleId'>) =>
      apiPost<Payment>(`/sales/${saleId}/payments`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', saleId] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, data }: { paymentId: number; data: { paymentStatus?: string; notes?: string } }) =>
      apiPut<Payment>(`/payments/${paymentId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
