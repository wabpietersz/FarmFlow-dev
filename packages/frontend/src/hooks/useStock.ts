import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut } from '@/lib/api';

export interface StockLocation {
  id: number;
  code: string;
  name: string;
  locationType: 'central' | 'mill_store' | 'farm_store' | 'other';
  siteId?: number | null;
  status: 'active' | 'inactive';
}

export interface StockBalance {
  locationId: number;
  locationName: string;
  locationType: string;
  inventoryItemId: number;
  itemName: string;
  unit: string;
  quantity: number;
  value: number;
  nextExpiry: string | null;
}

export interface StockTransferRow {
  id: number;
  transferCode: string;
  transferDate: string;
  fromName: string;
  toName: string;
  notes?: string | null;
  lineCount: number;
  value: number;
  items: string | null;
}

export interface ExpiringLot {
  lotId: number;
  lotCode: string;
  inventoryItemId: number;
  itemName: string;
  unit: string;
  locationName: string;
  remainingQuantity: number;
  value: number;
  expiryDate: string;
  expired: boolean;
  daysLeft: number;
}

export interface RequisitionItem {
  requisitionId: number;
  inventoryItemId: number;
  itemName: string;
  unit: string;
  quantity: string;
  lastCost: string;
  notes?: string | null;
}

export interface Requisition {
  id: number;
  requisitionCode: string;
  status: 'submitted' | 'approved' | 'rejected' | 'ordered';
  neededBy?: string | null;
  notes?: string | null;
  reviewNotes?: string | null;
  createdAt: string;
  costCentreId: number;
  costCentreName: string;
  deliveryLocationId?: number | null;
  deliveryLocationName?: string | null;
  requestedByName: string;
  purchaseOrderId?: number | null;
  purchaseOrderCode?: string | null;
  items: RequisitionItem[];
}

const KEY = ['stock'];

function useStockMutation<T>(fn: (vars: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
      queryClient.invalidateQueries({ queryKey: ['inventory-management'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export const useStockLocations = () => useQuery({ queryKey: [...KEY, 'locations'], queryFn: () => apiGet<StockLocation[]>('/inventory/locations') });
export const useStockBalances = (params: { locationId?: number } = {}) =>
  useQuery({ queryKey: [...KEY, 'balances', params], queryFn: () => apiGet<StockBalance[]>(`/inventory/stock-balances${params.locationId ? `?locationId=${params.locationId}` : ''}`) });
export const useStockTransfers = () => useQuery({ queryKey: [...KEY, 'transfers'], queryFn: () => apiGet<StockTransferRow[]>('/inventory/transfers') });
export const useExpiringLots = (days = 30) => useQuery({ queryKey: [...KEY, 'expiring', days], queryFn: () => apiGet<ExpiringLot[]>(`/inventory/expiring?days=${days}`) });
export const useRequisitions = (status?: string) =>
  useQuery({ queryKey: [...KEY, 'requisitions', status], queryFn: () => apiGet<Requisition[]>(`/inventory/requisitions${status ? `?status=${status}` : ''}`) });

export const useCreateStockLocation = () => useStockMutation((data: { code: string; name: string; locationType: StockLocation['locationType'] }) => apiPost('/inventory/locations', data));
export const useUpdateStockLocation = () => useStockMutation((vars: { id: number; data: { name?: string; status?: 'active' | 'inactive' } }) => apiPut(`/inventory/locations/${vars.id}`, vars.data));
export const useCreateTransfer = () => useStockMutation((data: { fromLocationId: number; toLocationId: number; transferDate: string; notes?: string; lines: Array<{ inventoryItemId: number; quantity: number }> }) => apiPost('/inventory/transfers', data));
export const useWriteOffLot = () => useStockMutation((vars: { lotId: number; quantity?: number | null; reason: string }) => apiPost(`/inventory/lots/${vars.lotId}/write-off`, { quantity: vars.quantity ?? null, reason: vars.reason }));
export const useCreateRequisition = () => useStockMutation((data: { costCentreId: number; deliveryLocationId?: number | null; neededBy?: string | null; notes?: string | null; items: Array<{ inventoryItemId: number; quantity: number }> }) => apiPost('/inventory/requisitions', data));
export const useReviewRequisition = () => useStockMutation((vars: { id: number; status: 'approved' | 'rejected'; reviewNotes?: string | null }) => apiPut(`/inventory/requisitions/${vars.id}/review`, { status: vars.status, reviewNotes: vars.reviewNotes ?? null }));
export const useConvertRequisition = () => useStockMutation((vars: { id: number; supplierId: number; orderDate: string; expectedDeliveryDate?: string | null; prices: Array<{ inventoryItemId: number; unitPrice: number }> }) => apiPost(`/inventory/requisitions/${vars.id}/order`, vars));
