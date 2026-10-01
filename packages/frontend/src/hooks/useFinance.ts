import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import type { CostCentre, FinanceCategory, MoneyLedgerResponse } from '@farmflow/shared';

function buildQueryString(params: Record<string, unknown>) {
  return new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== '' && value !== null)
      .map(([key, value]) => [key, String(value)]),
  ).toString();
}

export function useFinanceCategories(params: { status?: 'active' | 'inactive' } = {}) {
  const queryString = buildQueryString(params);
  return useQuery({
    queryKey: ['finance', 'categories', params],
    queryFn: () => apiGet<FinanceCategory[]>(`/treasury/categories${queryString ? `?${queryString}` : ''}`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCostCentres(params: { status?: 'active' | 'inactive' } = {}) {
  const queryString = buildQueryString(params);
  return useQuery({
    queryKey: ['finance', 'cost-centres', params],
    queryFn: () => apiGet<CostCentre[]>(`/treasury/cost-centres${queryString ? `?${queryString}` : ''}`),
    staleTime: 5 * 60 * 1000,
  });
}

export interface CreateFinanceCategoryPayload {
  code: string;
  name: string;
  categoryType: 'income' | 'expense' | 'financing';
  reportGroup: string;
  description?: string;
}

export function useCreateFinanceCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateFinanceCategoryPayload) => apiPost<FinanceCategory>('/treasury/categories', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['finance', 'categories'] }),
  });
}

export function useUpdateFinanceCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Pick<FinanceCategory, 'name' | 'reportGroup' | 'description' | 'status'>> }) =>
      apiPut<FinanceCategory>(`/treasury/categories/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['finance', 'categories'] }),
  });
}

export function useCreateCostCentre() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { code: string; name: string; centreType: 'mill' | 'admin' }) => apiPost<CostCentre>('/treasury/cost-centres', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['finance', 'cost-centres'] }),
  });
}

export function useUpdateCostCentre() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; status?: 'active' | 'inactive' } }) =>
      apiPut<CostCentre>(`/treasury/cost-centres/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['finance', 'cost-centres'] }),
  });
}

export interface MoneyLedgerParams {
  accountId?: number;
  categoryId?: number;
  costCentreId?: number;
  batchId?: number;
  categoryType?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export function useMoneyLedger(params: MoneyLedgerParams) {
  const queryString = buildQueryString(params as Record<string, unknown>);
  return useQuery({
    queryKey: ['treasury', 'ledger', params],
    queryFn: () => apiGet<MoneyLedgerResponse>(`/treasury/ledger${queryString ? `?${queryString}` : ''}`),
  });
}

export function useRetagLedgerEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, data }: { entryId: number; data: { categoryId: number; costCentreId?: number | null; batchId?: number | null } }) =>
      apiPut(`/treasury/ledger/${entryId}/tags`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury', 'ledger'] });
      queryClient.invalidateQueries({ queryKey: ['treasury', 'transactions'] });
    },
  });
}
