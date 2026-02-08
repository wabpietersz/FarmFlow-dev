import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import type { Supplier, FeedRecipe, FeedInventory, SystemConfig } from '@farmflow/shared';

// --- Response interfaces ---

interface SupplierListResponse {
  data: Supplier[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface SupplierListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

interface RecipeListResponse {
  data: FeedRecipe[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface RecipeListParams {
  page?: number;
  limit?: number;
  feedType?: string;
  status?: string;
  search?: string;
}

interface InventoryListResponse {
  data: FeedInventory[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface InventoryListParams {
  page?: number;
  limit?: number;
  search?: string;
}

// --- Supplier hooks ---

export function useSuppliers(params: SupplierListParams) {
  const queryString = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();

  return useQuery({
    queryKey: ['suppliers', params],
    queryFn: () => apiGet<Supplier[]>(`/feed/suppliers?${queryString}`) as unknown as Promise<SupplierListResponse>,
  });
}

export function useSupplier(id: string | undefined) {
  return useQuery({
    queryKey: ['suppliers', id],
    queryFn: () => apiGet<Supplier>(`/feed/suppliers/${id}`),
    enabled: !!id,
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Supplier, 'id' | 'status' | 'createdAt' | 'updatedAt'>) =>
      apiPost<Supplier>('/feed/suppliers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}

export function useUpdateSupplier(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Supplier>) =>
      apiPut<Supplier>(`/feed/suppliers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers', id] });
    },
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete<void>(`/feed/suppliers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}

// --- Recipe hooks ---

export function useRecipes(params: RecipeListParams) {
  const queryString = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();

  return useQuery({
    queryKey: ['recipes', params],
    queryFn: () => apiGet<FeedRecipe[]>(`/feed/recipes?${queryString}`) as unknown as Promise<RecipeListResponse>,
  });
}

export function useRecipe(id: string | undefined) {
  return useQuery({
    queryKey: ['recipes', id],
    queryFn: () => apiGet<FeedRecipe>(`/feed/recipes/${id}`),
    enabled: !!id,
  });
}

export function useCreateRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<FeedRecipe, 'id' | 'status' | 'createdAt' | 'updatedAt'>) =>
      apiPost<FeedRecipe>('/feed/recipes', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });
}

export function useUpdateRecipe(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<FeedRecipe>) =>
      apiPut<FeedRecipe>(`/feed/recipes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      queryClient.invalidateQueries({ queryKey: ['recipes', id] });
    },
  });
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete<void>(`/feed/recipes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });
}

// --- Inventory hooks ---

export function useInventory(params: InventoryListParams) {
  const queryString = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();

  return useQuery({
    queryKey: ['inventory', params],
    queryFn: () => apiGet<FeedInventory[]>(`/feed/inventory?${queryString}`) as unknown as Promise<InventoryListResponse>,
  });
}

export function useCreateInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<FeedInventory, 'id' | 'createdAt' | 'updatedAt'>) =>
      apiPost<FeedInventory>('/feed/inventory', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useUpdateInventory(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<FeedInventory>) =>
      apiPut<FeedInventory>(`/feed/inventory/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', id] });
    },
  });
}

export function useRestockInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: number; quantity: number; costPerUnit?: number }) =>
      apiPost<FeedInventory>(`/feed/inventory/${data.id}/restock`, { quantity: data.quantity, costPerUnit: data.costPerUnit }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

// --- System Config hooks ---

export function useSystemConfig() {
  return useQuery({
    queryKey: ['system-config'],
    queryFn: () => apiGet<SystemConfig[]>('/system-config'),
  });
}

export function useSystemConfigByKey(key: string) {
  return useQuery({
    queryKey: ['system-config', key],
    queryFn: () => apiGet<SystemConfig>(`/system-config/${key}`),
    enabled: !!key,
  });
}

export function useUpdateSystemConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, data }: { key: string; data: { configValue: unknown; description?: string } }) =>
      apiPut<SystemConfig>(`/system-config/${key}`, { value: data.configValue, description: data.description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-config'] });
    },
  });
}
