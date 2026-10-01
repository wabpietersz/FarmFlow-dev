import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import type { Batch, ChickPlacement, DailyRecord, Vaccination, CreateBatchRequest, CreateDailyRecordRequest, RecordMortalityRequest } from '@farmflow/shared';

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
  chickPlacement?: ChickPlacement | null;
  dailyRecords: DailyRecord[];
  vaccinations: Vaccination[];
  costSummary?: BatchCostSummary | null;
  inventoryConsumptions: Array<{
    id: number;
    inventoryItemId: number;
    inventoryLotId?: number | null;
    purchaseOrderItemId?: number | null;
    ingredientName: string;
    itemCode?: string | null;
    typeName: string;
    typeCode: string;
    quantity: string;
    unit: string;
    unitCost: string;
    lineCost: string;
    consumptionDate: string;
    referenceType?: string | null;
    referenceId?: number | null;
    notes?: string | null;
  }>;
  stats: {
    fcr: number | null;
    totalMortality: number;
    mortalityRate: number;
    currentBirdCount: number;
    currentAge: number;
    latestWeight: number | null;
    totalInventoryCost: number;
    totalInventoryQuantity: number;
  };
}

export interface BatchCostSummary {
  batchId: number;
  batchCode: string;
  chickCost?: number;
  feedCost: number;
  inventoryCost: number;
  laborCost: number;
  operationalExpenseCost: number;
  totalCost: number;
  costPerBird: number;
}

export interface BatchCostLedgerEntry {
  componentType: 'chicks' | 'feed' | 'inventory' | 'labor' | 'operational_expense';
  allocationType: 'direct' | 'site' | 'shared_overhead';
  eventDate: string;
  sourceType: string;
  sourceId: number;
  sourceCode?: string | null;
  description: string;
  quantity?: number | null;
  unit?: string | null;
  unitCost?: number | null;
  amount: number;
  basis?: string | null;
  notes?: string | null;
}

interface BatchCostLedgerResponse {
  batchId: number;
  batchCode: string;
  totals: BatchCostSummary;
  ledger: BatchCostLedgerEntry[];
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

export function useBatchCosts(id: string | undefined) {
  return useQuery({
    queryKey: ['batches', id, 'costs'],
    queryFn: () => apiGet<BatchCostSummary>(`/batches/${id}/costs`),
    enabled: !!id,
  });
}

export function useBatchCostLedger(id: string | undefined) {
  return useQuery({
    queryKey: ['batches', id, 'cost-ledger'],
    queryFn: () => apiGet<BatchCostLedgerResponse>(`/batches/${id}/cost-ledger`),
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
    mutationFn: (data: { batchId: number; vaccineType: string; vaccinationDate: string; inventoryItemId?: number; quantityUsed?: number; notes?: string }) =>
      apiPost<Vaccination>(`/batches/${batchId}/vaccinations`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches', batchId] });
    },
  });
}

export function useCreateChickPlacement(batchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      supplierId?: number;
      contractId?: number;
      placementDate: string;
      invoiceReference?: string;
      deliveredQuantity: number;
      mortalityOnArrival?: number;
      unitCost: number;
      notes?: string;
    }) => apiPost<ChickPlacement>(`/batches/${batchId}/chick-placement`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches', batchId] });
      queryClient.invalidateQueries({ queryKey: ['batches', batchId, 'costs'] });
      queryClient.invalidateQueries({ queryKey: ['batches', batchId, 'cost-ledger'] });
    },
  });
}

export interface BatchKpis {
  birdsPlaced: number;
  deaths: number;
  birdsSold: number;
  liveBirds: number;
  unaccountedBirds?: number;
  kgSold: number;
  feedKg: number;
  revenue: number;
  ageDays: number;
  averageWeightKg: number | null;
  livabilityPct: number | null;
  mortalityPct: number | null;
  fcr: number | null;
  epef: number | null;
  totalCost: number;
  costPerBirdSold: number | null;
  costPerKg: number | null;
  profit: number;
  profitPerBird: number | null;
  marginPct: number | null;
}

export interface BatchPerformance {
  batchId: number;
  status: string;
  closed: boolean;
  closedAt?: string | null;
  kpis: BatchKpis;
  costs: BatchCostSummary & { birdDays?: number; stale?: boolean; ledger: BatchCostLedgerEntry[] };
  lateCosts: number;
}

export function useBatchPerformance(id: string | undefined) {
  return useQuery({
    queryKey: ['batches', id, 'performance'],
    queryFn: () => apiGet<BatchPerformance>(`/batches/${id}/performance`),
    enabled: !!id,
  });
}

export function useCloseBatch(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { notes?: string; acceptVariance?: boolean }) => apiPost(`/batches/${id}/close`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['batches'] }),
  });
}

export function useReopenBatch(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost(`/batches/${id}/reopen`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['batches'] }),
  });
}

export interface CostPoolRow {
  kind: 'site' | 'admin' | 'mill';
  siteId: number | null;
  label: string;
  month: string;
  total: number;
  allocated: number;
  unallocated: number;
}

export interface MillMonthRow {
  month: string;
  overhead: number;
  kgProduced: number;
  overheadPerKg: number;
}

export function useCostingOverview(params: { from?: string; to?: string } = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return useQuery({
    queryKey: ['batches', 'costing-overview', params],
    queryFn: () => apiGet<{ pools: CostPoolRow[]; mill: MillMonthRow[] }>(`/batches/costing/overview${query ? `?${query}` : ''}`),
  });
}
