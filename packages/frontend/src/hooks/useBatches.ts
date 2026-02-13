import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import type { Batch, DailyRecord, Vaccination, CreateBatchRequest, CreateDailyRecordRequest, RecordMortalityRequest } from '@farmflow/shared';

interface BatchListItem extends Batch {
  siteName: string | null;
  cageNumber: string | null;
}

interface BatchListResponse {
  data: BatchListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface BatchListParams {
  page?: number;
  limit?: number;
  status?: string;
  siteId?: number;
}

interface BatchDetail {
  batch: BatchListItem;
  dailyRecords: DailyRecord[];
  vaccinations: Vaccination[];
  stats: {
    fcr: number | null;
    totalMortality: number;
    mortalityRate: number;
    currentBirdCount: number;
    currentAge: number;
    latestWeight: number | null;
  };
}

export function useBatches(params: BatchListParams) {
  const queryString = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();

  return useQuery({
    queryKey: ['batches', params],
    queryFn: () => apiGet<BatchListItem[]>(`/batches?${queryString}`) as unknown as Promise<BatchListResponse>,
  });
}

export function useBatch(id: string | undefined) {
  return useQuery({
    queryKey: ['batches', id],
    queryFn: () => apiGet<BatchDetail>(`/batches/${id}`),
    enabled: !!id,
  });
}

export function useCreateBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBatchRequest) =>
      apiPost<Batch>('/batches', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
  });
}

export function useUpdateBatch(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<{ status: string; expectedDeliveryDate: string; actualDeliveryDate: string; notes: string }>) =>
      apiPut<Batch>(`/batches/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['batches', id] });
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
  });
}

export function useCreateDailyRecord(batchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDailyRecordRequest) =>
      apiPost<DailyRecord>(`/batches/${batchId}/daily-records`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches', batchId] });
    },
  });
}

export function useUpdateDailyRecord(batchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recordId, data }: { recordId: number; data: Partial<Omit<CreateDailyRecordRequest, 'batchId' | 'recordDate' | 'currentAge'>> }) =>
      apiPut<DailyRecord>(`/batches/${batchId}/daily-records/${recordId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches', batchId] });
    },
  });
}

export function useRecordMortality(batchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RecordMortalityRequest) =>
      apiPost<DailyRecord>(`/batches/${batchId}/mortality`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches', batchId] });
    },
  });
}

export function useCreateVaccination(batchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { batchId: number; vaccineType: string; vaccinationDate: string; notes?: string }) =>
      apiPost<Vaccination>(`/batches/${batchId}/vaccinations`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches', batchId] });
    },
  });
}
