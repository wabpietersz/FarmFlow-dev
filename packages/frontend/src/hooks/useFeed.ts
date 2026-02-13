import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '@/lib/api';
import type { Supplier, FeedRecipe, FeedInventory, FeedProductionBatch, FeedDistribution, SystemConfig } from '@farmflow/shared';

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
    mutationFn: (data: Omit<FeedRecipe, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'version' | 'parentRecipeId' | 'targetProtein' | 'targetEnergy' | 'targetFiber' | 'targetCalcium'> & { targetProtein?: number | null; targetEnergy?: number | null; targetFiber?: number | null; targetCalcium?: number | null }) =>
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

export function useToggleRecipeStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'active' | 'inactive' }) =>
      apiPatch<FeedRecipe>(`/feed/recipes/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
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

// --- Production hooks ---

interface ProductionListResponse {
  data: (FeedProductionBatch & { recipeName?: string; feedType?: string })[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ProductionListParams {
  page?: number;
  limit?: number;
  status?: string;
  recipeId?: number;
  search?: string;
}

interface ProductionDetailResponse {
  production: FeedProductionBatch & { recipeName?: string; feedType?: string };
  materials: {
    id: number;
    productionBatchId: number;
    inventoryItemId: number;
    ingredientName?: string;
    plannedQuantity: string;
    actualQuantity?: string | null;
    unit: string;
    availableQuantity?: string;
    costPerUnit?: string;
  }[];
  totalDistributed: number;
  availableForDistribution: number;
}

interface ProductionSummaryResponse {
  activeProductionCount: number;
  completedByFeedType: { feedType: string; totalProduced: number; batchCount: number }[];
}

export function useProductions(params: ProductionListParams) {
  const queryString = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();

  return useQuery({
    queryKey: ['productions', params],
    queryFn: () => apiGet<ProductionListResponse>(`/feed/production?${queryString}`) as unknown as Promise<ProductionListResponse>,
  });
}

export function useProduction(id: string | undefined) {
  return useQuery({
    queryKey: ['productions', id],
    queryFn: () => apiGet<ProductionDetailResponse>(`/feed/production/${id}`) as unknown as Promise<{ data: ProductionDetailResponse }>,
    enabled: !!id,
  });
}

export function useProductionSummary() {
  return useQuery({
    queryKey: ['production-summary'],
    queryFn: () => apiGet<ProductionSummaryResponse>('/feed/production/summary') as unknown as Promise<{ data: ProductionSummaryResponse }>,
  });
}

export function useCreateProduction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { recipeId: number; plannedQuantity: number; unit?: string; productionDate: string; notes?: string }) =>
      apiPost<FeedProductionBatch>('/feed/production', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productions'] });
      queryClient.invalidateQueries({ queryKey: ['production-summary'] });
    },
  });
}

export function useUpdateProductionStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { status: string }) =>
      apiPut<FeedProductionBatch>(`/feed/production/${id}/status`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productions'] });
      queryClient.invalidateQueries({ queryKey: ['productions', id] });
      queryClient.invalidateQueries({ queryKey: ['production-summary'] });
    },
  });
}

export function useCompleteProduction(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { actualQuantity: number; materials: { inventoryItemId: number; actualQuantity: number }[] }) =>
      apiPost<FeedProductionBatch>(`/feed/production/${id}/complete`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productions'] });
      queryClient.invalidateQueries({ queryKey: ['productions', id] });
      queryClient.invalidateQueries({ queryKey: ['production-summary'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useDeleteProduction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete<void>(`/feed/production/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productions'] });
      queryClient.invalidateQueries({ queryKey: ['production-summary'] });
    },
  });
}

// --- Distribution hooks ---

interface DistributionListResponse {
  data: (FeedDistribution & { productionCode?: string; farmBatchCode?: string })[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface DistributionListParams {
  page?: number;
  limit?: number;
  farmBatchId?: number;
  feedType?: string;
  search?: string;
}

export function useDistributions(params: DistributionListParams) {
  const queryString = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();

  return useQuery({
    queryKey: ['distributions', params],
    queryFn: () => apiGet<DistributionListResponse>(`/feed/distribution?${queryString}`) as unknown as Promise<DistributionListResponse>,
  });
}

export function useDistribution(id: string | undefined) {
  return useQuery({
    queryKey: ['distributions', id],
    queryFn: () => apiGet<FeedDistribution>(`/feed/distribution/${id}`),
    enabled: !!id,
  });
}

export function useDistributionsByBatch(batchId: number | undefined) {
  return useQuery({
    queryKey: ['distributions', 'by-batch', batchId],
    queryFn: () => apiGet<{ distributions: FeedDistribution[]; totalDistributed: number }>(`/feed/distribution/by-batch/${batchId}`),
    enabled: !!batchId,
  });
}

export function useCreateDistribution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { productionBatchId?: number | null; farmBatchId: number; feedType: string; quantity: number; unit?: string; distributionDate: string; notes?: string }) =>
      apiPost<FeedDistribution>('/feed/distribution', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distributions'] });
      queryClient.invalidateQueries({ queryKey: ['productions'] });
    },
  });
}

export function useDeleteDistribution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete<void>(`/feed/distribution/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distributions'] });
      queryClient.invalidateQueries({ queryKey: ['productions'] });
    },
  });
}

// --- Recipe Versioning hooks ---

export function useRecipeVersions(recipeId: number | undefined) {
  return useQuery({
    queryKey: ['recipe-versions', recipeId],
    queryFn: () => apiGet<FeedRecipe[]>(`/feed/recipes/${recipeId}/versions`),
    enabled: !!recipeId,
  });
}

export function useCreateRecipeVersion(recipeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<FeedRecipe> & { ingredients?: { inventoryItemId: number; proportion: number; unit: string }[] }) =>
      apiPost<FeedRecipe>(`/feed/recipes/${recipeId}/version`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      queryClient.invalidateQueries({ queryKey: ['recipe-versions'] });
    },
  });
}

export function useRecipeCostOptimization() {
  return useQuery({
    queryKey: ['recipe-cost-optimization'],
    queryFn: () => apiGet<{ recipeId: number; recipeName: string; currentCost: number; optimizedCost: number; savings: number; savingsPercent: number; suggestions: { ingredientName: string; currentProportion: number; suggestedProportion: number; reason: string }[] }[]>('/feed/recipes/cost-optimization'),
  });
}

// --- Inventory Alerts & Audit Trail hooks ---

export function useInventoryAlerts(status: string = 'active') {
  return useQuery({
    queryKey: ['inventory-alerts', status],
    queryFn: () => apiGet<{ id: number; inventoryItemId: number; ingredientName: string; currentQuantity: string; reorderLevel: string; suggestedOrderQuantity: string; status: string; supplierName: string | null; createdAt: string }[]>(`/feed/inventory/alerts?status=${status}`),
    refetchInterval: 60 * 1000,
  });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (alertId: number) =>
      apiPut<void>(`/feed/inventory/alerts/${alertId}/acknowledge`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
    },
  });
}

export function useInventoryAuditTrail(itemId: number | undefined, params: { page?: number; limit?: number } = {}) {
  const queryString = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]),
  ).toString();
  return useQuery({
    queryKey: ['inventory-audit', itemId, params],
    queryFn: () => apiGet<{ id: number; changeType: string; previousQuantity: string; changeQuantity: string; newQuantity: string; referenceType: string | null; createdAt: string }[]>(`/feed/inventory/${itemId}/audit-trail?${queryString}`),
    enabled: !!itemId,
  });
}

export function useAdjustInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: number; quantity: number; reason: string }) =>
      apiPost<void>(`/feed/inventory/${data.id}/adjust`, { quantity: data.quantity, reason: data.reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-audit'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
    },
  });
}

export function useReorderSuggestions() {
  return useQuery({
    queryKey: ['reorder-suggestions'],
    queryFn: () => apiGet<{ inventoryItemId: number; ingredientName: string; currentQuantity: number; reorderLevel: number; unit: string; suggestedOrderQuantity: number; estimatedCost: number; supplierName: string | null; urgency: string }[]>('/feed/inventory/reorder-suggestions'),
  });
}

// --- Production Optimization hooks ---

export function useProductionSchedule(params: { startDate?: string; endDate?: string } = {}) {
  const queryString = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]),
  ).toString();
  return useQuery({
    queryKey: ['production-schedule', params],
    queryFn: () => apiGet<{ id: number; productionCode: string; recipeName: string; feedType: string; plannedQuantity: string; status: string; productionDate: string; scheduledDate: string | null; qcPassedAt: string | null }[]>(`/feed/production/schedule?${queryString}`),
  });
}

export function useProductionQC(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { qcNotes?: string }) =>
      apiPost<void>(`/feed/production/${id}/qc`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productions'] });
      queryClient.invalidateQueries({ queryKey: ['productions', id] });
      queryClient.invalidateQueries({ queryKey: ['production-schedule'] });
    },
  });
}

export function useWasteSummary(params: { startDate?: string; endDate?: string } = {}) {
  const queryString = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]),
  ).toString();
  return useQuery({
    queryKey: ['waste-summary', params],
    queryFn: () => apiGet<{ totalPlanned: number; totalActual: number; totalWaste: number; wasteRate: number; wasteByReason: { reason: string; quantity: number }[]; productions: unknown[] }>(`/feed/production/waste-summary?${queryString}`),
  });
}

// --- Report Schedule hooks ---

interface ReportScheduleData {
  id: number;
  reportType: string;
  scheduleName: string;
  cronExpression: string;
  filters: Record<string, unknown>;
  recipientEmails: string[];
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
}

export function useReportSchedules(isActive?: boolean) {
  const queryString = isActive !== undefined ? `?isActive=${isActive}` : '';
  return useQuery({
    queryKey: ['report-schedules', isActive],
    queryFn: () => apiGet<ReportScheduleData[]>(`/feed/report-schedules${queryString}`),
  });
}

export function useCreateReportSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { reportType: string; scheduleName: string; cronExpression: string; filters?: Record<string, unknown>; recipientEmails: string[] }) =>
      apiPost<ReportScheduleData>('/feed/report-schedules', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-schedules'] });
    },
  });
}

export function useUpdateReportSchedule(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<{ scheduleName: string; cronExpression: string; filters: Record<string, unknown>; recipientEmails: string[]; isActive: boolean }>) =>
      apiPut<ReportScheduleData>(`/feed/report-schedules/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-schedules'] });
    },
  });
}

export function useDeleteReportSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete<void>(`/feed/report-schedules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-schedules'] });
    },
  });
}

// --- Purchase Order hooks ---

interface PurchaseOrderListResponse {
  data: {
    id: number;
    orderCode: string;
    supplierId: number;
    supplierName: string;
    orderDate: string;
    expectedDeliveryDate: string | null;
    actualDeliveryDate: string | null;
    status: string;
    totalCost: string;
    notes: string | null;
    createdAt: string;
  }[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface PurchaseOrderListParams {
  page?: number;
  limit?: number;
  status?: string;
  supplierId?: number;
  search?: string;
}

interface PurchaseOrderDetailResponse {
  purchaseOrder: {
    id: number;
    orderCode: string;
    supplierId: number;
    supplierName: string;
    orderDate: string;
    expectedDeliveryDate: string | null;
    actualDeliveryDate: string | null;
    status: string;
    totalCost: string;
    notes: string | null;
    createdAt: string;
  };
  items: {
    id: number;
    purchaseOrderId: number;
    inventoryItemId: number;
    ingredientName: string;
    orderedQuantity: string;
    unitPrice: string;
    receivedQuantity: string;
    unit: string;
    notes: string | null;
  }[];
}

export function usePurchaseOrders(params: PurchaseOrderListParams) {
  const queryString = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();

  return useQuery({
    queryKey: ['purchase-orders', params],
    queryFn: () => apiGet<PurchaseOrderListResponse>(`/feed/purchase-orders?${queryString}`) as unknown as Promise<PurchaseOrderListResponse>,
  });
}

export function usePurchaseOrder(id: string | number | undefined) {
  return useQuery({
    queryKey: ['purchase-orders', id],
    queryFn: () => apiGet<{ data: PurchaseOrderDetailResponse }>(`/feed/purchase-orders/${id}`) as unknown as Promise<{ data: PurchaseOrderDetailResponse }>,
    enabled: !!id,
  });
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      supplierId: number;
      orderDate: string;
      expectedDeliveryDate?: string | null;
      notes?: string | null;
      items: { inventoryItemId: number; orderedQuantity: number; unitPrice: number; unit: string; notes?: string | null }[];
    }) => apiPost<unknown>('/feed/purchase-orders', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });
}

export function useUpdatePurchaseOrder(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      expectedDeliveryDate?: string | null;
      notes?: string | null;
      items?: { inventoryItemId: number; orderedQuantity: number; unitPrice: number; unit: string; notes?: string | null }[];
    }) => apiPut<unknown>(`/feed/purchase-orders/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', id] });
    },
  });
}

export function useDeletePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete<void>(`/feed/purchase-orders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });
}

export function useUpdatePurchaseOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: number; status: string }) =>
      apiPut<unknown>(`/feed/purchase-orders/${data.id}/status`, { status: data.status }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', variables.id] });
    },
  });
}

export function useReceivePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: number; items: { itemId: number; receivedQuantity: number }[] }) =>
      apiPost<unknown>(`/feed/purchase-orders/${data.id}/receive`, { items: data.items }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['reorder-suggestions'] });
    },
  });
}

export function useSupplierPurchaseOrders(supplierId: number | undefined) {
  return useQuery({
    queryKey: ['purchase-orders', 'supplier', supplierId],
    queryFn: () => apiGet<{ data: unknown[] }>(`/feed/suppliers/${supplierId}/purchase-orders`),
    enabled: !!supplierId,
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
