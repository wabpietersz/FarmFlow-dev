export enum FeedType {
  Starter = 'starter',
  Grower = 'grower',
  Finisher = 'finisher',
}

export interface Supplier {
  id: number;
  supplierName: string;
  contactPerson?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  address?: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeedRecipe {
  id: number;
  recipeName: string;
  feedType: FeedType;
  status: string;
  cost: number;
  calculatedCost?: number | null;
  version: number;
  parentRecipeId?: number | null;
  targetProtein?: number | null;
  targetEnergy?: number | null;
  targetFiber?: number | null;
  targetCalcium?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeedRecipeIngredient {
  id: number;
  recipeId: number;
  inventoryItemId?: number | null;
  supplierId?: number | null;
  ingredientName: string;
  proportion: number;
  unit: string;
}

export interface FeedInventory {
  id: number;
  ingredientName: string;
  supplierId?: number | null;
  supplierName?: string | null;
  quantity: number;
  unit: string;
  costPerUnit: number;
  reorderLevel?: number | null;
  lastRestockDate?: Date | null;
  lotCount?: number;
  lots?: InventoryLot[];
  createdAt: Date;
  updatedAt: Date;
}

// --- Feed Production ---

export enum FeedProductionStatus {
  Planned = 'planned',
  InProgress = 'in_progress',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

export interface FeedProductionBatch {
  id: number;
  productionCode: string;
  recipeId: number;
  plannedQuantity: number;
  actualQuantity?: number | null;
  unit: string;
  status: FeedProductionStatus;
  productionDate: Date;
  productionCost?: number | null;
  notes?: string | null;
  scheduledDate?: string | null;
  wasteQuantity?: number | null;
  wasteReason?: string | null;
  qcPassedAt?: Date | null;
  qcPassedBy?: number | null;
  qcNotes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeedProductionMaterial {
  id: number;
  productionBatchId: number;
  inventoryItemId: number;
  plannedQuantity: number;
  actualQuantity?: number | null;
  actualCost?: number | null;
  weightedCostPerUnit?: number | null;
  unit: string;
  lotDetails?: ProductionMaterialLotDetail[];
}

// --- Feed Distribution ---

export interface FeedDistribution {
  id: number;
  productionBatchId?: number | null;
  farmBatchId: number;
  feedType: FeedType;
  quantity: number;
  unit: string;
  distributionDate: Date;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// --- Request interfaces ---

export interface CreateFeedProductionRequest {
  recipeId: number;
  plannedQuantity: number;
  unit?: string;
  productionDate: string;
  notes?: string;
}

export interface CreateFeedDistributionRequest {
  productionBatchId?: number;
  farmBatchId: number;
  feedType: string;
  quantity: number;
  unit?: string;
  distributionDate: string;
  notes?: string;
}

// --- Inventory Alert interfaces ---

export interface InventoryAlert {
  id: number;
  inventoryItemId: number;
  ingredientName: string;
  currentQuantity: number;
  reorderLevel: number;
  suggestedOrderQuantity: number;
  supplierId?: number | null;
  supplierName?: string | null;
  status: 'active' | 'acknowledged' | 'resolved';
  createdAt: Date;
}

export interface InventoryAuditEntry {
  id: number;
  inventoryItemId: number;
  ingredientName: string;
  changeType: 'restock' | 'production_deduction' | 'adjustment' | 'distribution' | 'purchase_receive';
  previousQuantity: number;
  changeQuantity: number;
  newQuantity: number;
  referenceId?: number | null;
  referenceType?: string | null;
  notes?: string | null;
  lotId?: number | null;
  costAtTime?: number | null;
  performedBy?: number | null;
  createdAt: Date;
}

// --- Inventory Lot interfaces (FIFO Cost Tracking) ---

export interface InventoryLot {
  id: number;
  inventoryItemId: number;
  purchaseOrderItemId?: number | null;
  lotCode: string;
  receivedQuantity: number;
  remainingQuantity: number;
  costPerUnit: number;
  receivedDate: string;
  expiryDate?: string | null;
  notes?: string | null;
  poOrderCode?: string | null;
  supplierName?: string | null;
  createdAt: Date;
}

export interface ProductionMaterialLotDetail {
  id: number;
  productionMaterialId: number;
  inventoryLotId: number;
  lotCode: string;
  quantityUsed: number;
  costPerUnit: number;
  lineCost: number;
  poOrderCode?: string | null;
  supplierName?: string | null;
  receivedDate: string;
}

export interface ProductionCostSummary {
  totalMaterialCost: number;
  costPerOutputUnit: number;
  lotSourceCount: number;
}

export interface ProductionCostBreakdown {
  bySupplier: { supplierName: string; totalCost: number; percentage: number }[];
  byPurchaseOrder: { poOrderCode: string; supplierName: string; totalCost: number; percentage: number }[];
}

export interface LotConsumptionHistory {
  id: number;
  productionCode: string;
  productionDate: string;
  ingredientName: string;
  quantityUsed: number;
  costPerUnit: number;
  lineCost: number;
  createdAt: Date;
}

// --- Recipe optimization interfaces ---

export interface RecipeCostOptimization {
  recipeId: number;
  recipeName: string;
  currentCost: number;
  optimizedCost: number;
  savings: number;
  savingsPercent: number;
  suggestions: { ingredientName: string; currentProportion: number; suggestedProportion: number; reason: string }[];
}

// --- Purchase Order interfaces ---

export enum PurchaseOrderStatus {
  Draft = 'draft',
  Submitted = 'submitted',
  PartiallyReceived = 'partially_received',
  Received = 'received',
  Cancelled = 'cancelled',
}

export enum SupplierPaymentStatus {
  Pending = 'pending',
  Completed = 'completed',
  Bounced = 'bounced',
  Voided = 'voided',
}

export interface PurchaseOrder {
  id: number;
  orderCode: string;
  supplierId: number;
  contractId?: number | null;
  supplierName?: string;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  actualDeliveryDate?: string | null;
  status: PurchaseOrderStatus;
  totalCost: number;
  notes?: string | null;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PurchaseOrderItem {
  id: number;
  purchaseOrderId: number;
  inventoryItemId: number;
  ingredientName?: string;
  orderedQuantity: number;
  unitPrice: number;
  receivedQuantity: number;
  unit: string;
  notes?: string | null;
}

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
  amount: number;
  paymentStatus: SupplierPaymentStatus | string;
  referenceNumber?: string | null;
  chequeLeafId?: number | null;
  chequeNumber?: string | null;
  chequeDate?: string | null;
  bankName?: string | null;
  treasuryTransactionId?: number | null;
  treasuryReversalTransactionId?: number | null;
  notes?: string | null;
  recordedBy?: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface SupplierContract {
  id: number;
  contractCode: string;
  supplierId: number;
  supplierName?: string | null;
  contractType: 'supplier' | 'service' | 'customer' | string;
  contractTitle: string;
  description?: string | null;
  status: 'draft' | 'active' | 'expired' | 'suspended' | string;
  validFrom: string;
  validTo?: string | null;
  currencyCode: string;
  paymentTermsDays: number;
  commercialTerms?: string | null;
  rateTable?: Record<string, unknown>;
  attachmentUrls?: string[];
  alertDaysBeforeExpiry: number;
  createdBy: number;
  approvedBy?: number | null;
  approvedAt?: string | Date | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  terms?: SupplierContractTerm[];
}

export interface SupplierContractTerm {
  id: number;
  contractId: number;
  termType: string;
  termKey: string;
  termValue: string;
  sortOrder: number;
  createdAt: Date | string;
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
  invoiceAmount: number;
  paidAmount?: number;
  balanceDue?: number;
  currencyCode: string;
  status: 'recorded' | 'cancelled' | string;
  notes?: string | null;
  createdBy: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface SupplierPayableSummary {
  supplierId: number;
  supplierName: string;
  purchaseOrderId?: number | null;
  purchaseOrderCode?: string | null;
  invoiceId?: number | null;
  invoiceCode?: string | null;
  invoiceReference?: string | null;
  orderedAmount: number;
  receivedAmount: number;
  invoicedAmount: number;
  paidAmount: number;
  balanceDue: number;
  dueDate?: string | null;
  paymentStatus: 'unpaid' | 'partially_paid' | 'paid';
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
  inventoryLotId?: number | null;
  purchaseOrderId?: number | null;
  purchaseOrderItemId?: number | null;
  productionBatchId?: number | null;
  productionMaterialId?: number | null;
  feedDistributionId?: number | null;
  batchId?: number | null;
  quantity: number;
  unit: string;
  unitCost?: number | null;
  lineCost?: number | null;
  balanceAfterQuantity?: number | null;
  balanceScope: string;
  notes?: string | null;
  createdBy?: number | null;
  createdAt: Date | string;
}

// --- Report scheduling interfaces ---

export interface ReportSchedule {
  id: number;
  reportType: string;
  scheduleName: string;
  cronExpression: string;
  filters: Record<string, unknown>;
  recipientEmails: string[];
  isActive: boolean;
  lastRunAt?: Date | null;
  nextRunAt?: Date | null;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}
