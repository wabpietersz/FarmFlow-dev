import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { queueMutation } from '@/lib/offlineSync';

// ─── Types ────────────────────────────────────────────────────────────────────

export type HealthTaskType = 'vaccination' | 'medication' | 'other';
export type HealthMethod = 'drinking_water' | 'eye_drop' | 'spray' | 'injection' | 'feed' | 'other';

export const METHOD_LABELS: Record<string, string> = {
  drinking_water: 'Drinking water',
  eye_drop: 'Eye drop',
  spray: 'Spray',
  injection: 'Injection',
  feed: 'In feed',
  other: 'Other',
};

export interface HealthTemplateItem {
  id?: number;
  dayOfAge: number;
  taskType: HealthTaskType;
  name: string;
  method?: HealthMethod | null;
  inventoryItemId?: number | null;
  inventoryItemName?: string | null;
  inventoryUnit?: string | null;
  dosePer1000Birds?: string | number | null;
  notes?: string | null;
}

export interface HealthTemplate {
  id: number;
  name: string;
  description?: string | null;
  isDefault: boolean;
  status: 'active' | 'inactive';
  items: HealthTemplateItem[];
}

export interface BatchHealthTask {
  id: number;
  dueDate: string;
  dayOfAge: number;
  taskType: HealthTaskType;
  name: string;
  method?: string | null;
  inventoryItemId?: number | null;
  inventoryItemName?: string | null;
  inventoryUnit?: string | null;
  plannedQuantity?: string | null;
  status: 'pending' | 'done' | 'skipped';
  completedDate?: string | null;
  completedByName?: string | null;
  skipReason?: string | null;
  notes?: string | null;
}

export interface GrowthPoint {
  dayOfAge: number;
  date: string;
  actualWeightG: number | null;
  targetWeightG: number | null;
  actualCumFeedG: number | null;
  targetCumFeedG: number | null;
  actualCumMortalityPct: number;
  targetCumMortalityPct: number | null;
}

export interface GrowthComparison {
  standard: { id: number; name: string; breed?: string | null } | null;
  series: GrowthPoint[];
  latest: null | { dayOfAge: number; actualWeightG: number | null; targetWeightG: number | null; weightVsTargetPct: number };
}

export interface GrowthStandard {
  id: number;
  name: string;
  breed?: string | null;
  notes?: string | null;
  isDefault: boolean;
  status: 'active' | 'inactive';
  points: Array<{ dayOfAge: number; targetWeightG: number; targetCumFeedG?: number | null; targetCumMortalityPct?: string | number | null }>;
}

export interface DailyRecordRow {
  id: number;
  recordDate: string;
  mortalityCount: number;
  mortalityCause?: string | null;
  feedConsumption: string;
  waterConsumption?: string | null;
  averageWeight?: string | null;
  temperature?: string | null;
  humidity?: number | null;
  notes?: string | null;
}

export interface TodayCheck {
  batch: { id: number; batchCode: string; status: string; placementDate: string; siteName: string; cageNumber: string; birdsPlaced: number };
  date: string;
  dayOfAge: number;
  liveBirdsAtStart: number;
  record: DailyRecordRow | null;
  previous: DailyRecordRow | null;
  targets: { weightG: number | null; cumMortalityPct: number | null; standardName: string | null };
  dueTasks: BatchHealthTask[];
}

export interface TodayCheckPayload {
  date: string;
  mortalityCount: number;
  mortalityCause?: string | null;
  feedConsumption: number;
  waterConsumption?: number | null;
  averageWeight?: number | null;
  temperature?: number | null;
  humidity?: number | null;
  notes?: string | null;
}

export interface VetVisit {
  id: number;
  siteId: number;
  siteName: string;
  batchId?: number | null;
  batchCode?: string | null;
  visitDate: string;
  vetName: string;
  reason?: string | null;
  findings?: string | null;
  diagnosis?: string | null;
  treatment?: string | null;
  feeAmount?: string | null;
  followUpDate?: string | null;
}

export interface Turnaround {
  id: number;
  cageId: number;
  cageNumber: string;
  siteId: number;
  siteName: string;
  previousBatchId?: number | null;
  previousBatchCode?: string | null;
  startedDate: string;
  litterRemovedDate?: string | null;
  cleanedDate?: string | null;
  disinfectedDate?: string | null;
  newLitterDate?: string | null;
  readyDate?: string | null;
  status: 'in_progress' | 'ready';
  notes?: string | null;
  downtimeDays: number;
}

export interface BatchHistoryRow {
  batchId: number;
  batchCode: string;
  siteName: string;
  cageNumber: string;
  placementDate: string;
  closedAt: string;
  revenue: number;
  totalCost: number;
  profit: number;
  birdsPlaced: number | null;
  birdsSold: number | null;
  ageDays: number | null;
  mortalityPct: number | null;
  fcr: number | null;
  averageWeightKg: number | null;
  epef: number | null;
  costPerKg: number | null;
  profitPerBird: number | null;
}

export interface BatchHistory {
  batches: BatchHistoryRow[];
  averages: Record<'mortalityPct' | 'fcr' | 'averageWeightKg' | 'epef' | 'costPerKg' | 'profitPerBird', number | null>;
  best: Record<'fcr' | 'epef' | 'profitPerBird', string | null>;
}

export interface DueHealthTask {
  id: number;
  batchId: number;
  batchCode: string;
  siteId: number;
  dueDate: string;
  dayOfAge: number;
  name: string;
  taskType: HealthTaskType;
  method?: string | null;
}

function qs(params: Record<string, unknown>) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, String(v)]),
  ).toString();
  return query ? `?${query}` : '';
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useHealthTemplates() {
  return useQuery({ queryKey: ['farm', 'health-templates'], queryFn: () => apiGet<HealthTemplate[]>('/farm/health-templates') });
}

export function useGrowthStandards() {
  return useQuery({ queryKey: ['farm', 'growth-standards'], queryFn: () => apiGet<GrowthStandard[]>('/farm/growth-standards') });
}

export function useBatchHealthTasks(batchId: string | number | undefined) {
  return useQuery({
    queryKey: ['farm', 'health-tasks', String(batchId)],
    queryFn: () => apiGet<BatchHealthTask[]>(`/farm/batches/${batchId}/health-tasks`),
    enabled: !!batchId,
  });
}

export function useDueHealthTasks(params: { siteId?: number } = {}) {
  return useQuery({ queryKey: ['farm', 'health-due', params], queryFn: () => apiGet<DueHealthTask[]>(`/farm/health-tasks/due${qs(params)}`) });
}

export function useGrowthComparison(batchId: string | number | undefined) {
  return useQuery({
    queryKey: ['farm', 'growth', String(batchId)],
    queryFn: () => apiGet<GrowthComparison>(`/farm/batches/${batchId}/growth`),
    enabled: !!batchId,
  });
}

export function useTodayCheck(batchId: string | undefined, date: string) {
  return useQuery({
    queryKey: ['farm', 'today', batchId, date],
    queryFn: () => apiGet<TodayCheck>(`/farm/batches/${batchId}/today?date=${date}`),
    enabled: !!batchId,
  });
}

export function useVetVisits(params: { batchId?: number; siteId?: number } = {}) {
  return useQuery({ queryKey: ['farm', 'vet-visits', params], queryFn: () => apiGet<VetVisit[]>(`/farm/vet-visits${qs(params)}`) });
}

export function useTurnarounds(params: { siteId?: number; status?: string } = {}) {
  return useQuery({ queryKey: ['farm', 'turnarounds', params], queryFn: () => apiGet<Turnaround[]>(`/farm/turnarounds${qs(params)}`) });
}

export function useBatchHistory(params: { siteId?: number; cageId?: number } = {}) {
  return useQuery({ queryKey: ['farm', 'batch-history', params], queryFn: () => apiGet<BatchHistory>(`/farm/batch-history${qs(params)}`) });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

function useFarmMutation<TVars>(fn: (vars: TVars) => Promise<unknown>, extraKeys: string[][] = []) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farm'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      for (const key of extraKeys) queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useSaveHealthTemplate() {
  return useFarmMutation((vars: { id?: number; data: Omit<HealthTemplate, 'id' | 'items'> & { items: HealthTemplateItem[] } }) =>
    vars.id ? apiPut(`/farm/health-templates/${vars.id}`, vars.data) : apiPost('/farm/health-templates', vars.data));
}

export function useApplyHealthTemplate(batchId: string | number) {
  return useFarmMutation((templateId: number | null) => apiPost(`/farm/batches/${batchId}/health-tasks/apply`, { templateId }));
}

export function useAddHealthTask(batchId: string | number) {
  return useFarmMutation((data: { dueDate: string; taskType: HealthTaskType; name: string; method?: string | null; notes?: string | null }) =>
    apiPost(`/farm/batches/${batchId}/health-tasks`, data));
}

export function useCompleteHealthTask() {
  return useFarmMutation(
    (vars: { taskId: number; completedDate: string; inventoryItemId?: number | null; quantityUsed?: number | null; notes?: string | null }) =>
      apiPost(`/farm/health-tasks/${vars.taskId}/complete`, vars),
    [['batches'], ['inventory-management']],
  );
}

export function useSkipHealthTask() {
  return useFarmMutation((vars: { taskId: number; reason: string }) => apiPost(`/farm/health-tasks/${vars.taskId}/skip`, { reason: vars.reason }));
}

export function useSaveGrowthStandard() {
  return useFarmMutation((vars: { id?: number; data: Omit<GrowthStandard, 'id'> }) =>
    vars.id ? apiPut(`/farm/growth-standards/${vars.id}`, vars.data) : apiPost('/farm/growth-standards', vars.data));
}

export function useSaveVetVisit() {
  return useFarmMutation((vars: { id?: number; data: Record<string, unknown> }) =>
    vars.id ? apiPut(`/farm/vet-visits/${vars.id}`, vars.data) : apiPost('/farm/vet-visits', vars.data));
}

export function useUpdateTurnaround() {
  return useFarmMutation((vars: { id: number; data: Partial<Turnaround> }) => apiPut(`/farm/turnarounds/${vars.id}`, vars.data), [['sites']]);
}

/**
 * Save today's check. Online: straight to the server so problems show immediately.
 * Offline: queued on the phone and sent when the signal returns.
 */
export function useSaveTodayCheck(batchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TodayCheckPayload & { batchCode: string }) => {
      const { batchCode, ...body } = payload;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await queueMutation({ url: `/farm/batches/${batchId}/today`, method: 'POST', body, description: `Daily check · ${batchCode} · ${body.date}` });
        return { queued: true };
      }
      await apiPost(`/farm/batches/${batchId}/today`, body);
      return { queued: false };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farm'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
