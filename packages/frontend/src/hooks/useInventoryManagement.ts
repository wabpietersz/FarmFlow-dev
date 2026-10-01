import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut } from '@/lib/api';

export interface SupplierPayment {
  id: number;
  paymentCode: string;
  supplierId: number;
  supplierName?: string | null;
  purchaseOrderId?: number | null;
  purchaseOrderCode?: string | null;
  paymentDate: string;
  financeAccountId: number;
  financeAccountName?: string | null;
  paymentMethod: 'cash' | 'cheque' | 'bank_transfer';
  amount: number | string;
  paymentStatus: string;
  referenceNumber?: string | null;
  chequeLeafId?: number | null;
  chequeNumber?: string | null;
  chequeDate?: string | null;
  bankName?: string | null;
  treasuryTransactionId?: number | null;
  treasuryReversalTransactionId?: number | null;
  notes?: string | null;
  recordedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItemType {
  id: number;
  typeCode: string;
  typeName: string;
  category: string;
  defaultUnit: string;
  allowsBatchAllocation: boolean;
  isFeed: boolean;
  financeCategoryId?: number | null;
  status: string;
  description?: string | null;
}

export interface InventorySupplier {
  id: number;
  supplierName: string;
  contactPerson?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  address?: string | null;
  defaultCategoryId?: number | null;
  status: string;
}

export interface InventoryItem {
  id: number;
  itemTypeId: number;
  itemCode?: string | null;
  ingredientName: string;
  description?: string | null;
  supplierId?: number | null;
  supplierName?: string | null;
  quantity: string;
  unit: string;
  costPerUnit: string;
  reorderLevel?: string | null;
  lastRestockDate?: string | null;
  typeCode: string;
  typeName: string;
  category: string;
  defaultUnit: string;
  allowsBatchAllocation: boolean;
  isFeed: boolean;
  lotCount?: number;
  lowStock?: boolean;
}

export interface InventoryItemDetailResponse {
  item: InventoryItem;
  lots: Array<{
    id: number;
    purchaseOrderItemId?: number | null;
    lotCode: string;
    receivedQuantity: string;
    remainingQuantity: string;
    costPerUnit: string;
    receivedDate: string;
    notes?: string | null;
    poOrderCode?: string | null;
  }>;
  consumptions: Array<{
    id: number;
    batchId: number;
    batchCode: string;
    quantity: string;
    unit: string;
    unitCost: string;
    lineCost: string;
    consumptionDate: string;
    referenceType?: string | null;
    referenceId?: number | null;
    notes?: string | null;
    inventoryLotId?: number | null;
  }>;
  summary: {
    totalConsumed: number;
    totalConsumedCost: number;
  };
}

export interface InventoryPurchaseOrder {
  id: number;
  orderCode: string;
  supplierId: number;
  supplierName: string | null;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  actualDeliveryDate?: string | null;
  status: string;
  totalCost: string;
  notes?: string | null;
  createdAt: string;
}

export interface InventoryPurchaseOrderDetailResponse {
  purchaseOrder: InventoryPurchaseOrder;
  items: Array<{
    id: number;
    purchaseOrderId: number;
    inventoryItemId: number;
    ingredientName: string;
    itemCode?: string | null;
    itemTypeId: number;
    typeName: string;
    typeCode: string;
    isFeed: boolean;
    orderedQuantity: string;
    unitPrice: string;
    receivedQuantity: string;
    unit: string;
    notes?: string | null;
    receivedPercentage: number;
  }>;
  payments?: SupplierPayment[];
  invoices?: Array<{
    id: number;
    invoiceCode: string;
    invoiceReference: string;
    invoiceDate: string;
    dueDate: string;
    invoiceAmount: string;
    status: string;
    paidAmount?: number;
    balanceDue?: number;
  }>;
  paymentSummary?: {
    totalPaid: number;
    pendingAmount: number;
    totalInvoiced?: number;
    outstandingAmount: number;
  };
}

export interface CreateSupplierPaymentPayload {
  purchaseOrderId?: number | null;
  supplierInvoiceId?: number | null;
  supplierInvoiceAllocations?: Array<{ supplierInvoiceId: number; allocatedAmount: number }> | null;
  paymentDate: string;
  financeAccountId: number;
  paymentMethod: 'cash' | 'cheque' | 'bank_transfer';
  amount: number;
  referenceNumber?: string;
  chequeLeafId?: number | null;
  notes?: string;
  /** Only used when the payment isn't linked to a purchase order. */
  categoryId?: number;
  costCentreId?: number;
  batchId?: number;
}

export interface SupplierContractTerm {
  id?: number;
  contractId?: number;
  termType: string;
  termKey: string;
  termValue: string;
  sortOrder?: number;
}

export interface SupplierContract {
  id: number;
  contractCode: string;
  supplierId: number;
  supplierName?: string | null;
  contractType: string;
  contractTitle: string;
  description?: string | null;
  status: string;
  validFrom: string;
  validTo?: string | null;
  currencyCode: string;
  paymentTermsDays: number;
  commercialTerms?: string | null;
  rateTable?: Record<string, unknown>;
  attachmentUrls?: string[];
  alertDaysBeforeExpiry: number;
  linkedPurchaseOrderCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierContractDetail extends SupplierContract {
  terms: SupplierContractTerm[];
  linkedPurchaseOrders: Array<{
    id: number;
    orderCode: string;
    orderDate: string;
    status: string;
    totalCost: string;
  }>;
  linkedInvoices: Array<{
    id: number;
    invoiceCode: string;
    invoiceReference: string;
    invoiceDate: string;
    dueDate: string;
    invoiceAmount: string;
    status: string;
  }>;
}

export interface SupplierInvoice {
  id: number;
  invoiceCode: string;
  supplierId: number;
  supplierName?: string | null;
  purchaseOrderId?: number | null;
  purchaseOrderCode?: string | null;
  contractId?: number | null;
  contractCode?: string | null;
  invoiceReference: string;
  invoiceDate: string;
  dueDate: string;
  invoiceAmount: string;
  currencyCode: string;
  status: string;
  /** How the invoice compares with the goods received on its purchase order */
  matchStatus?: 'matched' | 'over_billed' | 'under_billed' | 'no_po' | null;
  receivedValue?: string | null;
  matchVariance?: string | null;
  overrideNote?: string | null;
  notes?: string | null;
  paidAmount?: number;
  balanceDue?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierInvoiceDetail extends SupplierInvoice {
  allocations: Array<{
    id: number;
    supplierPaymentId: number;
    allocatedAmount: string;
    paymentCode: string;
    paymentDate: string;
    paymentMethod: string;
    paymentStatus: string;
    treasuryTransactionId?: number | null;
  }>;
}

export interface PayablesSummaryRow {
  supplierId: number;
  supplierName: string;
  purchaseOrderId?: number | null;
  purchaseOrderCode?: string | null;
  invoiceId: number;
  invoiceCode: string;
  invoiceReference: string;
  dueDate: string;
  orderedAmount: number;
  receivedAmount: number;
  invoicedAmount: string;
  paidAmount: number;
  balanceDue: number;
  paymentStatus: string;
}

export interface InventoryMovement {
  id: number;
  movementType: string;
  movementDate: string;
  sourceModule: string;
  sourceEntityType: string;
  sourceEntityId: number;
  sourceCodeSnapshot?: string | null;
  inventoryItemId?: number | null;
  ingredientName?: string | null;
  inventoryLotId?: number | null;
  lotCode?: string | null;
  purchaseOrderId?: number | null;
  purchaseOrderCode?: string | null;
  productionBatchId?: number | null;
  batchId?: number | null;
  batchCode?: string | null;
  quantity: string;
  unit: string;
  unitCost?: string | null;
  lineCost?: string | null;
  balanceAfterQuantity?: string | null;
  balanceScope: string;
  notes?: string | null;
  createdAt: string;
}

export interface LotTraceResponse {
  lot: {
    id: number;
    inventoryItemId: number;
    ingredientName: string;
    lotCode: string;
    receivedQuantity: string;
    remainingQuantity: string;
    costPerUnit: string;
    receivedDate: string;
    purchaseOrderItemId?: number | null;
    purchaseOrderId?: number | null;
    purchaseOrderCode?: string | null;
  };
  movements: InventoryMovement[];
  productionUsage: Array<{
    id: number;
    productionBatchId: number;
    quantity: string;
    unit: string;
    lineCost?: string | null;
    movementDate: string;
  }>;
  batchUsage: Array<{
    id: number;
    batchId?: number | null;
    batchCode?: string | null;
    quantity: string;
    unit: string;
    lineCost?: string | null;
    movementDate: string;
  }>;
}

export interface BatchAllocation {
  id: number;
  movementDate: string;
  batchId?: number | null;
  batchCode?: string | null;
  inventoryItemId?: number | null;
  ingredientName?: string | null;
  inventoryLotId?: number | null;
  lotCode?: string | null;
  sourceEntityType: string;
  sourceCodeSnapshot?: string | null;
  quantity: string;
  unit: string;
  unitCost?: string | null;
  lineCost?: string | null;
  notes?: string | null;
}

export interface SiteConsumption {
  id: number;
  siteId: number;
  siteName?: string | null;
  inventoryItemId: number;
  ingredientName?: string | null;
  inventoryLotId?: number | null;
  lotCode?: string | null;
  quantity: string;
  unit: string;
  unitCost?: string | null;
  lineCost?: string | null;
  consumptionDate: string;
  referenceType?: string | null;
  referenceId?: number | null;
  notes?: string | null;
}

export interface ServiceWorkOrder {
  id: number;
  workOrderCode: string;
  serviceType: string;
  title: string;
  supplierId?: number | null;
  supplierName?: string | null;
  contractId?: number | null;
  contractCode?: string | null;
  allocationType: string;
  siteId?: number | null;
  siteName?: string | null;
  batchId?: number | null;
  batchCode?: string | null;
  serviceDate: string;
  invoiceReference?: string | null;
  quantity?: string | null;
  unit?: string | null;
  unitRate?: string | null;
  totalAmount: string;
  status: string;
  approvalNotes?: string | null;
  financeAccountId?: number | null;
  financeAccountName?: string | null;
  paymentMethod?: string | null;
  referenceNumber?: string | null;
  chequeNumber?: string | null;
  supplierPaymentId?: number | null;
  treasuryTransactionId?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

function buildQueryString(params: Record<string, unknown>) {
  return new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== '')
      .map(([key, value]) => [key, String(value)]),
  ).toString();
}

export function useInventoryItemTypes(params: { status?: string; category?: string } = {}) {
  const queryString = buildQueryString(params);
  return useQuery({
    queryKey: ['inventory-management', 'item-types', params],
    queryFn: () => apiGet<InventoryItemType[]>(`/inventory/item-types${queryString ? `?${queryString}` : ''}`),
  });
}

export function useCreateInventoryItemType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<InventoryItemType>) => apiPost<InventoryItemType>('/inventory/item-types', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory-management', 'item-types'] }),
  });
}

export function useUpdateInventoryItemType(id: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<InventoryItemType>) => apiPut<InventoryItemType>(`/inventory/item-types/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory-management', 'item-types'] }),
  });
}

export function useInventorySuppliers(params: { status?: string; search?: string } = {}) {
  const queryString = buildQueryString(params);
  return useQuery({
    queryKey: ['inventory-management', 'suppliers', params],
    queryFn: () => apiGet<InventorySupplier[]>(`/inventory/suppliers${queryString ? `?${queryString}` : ''}`),
  });
}

export function useCreateInventorySupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<InventorySupplier>) => apiPost<InventorySupplier>('/inventory/suppliers', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory-management', 'suppliers'] }),
  });
}

export function useUpdateInventorySupplier(id: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<InventorySupplier>) => apiPut<InventorySupplier>(`/inventory/suppliers/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory-management', 'suppliers'] }),
  });
}

export function useSupplierPayments(supplierId: number | undefined) {
  return useQuery({
    queryKey: ['inventory-management', 'suppliers', supplierId, 'payments'],
    queryFn: () => apiGet<SupplierPayment[]>(`/inventory/suppliers/${supplierId}/payments`),
    enabled: !!supplierId,
  });
}

export function useCreateSupplierPayment(supplierId: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSupplierPaymentPayload) =>
      apiPost<SupplierPayment>(`/inventory/suppliers/${supplierId}/payments`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-management', 'suppliers', supplierId, 'payments'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-management', 'purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-management', 'supplier-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-management', 'payables-summary'] });
      queryClient.invalidateQueries({ queryKey: ['treasury'] });
      queryClient.invalidateQueries({ queryKey: ['reports', 'financial-overview'] });
    },
  });
}

export function useSupplierContracts(params: { supplierId?: number; status?: string } = {}) {
  const queryString = buildQueryString(params);
  return useQuery({
    queryKey: ['inventory-management', 'contracts', params],
    queryFn: () => apiGet<SupplierContract[]>(`/inventory/contracts${queryString ? `?${queryString}` : ''}`),
  });
}

export function useSupplierContract(id: number | undefined) {
  return useQuery({
    queryKey: ['inventory-management', 'contracts', id],
    queryFn: () => apiGet<SupplierContractDetail>(`/inventory/contracts/${id}`),
    enabled: !!id,
  });
}

export function useCreateSupplierContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost<SupplierContract>('/inventory/contracts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-management', 'contracts'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-management', 'purchase-orders'] });
    },
  });
}

export function useReviewSupplierContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { status: 'active' | 'rejected' | 'suspended'; approvalNotes?: string } }) =>
      apiPut<SupplierContract>(`/inventory/contracts/${id}/review`, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-management', 'contracts'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-management', 'contracts', variables.id] });
    },
  });
}

export function useSupplierInvoices(params: { supplierId?: number; purchaseOrderId?: number; status?: string } = {}) {
  const queryString = buildQueryString(params);
  return useQuery({
    queryKey: ['inventory-management', 'supplier-invoices', params],
    queryFn: () => apiGet<SupplierInvoice[]>(`/inventory/supplier-invoices${queryString ? `?${queryString}` : ''}`),
  });
}

export function useSupplierInvoice(id: number | undefined) {
  return useQuery({
    queryKey: ['inventory-management', 'supplier-invoices', id],
    queryFn: () => apiGet<SupplierInvoiceDetail>(`/inventory/supplier-invoices/${id}`),
    enabled: !!id,
  });
}

export function useCreateSupplierInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost<SupplierInvoice>('/inventory/supplier-invoices', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-management', 'supplier-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-management', 'purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-management', 'payables-summary'] });
    },
  });
}

export function useReviewSupplierInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { status: 'approved' | 'rejected'; approvalNotes?: string; overrideNote?: string } }) =>
      apiPut<SupplierInvoice>(`/inventory/supplier-invoices/${id}/review`, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-management', 'supplier-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-management', 'supplier-invoices', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['inventory-management', 'payables-summary'] });
    },
  });
}

export function usePayablesSummary(params: { supplierId?: number } = {}) {
  const queryString = buildQueryString(params);
  return useQuery({
    queryKey: ['inventory-management', 'payables-summary', params],
    queryFn: () => apiGet<PayablesSummaryRow[]>(`/inventory/payables/summary${queryString ? `?${queryString}` : ''}`),
  });
}

export function useInventoryMovements(params: { itemId?: number; batchId?: number; lotId?: number; productionBatchId?: number; movementType?: string } = {}) {
  const queryString = buildQueryString(params);
  return useQuery({
    queryKey: ['inventory-management', 'movements', params],
    queryFn: () => apiGet<InventoryMovement[]>(`/inventory/movements${queryString ? `?${queryString}` : ''}`),
  });
}

export function useLotTrace(id: number | undefined) {
  return useQuery({
    queryKey: ['inventory-management', 'lot-trace', id],
    queryFn: () => apiGet<LotTraceResponse>(`/inventory/lots/${id}/trace`),
    enabled: !!id,
  });
}

export function useBatchAllocations(params: { batchId?: number } = {}) {
  const queryString = buildQueryString(params);
  return useQuery({
    queryKey: ['inventory-management', 'batch-allocations', params],
    queryFn: () => apiGet<BatchAllocation[]>(`/inventory/batch-allocations${queryString ? `?${queryString}` : ''}`),
  });
}

export function useInventoryItems(params: { page?: number; limit?: number; search?: string; itemTypeId?: number; category?: string; feedOnly?: boolean } = {}) {
  const queryString = buildQueryString(params);
  return useQuery({
    queryKey: ['inventory-management', 'items', params],
    queryFn: () => apiGet<InventoryItem[]>(`/inventory/items${queryString ? `?${queryString}` : ''}`) as unknown as Promise<{
      data: InventoryItem[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>,
  });
}

export function useInventoryItem(id: number | undefined) {
  return useQuery({
    queryKey: ['inventory-management', 'items', id],
    queryFn: () => apiGet<InventoryItemDetailResponse>(`/inventory/items/${id}`) as unknown as Promise<{ data: InventoryItemDetailResponse }>,
    enabled: !!id,
  });
}

export function useCreateInventoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost<InventoryItem>('/inventory/items', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-management', 'items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
    },
  });
}

export function useUpdateInventoryItem(id: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPut<InventoryItem>(`/inventory/items/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-management', 'items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-management', 'items', id] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useConsumeInventoryItem(id: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { batchId: number; quantity: number; consumptionDate: string; notes?: string | null }) =>
      apiPost(`/inventory/items/${id}/consume`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-management', 'items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-management', 'items', id] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['reports', 'batch-profitability'] });
      queryClient.invalidateQueries({ queryKey: ['reports', 'batch-inventory-consumption'] });
    },
  });
}

export function useSiteConsumptions(params: { siteId?: number; itemId?: number } = {}) {
  const queryString = buildQueryString(params);
  return useQuery({
    queryKey: ['inventory-management', 'site-consumptions', params],
    queryFn: () => apiGet<SiteConsumption[]>(`/inventory/site-consumptions${queryString ? `?${queryString}` : ''}`),
  });
}

export function useConsumeInventoryItemToSite(id: number | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { siteId: number; quantity: number; consumptionDate: string; notes?: string | null }) =>
      apiPost(`/inventory/items/${id}/consume-site`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-management', 'items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-management', 'items', id] });
      queryClient.invalidateQueries({ queryKey: ['inventory-management', 'site-consumptions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'exceptions'] });
    },
  });
}

export function useServiceWorkOrders(params: { status?: string; serviceType?: string; siteId?: number; batchId?: number } = {}) {
  const queryString = buildQueryString(params);
  return useQuery({
    queryKey: ['inventory-management', 'service-work-orders', params],
    queryFn: () => apiGet<ServiceWorkOrder[]>(`/inventory/service-work-orders${queryString ? `?${queryString}` : ''}`),
  });
}

export function useCreateServiceWorkOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost<ServiceWorkOrder>('/inventory/service-work-orders', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-management', 'service-work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'executive'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'exceptions'] });
    },
  });
}

export function useReviewServiceWorkOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { status: 'approved' | 'rejected'; approvalNotes?: string } }) =>
      apiPut<ServiceWorkOrder>(`/inventory/service-work-orders/${id}/review`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-management', 'service-work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'executive'] });
    },
  });
}

export function useSettleServiceWorkOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { financeAccountId: number; paymentMethod: 'cash' | 'cheque' | 'bank_transfer'; paymentDate?: string; referenceNumber?: string; chequeLeafId?: number | null } }) =>
      apiPut<ServiceWorkOrder>(`/inventory/service-work-orders/${id}/settle`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-management', 'service-work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-management', 'suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['treasury'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'executive'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'exceptions'] });
    },
  });
}

export function useInventoryPurchaseOrders(params: { page?: number; limit?: number; status?: string; supplierId?: number; search?: string } = {}) {
  const queryString = buildQueryString(params);
  return useQuery({
    queryKey: ['inventory-management', 'purchase-orders', params],
    queryFn: () => apiGet<InventoryPurchaseOrder[]>(`/inventory/purchase-orders${queryString ? `?${queryString}` : ''}`) as unknown as Promise<{
      data: InventoryPurchaseOrder[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>,
  });
}

export function useInventoryPurchaseOrder(id: number | undefined) {
  return useQuery({
    queryKey: ['inventory-management', 'purchase-orders', id],
    queryFn: () => apiGet<InventoryPurchaseOrderDetailResponse>(`/inventory/purchase-orders/${id}`) as unknown as Promise<{ data: InventoryPurchaseOrderDetailResponse }>,
    enabled: !!id,
  });
}

export function useCreateInventoryPurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost('/inventory/purchase-orders', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory-management', 'purchase-orders'] }),
  });
}

export function useUpdateInventoryPurchaseOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiPut(`/inventory/purchase-orders/${id}/status`, { status }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-management', 'purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-management', 'purchase-orders', variables.id] });
    },
  });
}

export function useReceiveInventoryPurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      id: number;
      items: Array<{
        itemId: number;
        receivedQuantity: number;
        expiryDate?: string | null;
        batchAllocations?: Array<{ batchId: number; quantity: number; notes?: string | null }>;
      }>;
      locationId?: number | null;
    }) => apiPost(`/inventory/purchase-orders/${data.id}/receive`, { items: data.items, locationId: data.locationId ?? null }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-management', 'purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-management', 'purchase-orders', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['inventory-management', 'items'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['reports', 'batch-profitability'] });
      queryClient.invalidateQueries({ queryKey: ['reports', 'batch-inventory-consumption'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}
