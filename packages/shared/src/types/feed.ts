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
  unit: string;
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
  performedBy?: number | null;
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

export interface PurchaseOrder {
  id: number;
  orderCode: string;
  supplierId: number;
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
