import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import {
  useSuppliers,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  useRecipes,
  useRecipe,
  useCreateRecipe,
  useUpdateRecipe,
  useToggleRecipeStatus,
  useDeleteRecipe,
  useInventory,
  useCreateInventory,
  useUpdateInventory,
  useRestockInventory,
  useProductions,
  useProduction,
  useCreateProduction,
  useCompleteProduction,
  useDeleteProduction,
  useDistributions,
  useCreateDistribution,
  useDeleteDistribution,
  usePurchaseOrders,
  useCreatePurchaseOrder,
  useDeletePurchaseOrder,
  useUpdatePurchaseOrderStatus,
  useReceivePurchaseOrder,
  usePurchaseOrder,
  useInventoryLots,
  useProductionCostBreakdown,
  useLotConsumptionHistory,
} from '@/hooks/useFeed';
import { useBatches } from '@/hooks/useBatches';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  FlaskConical,
  Warehouse,
  RefreshCw,
  AlertTriangle,
  Factory,
  Truck,
  Play,
  CheckCircle,
  XCircle,
  ShoppingCart,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiPut, parseApiError } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import type { FeedType } from '@farmflow/shared';

// --- Types ---

interface SupplierForm {
  supplierName: string;
  contactPerson: string;
  phoneNumber: string;
  email: string;
  address: string;
}

interface RecipeIngredient {
  inventoryItemId: string;
  proportion: string;
  unit: string;
}

interface RecipeForm {
  recipeName: string;
  feedType: string;
  cost: string;
  status: string;
  ingredients: RecipeIngredient[];
}

interface InventoryForm {
  ingredientName: string;
  supplierId: string;
  quantity: string;
  unit: string;
  costPerUnit: string;
  reorderLevel: string;
}

// --- Constants ---

const FEED_TYPE_COLORS: Record<string, string> = {
  starter: 'bg-blue-100 text-blue-800',
  grower: 'bg-green-100 text-green-800',
  finisher: 'bg-orange-100 text-orange-800',
};

const SUPPLIER_STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
};

const EMPTY_SUPPLIER_FORM: SupplierForm = {
  supplierName: '',
  contactPerson: '',
  phoneNumber: '',
  email: '',
  address: '',
};

const EMPTY_RECIPE_FORM: RecipeForm = {
  recipeName: '',
  feedType: '',
  cost: '',
  status: 'active',
  ingredients: [{ inventoryItemId: '', proportion: '', unit: 'kg' }],
};

const EMPTY_INVENTORY_FORM: InventoryForm = {
  ingredientName: '',
  supplierId: '',
  quantity: '',
  unit: 'kg',
  costPerUnit: '',
  reorderLevel: '',
};

interface ProductionForm {
  recipeId: string;
  plannedQuantity: string;
  unit: string;
  productionDate: string;
  notes: string;
}

interface DistributionForm {
  productionBatchId: string;
  farmBatchId: string;
  feedType: string;
  quantity: string;
  unit: string;
  distributionDate: string;
  notes: string;
}

const PRODUCTION_STATUS_COLORS: Record<string, string> = {
  planned: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const EMPTY_PRODUCTION_FORM: ProductionForm = {
  recipeId: '',
  plannedQuantity: '',
  unit: 'kg',
  productionDate: new Date().toISOString().split('T')[0],
  notes: '',
};

const EMPTY_DISTRIBUTION_FORM: DistributionForm = {
  productionBatchId: '',
  farmBatchId: '',
  feedType: '',
  quantity: '',
  unit: 'kg',
  distributionDate: new Date().toISOString().split('T')[0],
  notes: '',
};

function formatQuantity(value: number, maxFractionDigits = 2) {
  const normalized = Number.isFinite(value) ? value : 0;
  return normalized.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: maxFractionDigits });
}

// --- Helper Component ---

function ReceivePOContent(
  {
    poId,
    onClose,
    receivePOMutation,
    inventoryById,
  }: {
    poId: number;
    onClose: () => void;
    receivePOMutation: ReturnType<typeof useReceivePurchaseOrder>;
    inventoryById: Map<number, { quantity: number | string; unit: string }>;
  },
) {
  const { data: poDetailData } = usePurchaseOrder(poId);
  const poDetail = poDetailData as unknown as {
    data?: {
      purchaseOrder: { orderCode: string; status: string };
      items: {
        id: number;
        inventoryItemId: number;
        ingredientName?: string;
        orderedQuantity: string;
        receivedQuantity: string;
        unit: string;
      }[];
    };
  };
  const items = poDetail?.data?.items ?? [];
  const [receiveAmounts, setReceiveAmounts] = useState<Record<number, string>>({});

  const handleReceive = async () => {
    const receiveItems = [];
    for (const item of items) {
      const receiveNow = Number(receiveAmounts[item.id] || 0);
      if (!receiveNow || receiveNow <= 0) continue;
      const remaining = Number(item.orderedQuantity) - Number(item.receivedQuantity);
      if (receiveNow > remaining) {
        toast.error(`Received quantity for ${item.ingredientName ?? `Item #${item.id}`} exceeds remaining amount`);
        return;
      }
      receiveItems.push({
        itemId: item.id,
        receivedQuantity: receiveNow,
      });
    }

    if (receiveItems.length === 0) {
      toast.error('Enter at least one received quantity');
      return;
    }

    try {
      await receivePOMutation.mutateAsync({ id: poId, items: receiveItems });
      toast.success('Items received and inventory updated');
      onClose();
    } catch (error) {
      parseApiError(error, 'Failed to receive items');
    }
  };

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading items...</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">PO: {poDetail?.data?.purchaseOrder?.orderCode}</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Ordered</TableHead>
                <TableHead className="text-right">Already Rcvd</TableHead>
                <TableHead className="text-right">Receive Now</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const remaining = Number(item.orderedQuantity) - Number(item.receivedQuantity);
                const receiveNow = Number(receiveAmounts[item.id] || 0);
                const projectedReceived = Number(item.receivedQuantity) + receiveNow;
                const projectedRemaining = Number(item.orderedQuantity) - projectedReceived;
                const inventoryItem = inventoryById.get(item.inventoryItemId);
                const currentStock = inventoryItem ? Number(inventoryItem.quantity) : null;
                const projectedStock = currentStock != null ? currentStock + receiveNow : null;
                const unit = inventoryItem?.unit ?? item.unit;
                return (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm">{item.ingredientName ?? `Item #${item.id}`}</TableCell>
                    <TableCell className="text-right text-sm">{formatQuantity(Number(item.orderedQuantity))} {item.unit}</TableCell>
                    <TableCell className="text-right text-sm">{formatQuantity(Number(item.receivedQuantity))} {item.unit}</TableCell>
                    <TableCell className="text-right">
                      {remaining > 0 ? (
                        <div className="space-y-1">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max={remaining}
                            placeholder="0"
                            className="w-24 ml-auto text-right"
                            value={receiveAmounts[item.id] || ''}
                            onChange={(e) => setReceiveAmounts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          />
                          {receiveNow > 0 && (
                            <div className="text-[11px] text-muted-foreground text-right">
                              Received: {formatQuantity(Number(item.receivedQuantity))}{' -> '}{formatQuantity(projectedReceived)} {item.unit}
                              {projectedRemaining >= 0 ? ` (remaining ${formatQuantity(projectedRemaining)})` : ''}
                            </div>
                          )}
                          {receiveNow > 0 && currentStock != null && projectedStock != null && (
                            <div className="text-[11px] text-green-700 text-right">
                              Stock: {formatQuantity(currentStock)}{' -> '}{formatQuantity(projectedStock)} {unit}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-green-600">Fully received</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleReceive} disabled={receivePOMutation.isPending}>
          {receivePOMutation.isPending ? 'Receiving...' : 'Confirm Receipt'}
        </Button>
      </DialogFooter>
    </div>
  );
}

// --- Component ---

export default function FeedPage() {
  const { hasPermission } = useAuthStore();
  const queryClient = useQueryClient();

  // =====================
  // SUPPLIERS STATE
  // =====================
  const [suppliersPage, setSuppliersPage] = useState(1);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierStatusFilter, setSupplierStatusFilter] = useState('');
  const [showSupplierDialog, setShowSupplierDialog] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<{ id: number } | null>(null);
  const [supplierForm, setSupplierForm] = useState<SupplierForm>(EMPTY_SUPPLIER_FORM);
  const [showDeleteSupplierConfirm, setShowDeleteSupplierConfirm] = useState<number | null>(null);

  // =====================
  // RECIPES STATE
  // =====================
  const [recipesPage, setRecipesPage] = useState(1);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [recipeFeedTypeFilter, setRecipeFeedTypeFilter] = useState('');
  const [showRecipeDialog, setShowRecipeDialog] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<{ id: number } | null>(null);
  const [recipeForm, setRecipeForm] = useState<RecipeForm>(EMPTY_RECIPE_FORM);
  const [showDeleteRecipeConfirm, setShowDeleteRecipeConfirm] = useState<number | null>(null);
  const [viewingRecipe, setViewingRecipe] = useState<{
    id: number;
    recipeName: string;
    feedType: string;
    cost: string;
    status: string;
    ingredientSummary?: string;
    ingredients?: any[];
  } | null>(null);

  // =====================
  // INVENTORY STATE
  // =====================
  const [inventoryPage, setInventoryPage] = useState(1);
  const [inventorySearch, setInventorySearch] = useState('');
  const [showInventoryDialog, setShowInventoryDialog] = useState(false);
  const [editingInventory, setEditingInventory] = useState<{ id: number } | null>(null);
  const [inventoryForm, setInventoryForm] = useState<InventoryForm>(EMPTY_INVENTORY_FORM);
  const [showRestockDialog, setShowRestockDialog] = useState<number | null>(null);
  const [restockQuantity, setRestockQuantity] = useState('');
  const [showLotsDialog, setShowLotsDialog] = useState<number | null>(null);
  const [showLotHistoryDialog, setShowLotHistoryDialog] = useState<number | null>(null);
  const [showCostBreakdownDialog, setShowCostBreakdownDialog] = useState<number | null>(null);

  // =====================
  // PRODUCTION STATE
  // =====================
  const [productionsPage, setProductionsPage] = useState(1);
  const [productionStatusFilter, setProductionStatusFilter] = useState('');
  const [showProductionDialog, setShowProductionDialog] = useState(false);
  const [productionForm, setProductionForm] = useState<ProductionForm>(EMPTY_PRODUCTION_FORM);
  const [showCompleteDialog, setShowCompleteDialog] = useState<number | null>(null);
  const [completeActualQty, setCompleteActualQty] = useState('');
  const [showDeleteProductionConfirm, setShowDeleteProductionConfirm] = useState<number | null>(null);

  // =====================
  // DISTRIBUTION STATE
  // =====================
  const [distributionsPage, setDistributionsPage] = useState(1);
  const [distributionFeedTypeFilter, setDistributionFeedTypeFilter] = useState('');
  const [showDistributionDialog, setShowDistributionDialog] = useState(false);
  const [distributionForm, setDistributionForm] = useState<DistributionForm>(EMPTY_DISTRIBUTION_FORM);
  const [showDeleteDistributionConfirm, setShowDeleteDistributionConfirm] = useState<number | null>(null);

  // =====================
  // PURCHASE ORDERS STATE
  // =====================
  const [poPage, setPoPage] = useState(1);
  const [poStatusFilter, setPoStatusFilter] = useState('');
  const [poSearch, setPoSearch] = useState('');
  const [showPoDialog, setShowPoDialog] = useState(false);
  const [poForm, setPoForm] = useState<{
    supplierId: string;
    orderDate: string;
    expectedDeliveryDate: string;
    notes: string;
    items: { inventoryItemId: string; orderedQuantity: string; unitPrice: string; unit: string }[];
  }>({
    supplierId: '',
    orderDate: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: '',
    notes: '',
    items: [{ inventoryItemId: '', orderedQuantity: '', unitPrice: '', unit: 'kg' }],
  });
  const [showPoDetail, setShowPoDetail] = useState<number | null>(null);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);

  // =====================
  // DATA HOOKS
  // =====================
  const { data: suppliersData, isLoading: suppliersLoading } = useSuppliers({
    page: suppliersPage,
    limit: 20,
    search: supplierSearch || undefined,
    status: supplierStatusFilter || undefined,
  });
  const { data: recipesData, isLoading: recipesLoading } = useRecipes({
    page: recipesPage,
    limit: 20,
    search: recipeSearch || undefined,
    feedType: recipeFeedTypeFilter || undefined,
  });
  const { data: inventoryData, isLoading: inventoryLoading } = useInventory({
    page: inventoryPage,
    limit: 20,
    search: inventorySearch || undefined,
  });
  const { data: inventoryLookupData } = useInventory({ page: 1, limit: 500 });

  const createSupplierMutation = useCreateSupplier();
  const updateSupplierMutation = useUpdateSupplier(editingSupplier ? String(editingSupplier.id) : '0');
  const deleteSupplierMutation = useDeleteSupplier();

  const { data: recipeDetailData, isLoading: recipeDetailLoading } = useRecipe(
    editingRecipe ? String(editingRecipe.id) : viewingRecipe ? String(viewingRecipe.id) : undefined,
  );
  const createRecipeMutation = useCreateRecipe();
  const updateRecipeMutation = useUpdateRecipe(editingRecipe ? String(editingRecipe.id) : '0');
  const toggleRecipeStatusMutation = useToggleRecipeStatus();
  const deleteRecipeMutation = useDeleteRecipe();

  const createInventoryMutation = useCreateInventory();
  const updateInventoryMutation = useUpdateInventory(editingInventory ? String(editingInventory.id) : '0');
  const restockInventoryMutation = useRestockInventory();

  // Lot hooks (FIFO)
  const { data: lotsData, isLoading: lotsLoading } = useInventoryLots(showLotsDialog ?? undefined, true);
  const { data: costBreakdownData, isLoading: costBreakdownLoading } = useProductionCostBreakdown(showCostBreakdownDialog ?? undefined);
  const { data: lotHistoryData, isLoading: lotHistoryLoading } = useLotConsumptionHistory(showLotHistoryDialog ?? undefined);

  // Production hooks
  const { data: productionsData, isLoading: productionsLoading } = useProductions({
    page: productionsPage,
    limit: 20,
    status: productionStatusFilter || undefined,
  });
  const { data: activeRecipesData } = useRecipes({ page: 1, limit: 100, status: 'active' });
  const { data: completionDetailData } = useProduction(showCompleteDialog ? String(showCompleteDialog) : undefined);

  const createProductionMutation = useCreateProduction();
  const completeProductionMutation = useCompleteProduction(showCompleteDialog ? String(showCompleteDialog) : '0');
  const deleteProductionMutation = useDeleteProduction();

  // Distribution hooks
  const { data: distributionsData, isLoading: distributionsLoading } = useDistributions({
    page: distributionsPage,
    limit: 20,
    feedType: distributionFeedTypeFilter || undefined,
  });
  const { data: completedProductionsData } = useProductions({ page: 1, limit: 100, status: 'completed' });
  const { data: distributionProductionDetailData } = useProduction(distributionForm.productionBatchId ? distributionForm.productionBatchId : undefined);
  const { data: batchesData } = useBatches({ page: 1, limit: 100 });

  const createDistributionMutation = useCreateDistribution();
  const deleteDistributionMutation = useDeleteDistribution();

  // Purchase Orders
  const { data: poData, isLoading: poLoading } = usePurchaseOrders({
    page: poPage,
    limit: 20,
    status: poStatusFilter || undefined,
    search: poSearch || undefined,
  });
  const poList = ((poData as unknown as { data: unknown[] })?.data || []) as { id: number; orderCode: string; supplierName?: string; orderDate: string; status: string; totalCost: string | number }[];
  const poTotal = (poData as unknown as { totalPages: number })?.totalPages || 1;

  const createPO = useCreatePurchaseOrder();
  const deletePO = useDeletePurchaseOrder();
  const updatePOStatusMutation = useUpdatePurchaseOrderStatus();
  const receivePOMutation = useReceivePurchaseOrder();

  // Derived data
  const suppliersList = suppliersData?.data ?? [];
  const suppliersTotalPages = suppliersData?.totalPages ?? 0;
  const suppliersTotal = suppliersData?.total ?? 0;

  const recipesList = recipesData?.data ?? [];
  const recipesTotalPages = recipesData?.totalPages ?? 0;
  const recipesTotal = recipesData?.total ?? 0;

  const inventoryList = inventoryData?.data ?? [];
  const inventoryLookupList = inventoryLookupData?.data ?? [];
  const inventoryTotalPages = inventoryData?.totalPages ?? 0;
  const inventoryTotal = inventoryData?.total ?? 0;

  const productionsList = productionsData?.data ?? [];
  const productionsTotalPages = productionsData?.totalPages ?? 0;
  const productionsTotal = productionsData?.total ?? 0;

  const distributionsList = distributionsData?.data ?? [];
  const distributionsTotalPages = distributionsData?.totalPages ?? 0;
  const distributionsTotal = distributionsData?.total ?? 0;

  const activeRecipes = activeRecipesData?.data ?? [];
  const completedProductions = completedProductionsData?.data ?? [];
  const farmBatches = batchesData?.data ?? [];
  const completionDetail = (completionDetailData as unknown as {
    data?: {
      materials?: {
        inventoryItemId: number;
        ingredientName?: string;
        plannedQuantity: string;
        actualQuantity?: string | null;
        unit: string;
        availableQuantity?: string;
        costPerUnit?: string;
      }[];
    };
  })?.data;
  const distributionProductionDetail = (distributionProductionDetailData as unknown as {
    data?: {
      production?: { productionCode?: string; actualQuantity?: string | number | null; unit?: string };
      totalDistributed?: number;
      availableForDistribution?: number;
    };
  })?.data;

  const inventoryById = new Map(
    inventoryLookupList.map((item) => [
      item.id,
      { quantity: item.quantity, unit: item.unit },
    ]),
  );

  const editingInventoryItem = editingInventory ? inventoryById.get(editingInventory.id) : null;
  const editedQuantity = inventoryForm.quantity !== '' ? Number(inventoryForm.quantity) : null;
  const currentEditQuantity = editingInventoryItem ? Number(editingInventoryItem.quantity) : null;
  const editQuantityDelta = editedQuantity != null && currentEditQuantity != null
    ? editedQuantity - currentEditQuantity
    : null;

  const restockItem = showRestockDialog ? inventoryById.get(showRestockDialog) : null;
  const restockAmount = restockQuantity !== '' ? Number(restockQuantity) : 0;
  const restockCurrentQuantity = restockItem ? Number(restockItem.quantity) : null;
  const restockAfterQuantity = restockCurrentQuantity != null ? restockCurrentQuantity + restockAmount : null;

  const distributionQuantity = distributionForm.quantity !== '' ? Number(distributionForm.quantity) : 0;
  const distributionAvailableBefore = distributionProductionDetail?.availableForDistribution != null
    ? Number(distributionProductionDetail.availableForDistribution)
    : null;
  const distributionAvailableAfter = distributionAvailableBefore != null
    ? distributionAvailableBefore - distributionQuantity
    : null;

  // =====================
  // SUPPLIER HANDLERS
  // =====================
  const handleOpenCreateSupplier = () => {
    setEditingSupplier(null);
    setSupplierForm(EMPTY_SUPPLIER_FORM);
    setShowSupplierDialog(true);
  };

  const handleOpenEditSupplier = (supplier: {
    id: number;
    supplierName: string;
    contactPerson?: string | null;
    phoneNumber?: string | null;
    email?: string | null;
    address?: string | null;
  }) => {
    setEditingSupplier({ id: supplier.id });
    setSupplierForm({
      supplierName: supplier.supplierName,
      contactPerson: supplier.contactPerson ?? '',
      phoneNumber: supplier.phoneNumber ?? '',
      email: supplier.email ?? '',
      address: supplier.address ?? '',
    });
    setShowSupplierDialog(true);
  };

  const handleSaveSupplier = async () => {
    if (!supplierForm.supplierName.trim()) {
      toast.error('Supplier name is required');
      return;
    }
    try {
      const payload = {
        supplierName: supplierForm.supplierName,
        contactPerson: supplierForm.contactPerson || null,
        phoneNumber: supplierForm.phoneNumber || null,
        email: supplierForm.email || null,
        address: supplierForm.address || null,
      };
      if (editingSupplier) {
        await updateSupplierMutation.mutateAsync(payload);
        toast.success('Supplier updated successfully');
      } else {
        await createSupplierMutation.mutateAsync(payload);
        toast.success('Supplier created successfully');
      }
      setShowSupplierDialog(false);
      setEditingSupplier(null);
      setSupplierForm(EMPTY_SUPPLIER_FORM);
    } catch (error) {
      parseApiError(error, editingSupplier ? 'Failed to update supplier' : 'Failed to create supplier');
    }
  };

  const handleDeleteSupplier = async (id: number) => {
    try {
      await deleteSupplierMutation.mutateAsync(id);
      toast.success('Supplier deactivated');
      setShowDeleteSupplierConfirm(null);
    } catch (error) {
      parseApiError(error, 'Failed to deactivate supplier');
    }
  };

  // =====================
  // RECIPE HANDLERS
  // =====================
  const handleOpenCreateRecipe = () => {
    setEditingRecipe(null);
    setRecipeForm(EMPTY_RECIPE_FORM);
    setShowRecipeDialog(true);
  };

  // Track which recipe detail we've already loaded ingredients for
  const loadedRecipeDetailIdRef = useRef<number | null>(null);

  const handleOpenEditRecipe = (recipe: {
    id: number;
    recipeName: string;
    feedType: string;
    cost?: number | string | null;
  }) => {
    loadedRecipeDetailIdRef.current = null; // reset so useEffect will re-populate
    setEditingRecipe({ id: recipe.id });
    // Set basic fields immediately; ingredients will be loaded from detail query via useEffect
    setRecipeForm({
      recipeName: recipe.recipeName,
      feedType: recipe.feedType,
      cost: recipe.cost != null ? String(recipe.cost) : '',
      status: (recipe as any).status ?? 'active',
      ingredients: [{ inventoryItemId: '', proportion: '', unit: 'kg' }],
    });
    setShowRecipeDialog(true);
  };

  // When recipe detail loads, populate ingredients into the form
  const recipeDetailForEdit = (recipeDetailData as unknown as { data?: { recipe?: Record<string, unknown>; ingredients?: { inventoryItemId?: number | null; proportion?: string; unit?: string }[] } })?.data;

  useEffect(() => {
    if (
      editingRecipe &&
      recipeDetailForEdit?.ingredients &&
      loadedRecipeDetailIdRef.current !== editingRecipe.id
    ) {
      loadedRecipeDetailIdRef.current = editingRecipe.id;
      const loadedIngredients = recipeDetailForEdit.ingredients
        .filter((ing: { inventoryItemId?: number | null }) => ing.inventoryItemId != null)
        .map((ing: { inventoryItemId?: number | null; proportion?: string; unit?: string }) => ({
          inventoryItemId: String(ing.inventoryItemId ?? ''),
          proportion: String(ing.proportion ?? ''),
          unit: ing.unit ?? 'kg',
        }));
      if (loadedIngredients.length > 0) {
        setRecipeForm((prev) => ({
          ...prev,
          ingredients: loadedIngredients,
        }));
      }
    }
  }, [editingRecipe, recipeDetailForEdit]);

  const handleAddIngredient = () => {
    setRecipeForm((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, { inventoryItemId: '', proportion: '', unit: 'kg' }],
    }));
  };

  const handleRemoveIngredient = (index: number) => {
    setRecipeForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }));
  };

  const handleIngredientChange = (index: number, field: keyof RecipeIngredient, value: string) => {
    setRecipeForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ing, i) =>
        i === index ? { ...ing, [field]: value } : ing,
      ),
    }));
  };

  const handleSaveRecipe = async () => {
    if (!recipeForm.recipeName.trim()) {
      toast.error('Recipe name is required');
      return;
    }
    if (!recipeForm.feedType) {
      toast.error('Feed type is required');
      return;
    }
    try {
      const payload = {
        recipeName: recipeForm.recipeName,
        feedType: recipeForm.feedType as FeedType,
        cost: recipeForm.cost ? Number(recipeForm.cost) : 0,
        ingredients: recipeForm.ingredients
          .filter((ing) => ing.inventoryItemId)
          .map((ing) => ({
            inventoryItemId: Number(ing.inventoryItemId),
            proportion: Number(ing.proportion),
            unit: ing.unit,
          })),
      };
      if (editingRecipe) {
        await updateRecipeMutation.mutateAsync({ ...payload, status: recipeForm.status });
        toast.success('Recipe updated successfully');
      } else {
        await createRecipeMutation.mutateAsync(payload);
        toast.success('Recipe created successfully');
      }
      setShowRecipeDialog(false);
      setEditingRecipe(null);
      setRecipeForm(EMPTY_RECIPE_FORM);
    } catch (error) {
      parseApiError(error, editingRecipe ? 'Failed to update recipe' : 'Failed to create recipe');
    }
  };

  const handleDeleteRecipe = async (id: number) => {
    try {
      await deleteRecipeMutation.mutateAsync(id);
      toast.success('Recipe permanently deleted');
      setShowDeleteRecipeConfirm(null);
    } catch (error) {
      parseApiError(error, 'Failed to delete recipe');
    }
  };

  const handleToggleRecipeStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await toggleRecipeStatusMutation.mutateAsync({ id, status: newStatus as 'active' | 'inactive' });
      toast.success(`Recipe ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
    } catch (error) {
      parseApiError(error, 'Failed to update recipe status');
    }
  };

  // =====================
  // INVENTORY HANDLERS
  // =====================
  const handleOpenCreateInventory = () => {
    setEditingInventory(null);
    setInventoryForm(EMPTY_INVENTORY_FORM);
    setShowInventoryDialog(true);
  };

  const handleOpenEditInventory = (item: {
    id: number;
    ingredientName: string;
    quantity: number | string;
    unit: string;
    costPerUnit?: number | string | null;
    reorderLevel?: number | string | null;
    supplierId?: number | null;
  }) => {
    setEditingInventory({ id: item.id });
    setInventoryForm({
      ingredientName: item.ingredientName,
      supplierId: item.supplierId != null ? String(item.supplierId) : '',
      quantity: String(item.quantity),
      unit: item.unit,
      costPerUnit: item.costPerUnit != null ? String(item.costPerUnit) : '',
      reorderLevel: item.reorderLevel != null ? String(item.reorderLevel) : '',
    });
    setShowInventoryDialog(true);
  };

  const handleSaveInventory = async () => {
    if (!inventoryForm.ingredientName.trim()) {
      toast.error('Ingredient name is required');
      return;
    }
    if (!inventoryForm.supplierId) {
      toast.error('Supplier is required');
      return;
    }
    try {
      const payload = {
        ingredientName: inventoryForm.ingredientName,
        supplierId: Number(inventoryForm.supplierId),
        quantity: Number(inventoryForm.quantity) || 0,
        unit: inventoryForm.unit,
        costPerUnit: inventoryForm.costPerUnit ? Number(inventoryForm.costPerUnit) : 0,
        reorderLevel: inventoryForm.reorderLevel ? Number(inventoryForm.reorderLevel) : null,
      };
      if (editingInventory) {
        await updateInventoryMutation.mutateAsync(payload);
        toast.success('Inventory item updated');
      } else {
        await createInventoryMutation.mutateAsync(payload);
        toast.success('Inventory item created');
      }
      setShowInventoryDialog(false);
      setEditingInventory(null);
      setInventoryForm(EMPTY_INVENTORY_FORM);
    } catch (error) {
      parseApiError(error, editingInventory ? 'Failed to update inventory item' : 'Failed to create inventory item');
    }
  };

  const handleRestock = async () => {
    if (!showRestockDialog || !restockQuantity) return;
    try {
      await restockInventoryMutation.mutateAsync({
        id: showRestockDialog,
        quantity: Number(restockQuantity),
      });
      toast.success('Inventory restocked successfully');
      setShowRestockDialog(null);
      setRestockQuantity('');
    } catch (error) {
      parseApiError(error, 'Failed to restock inventory');
    }
  };

  // =====================
  // PRODUCTION HANDLERS
  // =====================
  const handleOpenCreateProduction = () => {
    setProductionForm(EMPTY_PRODUCTION_FORM);
    setShowProductionDialog(true);
  };

  const handleSaveProduction = async () => {
    if (!productionForm.recipeId) {
      toast.error('Please select a recipe');
      return;
    }
    if (!productionForm.plannedQuantity || Number(productionForm.plannedQuantity) <= 0) {
      toast.error('Planned quantity must be positive');
      return;
    }
    try {
      await createProductionMutation.mutateAsync({
        recipeId: Number(productionForm.recipeId),
        plannedQuantity: Number(productionForm.plannedQuantity),
        unit: productionForm.unit,
        productionDate: productionForm.productionDate,
        notes: productionForm.notes || undefined,
      });
      toast.success('Production batch created');
      setShowProductionDialog(false);
      setProductionForm(EMPTY_PRODUCTION_FORM);
    } catch (error) {
      parseApiError(error, 'Failed to create production batch');
    }
  };

  const handleStartProduction = async (id: number) => {
    try {
      await apiPut(`/feed/production/${id}/status`, { status: 'in_progress' });
      toast.success('Production started');
      queryClient.invalidateQueries({ queryKey: ['productions'] });
      queryClient.invalidateQueries({ queryKey: ['production-summary'] });
    } catch (error) {
      parseApiError(error, 'Failed to start production');
    }
  };

  const handleCancelProduction = async (id: number) => {
    try {
      await apiPut(`/feed/production/${id}/status`, { status: 'cancelled' });
      toast.success('Production cancelled');
      queryClient.invalidateQueries({ queryKey: ['productions'] });
      queryClient.invalidateQueries({ queryKey: ['production-summary'] });
    } catch (error) {
      parseApiError(error, 'Failed to cancel production');
    }
  };

  const handleOpenComplete = (id: number) => {
    setShowCompleteDialog(id);
    setCompleteActualQty('');
  };

  const handleCompleteProduction = async () => {
    if (!showCompleteDialog || !completeActualQty) return;
    const materials = completionDetail?.materials?.map((m) => ({
      inventoryItemId: m.inventoryItemId,
      actualQuantity: Number(m.plannedQuantity), // Default to planned, user can adjust
    })) ?? [];

    if (materials.length === 0) {
      toast.error('No materials found for this production batch');
      return;
    }

    try {
      await completeProductionMutation.mutateAsync({
        actualQuantity: Number(completeActualQty),
        materials,
      });
      toast.success('Production completed successfully');
      setShowCompleteDialog(null);
      setCompleteActualQty('');
    } catch (error) {
      parseApiError(error, 'Failed to complete production — check inventory availability');
    }
  };

  const handleDeleteProduction = async (id: number) => {
    try {
      await deleteProductionMutation.mutateAsync(id);
      toast.success('Production batch deleted');
      setShowDeleteProductionConfirm(null);
    } catch (error) {
      parseApiError(error, 'Failed to delete production batch');
    }
  };

  // =====================
  // DISTRIBUTION HANDLERS
  // =====================
  const handleOpenCreateDistribution = () => {
    setDistributionForm(EMPTY_DISTRIBUTION_FORM);
    setShowDistributionDialog(true);
  };

  const handleSaveDistribution = async () => {
    if (!distributionForm.farmBatchId) {
      toast.error('Please select a farm batch');
      return;
    }
    if (!distributionForm.feedType) {
      toast.error('Please select a feed type');
      return;
    }
    if (!distributionForm.quantity || Number(distributionForm.quantity) <= 0) {
      toast.error('Quantity must be positive');
      return;
    }
    try {
      await createDistributionMutation.mutateAsync({
        productionBatchId: distributionForm.productionBatchId ? Number(distributionForm.productionBatchId) : null,
        farmBatchId: Number(distributionForm.farmBatchId),
        feedType: distributionForm.feedType,
        quantity: Number(distributionForm.quantity),
        unit: distributionForm.unit,
        distributionDate: distributionForm.distributionDate,
        notes: distributionForm.notes || undefined,
      });
      toast.success('Distribution recorded');
      setShowDistributionDialog(false);
      setDistributionForm(EMPTY_DISTRIBUTION_FORM);
    } catch (error) {
      parseApiError(error, 'Failed to create distribution');
    }
  };

  const handleDeleteDistribution = async (id: number) => {
    try {
      await deleteDistributionMutation.mutateAsync(id);
      toast.success('Distribution deleted');
      setShowDeleteDistributionConfirm(null);
    } catch (error) {
      parseApiError(error, 'Failed to delete distribution');
    }
  };

  // =====================
  // RENDER
  // =====================
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Feed Management</h1>
      </div>

      <Tabs defaultValue="inventory">
        <TabsList>
          <TabsTrigger value="inventory" className="gap-2">
            <Warehouse className="h-4 w-4" />
            Inventory
          </TabsTrigger>
          <TabsTrigger value="recipes" className="gap-2">
            <FlaskConical className="h-4 w-4" />
            Recipes
          </TabsTrigger>
          <TabsTrigger value="production" className="gap-2">
            <Factory className="h-4 w-4" />
            Production
          </TabsTrigger>
          <TabsTrigger value="distribution" className="gap-2">
            <Truck className="h-4 w-4" />
            Distribution
          </TabsTrigger>
        </TabsList>

        {/* ========================= */}
        {/* SUPPLIERS TAB             */}
        {/* ========================= */}
        <TabsContent value="suppliers">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <Input
                  placeholder="Search suppliers..."
                  value={supplierSearch}
                  onChange={(e) => {
                    setSupplierSearch(e.target.value);
                    setSuppliersPage(1);
                  }}
                  className="w-[250px]"
                />
                <Select
                  value={supplierStatusFilter || 'all'}
                  onValueChange={(v) => {
                    setSupplierStatusFilter(v === 'all' ? '' : v);
                    setSuppliersPage(1);
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <div className="sm:ml-auto">
                  {hasPermission('feed_inventory:create') && (
                    <Button onClick={handleOpenCreateSupplier}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Supplier
                    </Button>
                  )}
                </div>
              </div>

              {suppliersLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : suppliersList.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-1">No suppliers found</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {supplierSearch || supplierStatusFilter
                      ? 'Try adjusting your filters.'
                      : 'Add your first feed supplier to get started.'}
                  </p>
                  {hasPermission('feed_inventory:create') && !supplierSearch && !supplierStatusFilter && (
                    <Button onClick={handleOpenCreateSupplier}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Supplier
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden sm:table-cell">Contact</TableHead>
                        <TableHead className="hidden sm:table-cell">Phone</TableHead>
                        <TableHead className="hidden md:table-cell">Email</TableHead>
                        <TableHead>Status</TableHead>
                        {(hasPermission('feed_inventory:update') || hasPermission('feed_inventory:delete')) && (
                          <TableHead className="w-[120px]" />
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {suppliersList.map((supplier) => (
                        <TableRow key={supplier.id}>
                          <TableCell className="font-medium">{supplier.supplierName}</TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground">
                            {supplier.contactPerson ?? '--'}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground">
                            {supplier.phoneNumber ?? '--'}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">
                            {supplier.email ?? '--'}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize ${SUPPLIER_STATUS_COLORS[supplier.status ?? 'active'] ?? ''}`}
                            >
                              {supplier.status ?? 'active'}
                            </span>
                          </TableCell>
                          {(hasPermission('feed_inventory:update') || hasPermission('feed_inventory:delete')) && (
                            <TableCell>
                              <div className="flex gap-1">
                                {hasPermission('feed_inventory:update') && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleOpenEditSupplier(supplier)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}
                                {hasPermission('feed_inventory:delete') && supplier.status === 'active' && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-red-600"
                                    onClick={() => setShowDeleteSupplierConfirm(supplier.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {(suppliersPage - 1) * 20 + 1} to{' '}
                      {Math.min(suppliersPage * 20, suppliersTotal)} of {suppliersTotal}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={suppliersPage <= 1}
                        onClick={() => setSuppliersPage((p) => p - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={suppliersPage >= suppliersTotalPages}
                        onClick={() => setSuppliersPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================= */}
        {/* RECIPES TAB               */}
        {/* ========================= */}
        <TabsContent value="recipes">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <Input
                  placeholder="Search recipes..."
                  value={recipeSearch}
                  onChange={(e) => {
                    setRecipeSearch(e.target.value);
                    setRecipesPage(1);
                  }}
                  className="w-[250px]"
                />
                <Select
                  value={recipeFeedTypeFilter || 'all'}
                  onValueChange={(v) => {
                    setRecipeFeedTypeFilter(v === 'all' ? '' : v);
                    setRecipesPage(1);
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Feed Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Feed Types</SelectItem>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="grower">Grower</SelectItem>
                    <SelectItem value="finisher">Finisher</SelectItem>
                  </SelectContent>
                </Select>
                <div className="sm:ml-auto">
                  {hasPermission('feed_production:create') && (
                    <Button onClick={handleOpenCreateRecipe}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Recipe
                    </Button>
                  )}
                </div>
              </div>

              {recipesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : recipesList.length === 0 ? (
                <div className="text-center py-12">
                  <FlaskConical className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-1">No recipes found</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {recipeSearch || recipeFeedTypeFilter
                      ? 'Try adjusting your filters.'
                      : 'Create your first feed recipe to get started.'}
                  </p>
                  {hasPermission('feed_production:create') && !recipeSearch && !recipeFeedTypeFilter && (
                    <Button onClick={handleOpenCreateRecipe}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Recipe
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Recipe Name</TableHead>
                        <TableHead>Feed Type</TableHead>
                        <TableHead>Cost</TableHead>
                        <TableHead className="hidden sm:table-cell">Ingredients</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[120px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recipesList.map((recipe) => (
                        <TableRow key={recipe.id} className={recipe.status === 'inactive' ? 'opacity-60' : ''}>
                          <TableCell className="font-medium">{recipe.recipeName}</TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={FEED_TYPE_COLORS[recipe.feedType] ?? ''}
                            >
                              {recipe.feedType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {recipe.cost != null
                              ? `Rs. ${Number(recipe.cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                              : '--'}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground text-sm max-w-[300px] truncate" title={(recipe as any).ingredientSummary}>
                            {(recipe as any).ingredientSummary || ((recipe as any).ingredientCount ? `${(recipe as any).ingredientCount} ingredients` : '--')}
                          </TableCell>
                          <TableCell>
                            {hasPermission('feed_production:update') ? (
                              <button
                                type="button"
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize cursor-pointer transition-colors ${recipe.status === 'active' ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
                                onClick={() => handleToggleRecipeStatus(recipe.id, recipe.status ?? 'active')}
                                title={`Click to ${recipe.status === 'active' ? 'deactivate' : 'activate'}`}
                              >
                                {recipe.status ?? 'active'}
                              </button>
                            ) : (
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize ${recipe.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                              >
                                {recipe.status ?? 'active'}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setViewingRecipe({
                                  id: recipe.id,
                                  recipeName: recipe.recipeName,
                                  feedType: recipe.feedType,
                                  cost: recipe.cost ? String(recipe.cost) : '0',
                                  status: recipe.status ?? 'active',
                                  ingredientSummary: (recipe as any).ingredientSummary,
                                })}
                                title="View details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {hasPermission('feed_production:update') && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenEditRecipe(recipe)}
                                  title="Edit recipe"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {hasPermission('feed_production:delete') && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-600"
                                  onClick={() => setShowDeleteRecipeConfirm(recipe.id)}
                                  title="Permanently delete recipe"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {(recipesPage - 1) * 20 + 1} to{' '}
                      {Math.min(recipesPage * 20, recipesTotal)} of {recipesTotal}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={recipesPage <= 1}
                        onClick={() => setRecipesPage((p) => p - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={recipesPage >= recipesTotalPages}
                        onClick={() => setRecipesPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================= */}
        {/* INVENTORY TAB             */}
        {/* ========================= */}
        <TabsContent value="inventory">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <Input
                  placeholder="Search inventory..."
                  value={inventorySearch}
                  onChange={(e) => {
                    setInventorySearch(e.target.value);
                    setInventoryPage(1);
                  }}
                  className="w-[250px]"
                />
                <div className="sm:ml-auto">
                  {hasPermission('feed_inventory:create') && (
                    <Button onClick={handleOpenCreateInventory}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  )}
                </div>
              </div>

              {inventoryLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : inventoryList.length === 0 ? (
                <div className="text-center py-12">
                  <Warehouse className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-1">No inventory items found</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {inventorySearch
                      ? 'Try adjusting your search.'
                      : 'Add your first inventory item to start tracking.'}
                  </p>
                  {hasPermission('feed_inventory:create') && !inventorySearch && (
                    <Button onClick={handleOpenCreateInventory}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ingredient</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead className="hidden sm:table-cell">Cost/Unit</TableHead>
                        <TableHead className="hidden sm:table-cell">Reorder Level</TableHead>
                        <TableHead className="hidden md:table-cell">Last Restock</TableHead>
                        <TableHead className="hidden md:table-cell">Lots</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead className="w-[150px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventoryList.map((item) => {
                        const isLowStock =
                          item.reorderLevel != null &&
                          Number(item.quantity) < Number(item.reorderLevel);
                        return (
                          <TableRow key={item.id} className={isLowStock ? 'bg-red-50/50' : ''}>
                            <TableCell className="font-medium">{item.ingredientName}</TableCell>
                            <TableCell>{Number(item.quantity).toLocaleString()}</TableCell>
                            <TableCell className="text-muted-foreground">{item.unit}</TableCell>
                            <TableCell className="hidden sm:table-cell">
                              {item.costPerUnit != null
                                ? `Rs. ${Number(item.costPerUnit).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                                : '--'}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-muted-foreground">
                              {item.reorderLevel != null
                                ? Number(item.reorderLevel).toLocaleString()
                                : '--'}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground">
                              {item.lastRestockDate
                                ? new Date(item.lastRestockDate).toLocaleDateString()
                                : '--'}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {item.lotCount != null && item.lotCount > 0 ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 gap-1 text-xs"
                                  onClick={() => setShowLotsDialog(item.id)}
                                >
                                  <Package className="h-3 w-3" />
                                  {item.lotCount} lots
                                </Button>
                              ) : (
                                <span className="text-muted-foreground text-xs">--</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {isLowStock ? (
                                <Badge variant="destructive" className="gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  Low
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-green-100 text-green-800">
                                  OK
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {hasPermission('feed_inventory:update') && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Restock"
                                    onClick={() => {
                                      setShowRestockDialog(item.id);
                                      setRestockQuantity('');
                                    }}
                                  >
                                    <RefreshCw className="h-4 w-4" />
                                  </Button>
                                )}
                                {hasPermission('feed_inventory:update') && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleOpenEditInventory(item)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {(inventoryPage - 1) * 20 + 1} to{' '}
                      {Math.min(inventoryPage * 20, inventoryTotal)} of {inventoryTotal}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={inventoryPage <= 1}
                        onClick={() => setInventoryPage((p) => p - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={inventoryPage >= inventoryTotalPages}
                        onClick={() => setInventoryPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================= */}
        {/* PRODUCTION TAB            */}
        {/* ========================= */}
        <TabsContent value="production">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <Select
                  value={productionStatusFilter || 'all'}
                  onValueChange={(v) => {
                    setProductionStatusFilter(v === 'all' ? '' : v);
                    setProductionsPage(1);
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <div className="sm:ml-auto">
                  {hasPermission('feed_production:create') && (
                    <Button onClick={handleOpenCreateProduction}>
                      <Plus className="h-4 w-4 mr-2" />
                      New Production
                    </Button>
                  )}
                </div>
              </div>

              {productionsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : productionsList.length === 0 ? (
                <div className="text-center py-12">
                  <Factory className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-1">No production batches</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {productionStatusFilter
                      ? 'Try adjusting your filter.'
                      : 'Create your first production batch to start milling.'}
                  </p>
                  {hasPermission('feed_production:create') && !productionStatusFilter && (
                    <Button onClick={handleOpenCreateProduction}>
                      <Plus className="h-4 w-4 mr-2" />
                      New Production
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Recipe</TableHead>
                        <TableHead className="hidden sm:table-cell">Feed Type</TableHead>
                        <TableHead>Planned</TableHead>
                        <TableHead className="hidden sm:table-cell">Actual</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden md:table-cell">Date</TableHead>
                        <TableHead className="hidden md:table-cell">Cost</TableHead>
                        {hasPermission('feed_production:update') && <TableHead className="w-[180px]" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productionsList.map((prod) => (
                        <TableRow key={prod.id}>
                          <TableCell className="font-medium font-mono text-sm">{prod.productionCode}</TableCell>
                          <TableCell>{(prod as { recipeName?: string }).recipeName ?? '--'}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {(prod as { feedType?: string }).feedType ? (
                              <Badge variant="secondary" className={FEED_TYPE_COLORS[(prod as { feedType?: string }).feedType!] ?? ''}>
                                {(prod as { feedType?: string }).feedType}
                              </Badge>
                            ) : '--'}
                          </TableCell>
                          <TableCell>{Number(prod.plannedQuantity).toLocaleString()} {prod.unit}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {prod.actualQuantity != null ? `${Number(prod.actualQuantity).toLocaleString()} ${prod.unit}` : '--'}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${PRODUCTION_STATUS_COLORS[prod.status] ?? ''}`}>
                              {prod.status.replace('_', ' ')}
                            </span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">
                            {new Date(prod.productionDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {prod.productionCost != null
                              ? `Rs. ${Number(prod.productionCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                              : '--'}
                          </TableCell>
                          {hasPermission('feed_production:update') && (
                            <TableCell>
                              <div className="flex gap-1">
                                {prod.status === 'planned' && (
                                  <Button variant="ghost" size="icon" title="Start" onClick={() => handleStartProduction(prod.id)}>
                                    <Play className="h-4 w-4 text-blue-600" />
                                  </Button>
                                )}
                                {prod.status === 'in_progress' && (
                                  <Button variant="ghost" size="icon" title="Complete" onClick={() => handleOpenComplete(prod.id)}>
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                  </Button>
                                )}
                                {(prod.status === 'planned' || prod.status === 'in_progress') && (
                                  <Button variant="ghost" size="icon" title="Cancel" onClick={() => handleCancelProduction(prod.id)}>
                                    <XCircle className="h-4 w-4 text-orange-600" />
                                  </Button>
                                )}
                                {(prod.status === 'planned' || prod.status === 'cancelled') && hasPermission('feed_production:delete') && (
                                  <Button variant="ghost" size="icon" className="text-red-600" onClick={() => setShowDeleteProductionConfirm(prod.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                                {prod.status === 'completed' && (
                                  <Button variant="ghost" size="icon" title="Cost Breakdown" onClick={() => setShowCostBreakdownDialog(prod.id)}>
                                    <Eye className="h-4 w-4 text-purple-600" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {(productionsPage - 1) * 20 + 1} to{' '}
                      {Math.min(productionsPage * 20, productionsTotal)} of {productionsTotal}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={productionsPage <= 1} onClick={() => setProductionsPage((p) => p - 1)}>
                        Previous
                      </Button>
                      <Button variant="outline" size="sm" disabled={productionsPage >= productionsTotalPages} onClick={() => setProductionsPage((p) => p + 1)}>
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================= */}
        {/* DISTRIBUTION TAB          */}
        {/* ========================= */}
        <TabsContent value="distribution">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <Select
                  value={distributionFeedTypeFilter || 'all'}
                  onValueChange={(v) => {
                    setDistributionFeedTypeFilter(v === 'all' ? '' : v);
                    setDistributionsPage(1);
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Feed Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Feed Types</SelectItem>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="grower">Grower</SelectItem>
                    <SelectItem value="finisher">Finisher</SelectItem>
                  </SelectContent>
                </Select>
                <div className="sm:ml-auto">
                  {hasPermission('feed_production:create') && (
                    <Button onClick={handleOpenCreateDistribution}>
                      <Plus className="h-4 w-4 mr-2" />
                      New Distribution
                    </Button>
                  )}
                </div>
              </div>

              {distributionsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : distributionsList.length === 0 ? (
                <div className="text-center py-12">
                  <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-1">No distributions</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {distributionFeedTypeFilter
                      ? 'Try adjusting your filter.'
                      : 'Distribute feed to farm batches after completing production.'}
                  </p>
                  {hasPermission('feed_production:create') && !distributionFeedTypeFilter && (
                    <Button onClick={handleOpenCreateDistribution}>
                      <Plus className="h-4 w-4 mr-2" />
                      New Distribution
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Production</TableHead>
                        <TableHead>Farm Batch</TableHead>
                        <TableHead>Feed Type</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead className="hidden sm:table-cell">Date</TableHead>
                        <TableHead className="hidden md:table-cell">Notes</TableHead>
                        {hasPermission('feed_production:delete') && <TableHead className="w-[80px]" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {distributionsList.map((dist) => (
                        <TableRow key={dist.id}>
                          <TableCell className="font-mono text-sm">
                            {(dist as { productionCode?: string }).productionCode ?? 'Manual'}
                          </TableCell>
                          <TableCell className="font-medium">
                            {(dist as { farmBatchCode?: string }).farmBatchCode ?? '--'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={FEED_TYPE_COLORS[dist.feedType] ?? ''}>
                              {dist.feedType}
                            </Badge>
                          </TableCell>
                          <TableCell>{Number(dist.quantity).toLocaleString()} {dist.unit}</TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground">
                            {new Date(dist.distributionDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground max-w-[200px] truncate">
                            {dist.notes ?? '--'}
                          </TableCell>
                          {hasPermission('feed_production:delete') && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-600"
                                onClick={() => setShowDeleteDistributionConfirm(dist.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {(distributionsPage - 1) * 20 + 1} to{' '}
                      {Math.min(distributionsPage * 20, distributionsTotal)} of {distributionsTotal}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={distributionsPage <= 1} onClick={() => setDistributionsPage((p) => p - 1)}>
                        Previous
                      </Button>
                      <Button variant="outline" size="sm" disabled={distributionsPage >= distributionsTotalPages} onClick={() => setDistributionsPage((p) => p + 1)}>
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================= */}
        {/* PURCHASE ORDERS TAB       */}
        {/* ========================= */}
        <TabsContent value="purchase-orders">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <Input
                  placeholder="Search by PO code..."
                  value={poSearch}
                  onChange={(e) => {
                    setPoSearch(e.target.value);
                    setPoPage(1);
                  }}
                  className="sm:w-64"
                />
                <Select
                  value={poStatusFilter}
                  onValueChange={(v) => {
                    setPoStatusFilter(v === 'all' ? '' : v);
                    setPoPage(1);
                  }}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="partially_received">Partially Received</SelectItem>
                    <SelectItem value="received">Received</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex-1" />
                {hasPermission('feed_inventory:create') && (
                  <Button onClick={() => setShowPoDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Purchase Order
                  </Button>
                )}
              </div>

              {poLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : poList.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-1">No Purchase Orders</h3>
                  <p className="text-sm text-muted-foreground">
                    Create a purchase order to start tracking procurement.
                  </p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>PO Code</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Order Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Total Cost</TableHead>
                        <TableHead className="w-[120px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {poList.map((po) => (
                        <TableRow key={po.id}>
                          <TableCell className="font-medium">{po.orderCode}</TableCell>
                          <TableCell>{po.supplierName ?? '--'}</TableCell>
                          <TableCell>{new Date(po.orderDate).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={
                                po.status === 'received' ? 'bg-green-100 text-green-800' :
                                  po.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                                    po.status === 'partially_received' ? 'bg-yellow-100 text-yellow-800' :
                                      po.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                        'bg-gray-100 text-gray-800'
                              }
                            >
                              {po.status.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            Rs. {Number(po.totalCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {po.status === 'draft' && hasPermission('feed_inventory:update') && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      await updatePOStatusMutation.mutateAsync({ id: po.id, status: 'submitted' });
                                      toast.success('Purchase order submitted');
                                    } catch (error) {
                                      parseApiError(error, 'Failed to submit PO');
                                    }
                                  }}
                                >
                                  <Play className="h-4 w-4 mr-1" />
                                  Submit
                                </Button>
                              )}
                              {['submitted', 'partially_received'].includes(po.status) && hasPermission('feed_inventory:update') && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setShowPoDetail(po.id);
                                    setShowReceiveDialog(true);
                                  }}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Receive
                                </Button>
                              )}
                              {['draft', 'submitted'].includes(po.status) && hasPermission('feed_inventory:update') && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600"
                                  onClick={async () => {
                                    try {
                                      await updatePOStatusMutation.mutateAsync({ id: po.id, status: 'cancelled' });
                                      toast.success('Purchase order cancelled');
                                    } catch (error) {
                                      parseApiError(error, 'Failed to cancel PO');
                                    }
                                  }}
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Cancel
                                </Button>
                              )}
                              {po.status === 'draft' && hasPermission('feed_inventory:delete') && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-600"
                                  onClick={async () => {
                                    try {
                                      await deletePO.mutateAsync(po.id);
                                      toast.success('Purchase order deleted');
                                    } catch (error) {
                                      parseApiError(error, 'Failed to delete PO');
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-muted-foreground">
                      Page {poPage} of {poTotal}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={poPage <= 1}
                        onClick={() => setPoPage((p) => p - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={poPage >= poTotal}
                        onClick={() => setPoPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ========================= */}
      {/* SUPPLIER CREATE/EDIT DLG  */}
      {/* ========================= */}
      <Dialog
        open={showSupplierDialog}
        onOpenChange={(open) => {
          setShowSupplierDialog(open);
          if (!open) {
            setEditingSupplier(null);
            setSupplierForm(EMPTY_SUPPLIER_FORM);
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingSupplier ? 'Edit Supplier' : 'New Supplier'}</DialogTitle>
            <DialogDescription>
              {editingSupplier ? 'Update supplier details.' : 'Add a new feed supplier.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supplierName">Supplier Name *</Label>
              <Input
                id="supplierName"
                placeholder="e.g. AgriFeeds Inc."
                value={supplierForm.supplierName}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, supplierName: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactPerson">Contact Person</Label>
                <Input
                  id="contactPerson"
                  placeholder="e.g. John Smith"
                  value={supplierForm.contactPerson}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, contactPerson: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone</Label>
                <Input
                  id="phoneNumber"
                  placeholder="e.g. +27 12 345 6789"
                  value={supplierForm.phoneNumber}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplierEmail">Email</Label>
              <Input
                id="supplierEmail"
                type="email"
                placeholder="supplier@example.com"
                value={supplierForm.email}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplierAddress">Address</Label>
              <Input
                id="supplierAddress"
                placeholder="Full address..."
                value={supplierForm.address}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, address: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowSupplierDialog(false);
                setEditingSupplier(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveSupplier}
              disabled={createSupplierMutation.isPending || updateSupplierMutation.isPending}
            >
              {createSupplierMutation.isPending || updateSupplierMutation.isPending
                ? 'Saving...'
                : editingSupplier
                  ? 'Update'
                  : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE SUPPLIER CONFIRM */}
      <Dialog
        open={showDeleteSupplierConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setShowDeleteSupplierConfirm(null);
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Deactivate Supplier</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate this supplier? This action can be reversed later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteSupplierConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => showDeleteSupplierConfirm !== null && handleDeleteSupplier(showDeleteSupplierConfirm)}
              disabled={deleteSupplierMutation.isPending}
            >
              {deleteSupplierMutation.isPending ? 'Deactivating...' : 'Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================= */}
      {/* RECIPE CREATE/EDIT DLG    */}
      {/* ========================= */}
      <Dialog
        open={showRecipeDialog}
        onOpenChange={(open) => {
          setShowRecipeDialog(open);
          if (!open) {
            setEditingRecipe(null);
            setRecipeForm(EMPTY_RECIPE_FORM);
          }
        }}
      >
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRecipe ? 'Edit Recipe' : 'New Recipe'}</DialogTitle>
            <DialogDescription>
              {editingRecipe ? 'Update feed recipe details.' : 'Create a new feed recipe with ingredients.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recipeName">Recipe Name *</Label>
              <Input
                id="recipeName"
                placeholder="e.g. Starter Mix A"
                value={recipeForm.recipeName}
                onChange={(e) => setRecipeForm((prev) => ({ ...prev, recipeName: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="feedType">Feed Type *</Label>
                <Select
                  value={recipeForm.feedType}
                  onValueChange={(v) => setRecipeForm((prev) => ({ ...prev, feedType: v }))}
                >
                  <SelectTrigger id="feedType">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="grower">Grower</SelectItem>
                    <SelectItem value="finisher">Finisher</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost">Cost (R)</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 1500.00"
                  value={recipeForm.cost}
                  onChange={(e) => setRecipeForm((prev) => ({ ...prev, cost: e.target.value }))}
                />
              </div>
              {editingRecipe && (
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={recipeForm.status}
                    onValueChange={(v) => setRecipeForm((prev) => ({ ...prev, status: v }))}
                  >
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Ingredients Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Ingredients {editingRecipe && recipeDetailLoading ? <span className="text-xs text-muted-foreground ml-1">(loading...)</span> : null}</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddIngredient}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Ingredient
                </Button>
              </div>
              {recipeForm.ingredients.map((ingredient, index) => (
                <div key={index} className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    {index === 0 && (
                      <Label className="text-xs text-muted-foreground">Inventory Item</Label>
                    )}
                    <Select
                      value={ingredient.inventoryItemId}
                      onValueChange={(v) => handleIngredientChange(index, 'inventoryItemId', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select ingredient" />
                      </SelectTrigger>
                      <SelectContent>
                        {inventoryList.map((inv) => (
                          <SelectItem key={inv.id} value={String(inv.id)}>
                            {inv.ingredientName} ({Number(inv.quantity).toFixed(0)} {inv.unit})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24 space-y-1">
                    {index === 0 && (
                      <Label className="text-xs text-muted-foreground">Proportion</Label>
                    )}
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={ingredient.proportion}
                      onChange={(e) => handleIngredientChange(index, 'proportion', e.target.value)}
                    />
                  </div>
                  <div className="w-20 space-y-1">
                    {index === 0 && (
                      <Label className="text-xs text-muted-foreground">Unit</Label>
                    )}
                    <Select
                      value={ingredient.unit}
                      onValueChange={(v) => handleIngredientChange(index, 'unit', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="g">g</SelectItem>
                        <SelectItem value="l">l</SelectItem>
                        <SelectItem value="ml">ml</SelectItem>
                        <SelectItem value="%">%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {recipeForm.ingredients.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-red-600 shrink-0"
                      onClick={() => handleRemoveIngredient(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowRecipeDialog(false);
                setEditingRecipe(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveRecipe}
              disabled={createRecipeMutation.isPending || updateRecipeMutation.isPending}
            >
              {createRecipeMutation.isPending || updateRecipeMutation.isPending
                ? 'Saving...'
                : editingRecipe
                  ? 'Update'
                  : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE RECIPE CONFIRM */}
      <Dialog
        open={showDeleteRecipeConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setShowDeleteRecipeConfirm(null);
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Permanently Delete Recipe</DialogTitle>
            <DialogDescription>
              This will permanently delete the recipe and all its ingredients. This action cannot be undone. If you only want to hide it, use the status toggle to set it as inactive instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteRecipeConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => showDeleteRecipeConfirm !== null && handleDeleteRecipe(showDeleteRecipeConfirm)}
              disabled={deleteRecipeMutation.isPending}
            >
              {deleteRecipeMutation.isPending ? 'Deleting...' : 'Permanently Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================= */}
      {/* INVENTORY CREATE/EDIT DLG */}
      {/* ========================= */}
      <Dialog
        open={showInventoryDialog}
        onOpenChange={(open) => {
          setShowInventoryDialog(open);
          if (!open) {
            setEditingInventory(null);
            setInventoryForm(EMPTY_INVENTORY_FORM);
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingInventory ? 'Edit Inventory Item' : 'New Inventory Item'}</DialogTitle>
            <DialogDescription>
              {editingInventory ? 'Update inventory item details.' : 'Add a new ingredient to the inventory.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ingredientName">Ingredient Name *</Label>
              <Input
                id="ingredientName"
                placeholder="e.g. Maize Meal"
                value={inventoryForm.ingredientName}
                onChange={(e) => setInventoryForm((prev) => ({ ...prev, ingredientName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplierId">Supplier *</Label>
              <Select
                value={inventoryForm.supplierId}
                onValueChange={(v) => setInventoryForm((prev) => ({ ...prev, supplierId: v }))}
              >
                <SelectTrigger id="supplierId">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliersList.filter((s) => s.status === 'active').map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.supplierName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={inventoryForm.quantity}
                  onChange={(e) => setInventoryForm((prev) => ({ ...prev, quantity: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inventoryUnit">Unit</Label>
                <Select
                  value={inventoryForm.unit}
                  onValueChange={(v) => setInventoryForm((prev) => ({ ...prev, unit: v }))}
                >
                  <SelectTrigger id="inventoryUnit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="g">g</SelectItem>
                    <SelectItem value="l">l</SelectItem>
                    <SelectItem value="ml">ml</SelectItem>
                    <SelectItem value="bags">bags</SelectItem>
                    <SelectItem value="units">units</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="costPerUnit">Cost/Unit (R)</Label>
                <Input
                  id="costPerUnit"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={inventoryForm.costPerUnit}
                  onChange={(e) => setInventoryForm((prev) => ({ ...prev, costPerUnit: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reorderLevel">Reorder Level</Label>
              <Input
                id="reorderLevel"
                type="number"
                step="0.01"
                placeholder="Quantity threshold for low stock warning"
                value={inventoryForm.reorderLevel}
                onChange={(e) => setInventoryForm((prev) => ({ ...prev, reorderLevel: e.target.value }))}
              />
            </div>
            {editingInventory && editedQuantity != null && currentEditQuantity != null && editQuantityDelta != null && (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm space-y-1">
                <p className="font-medium">Quantity Impact</p>
                <p className="text-muted-foreground">
                  Current: {formatQuantity(currentEditQuantity)} {inventoryForm.unit}
                </p>
                <p className={editQuantityDelta >= 0 ? 'text-green-700' : 'text-red-700'}>
                  After update: {formatQuantity(editedQuantity)} {inventoryForm.unit}
                  {' '}({editQuantityDelta >= 0 ? '+' : ''}{formatQuantity(editQuantityDelta)})
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowInventoryDialog(false);
                setEditingInventory(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveInventory}
              disabled={createInventoryMutation.isPending || updateInventoryMutation.isPending}
            >
              {createInventoryMutation.isPending || updateInventoryMutation.isPending
                ? 'Saving...'
                : editingInventory
                  ? 'Update'
                  : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RESTOCK DIALOG */}
      <Dialog
        open={showRestockDialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            setShowRestockDialog(null);
            setRestockQuantity('');
          }
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Restock Inventory</DialogTitle>
            <DialogDescription>
              Enter the quantity to add to the current stock.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="restockQuantity">Quantity to Add</Label>
            <Input
              id="restockQuantity"
              type="number"
              step="0.01"
              placeholder="e.g. 500"
              value={restockQuantity}
              onChange={(e) => setRestockQuantity(e.target.value)}
            />
          </div>
          {restockCurrentQuantity != null && restockAfterQuantity != null && (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm space-y-1">
              <p className="font-medium">Quantity Impact</p>
              <p className="text-muted-foreground">
                Current: {formatQuantity(restockCurrentQuantity)} {restockItem?.unit ?? 'kg'}
              </p>
              <p className="text-green-700">
                After restock: {formatQuantity(restockAfterQuantity)} {restockItem?.unit ?? 'kg'} (+{formatQuantity(restockAmount)})
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRestockDialog(null);
                setRestockQuantity('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRestock}
              disabled={restockInventoryMutation.isPending || !restockQuantity || Number(restockQuantity) <= 0}
            >
              {restockInventoryMutation.isPending ? 'Restocking...' : 'Restock'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================= */}
      {/* PRODUCTION CREATE DLG     */}
      {/* ========================= */}
      <Dialog
        open={showProductionDialog}
        onOpenChange={(open) => {
          setShowProductionDialog(open);
          if (!open) setProductionForm(EMPTY_PRODUCTION_FORM);
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>New Production Batch</DialogTitle>
            <DialogDescription>Create a new feed production/milling run from a recipe.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prodRecipe">Recipe *</Label>
              <Select
                value={productionForm.recipeId}
                onValueChange={(v) => setProductionForm((prev) => ({ ...prev, recipeId: v }))}
              >
                <SelectTrigger id="prodRecipe">
                  <SelectValue placeholder="Select recipe" />
                </SelectTrigger>
                <SelectContent>
                  {activeRecipes.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.recipeName} ({r.feedType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prodQty">Planned Quantity *</Label>
                <Input
                  id="prodQty"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 1000"
                  value={productionForm.plannedQuantity}
                  onChange={(e) => setProductionForm((prev) => ({ ...prev, plannedQuantity: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prodUnit">Unit</Label>
                <Select
                  value={productionForm.unit}
                  onValueChange={(v) => setProductionForm((prev) => ({ ...prev, unit: v }))}
                >
                  <SelectTrigger id="prodUnit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="bags">bags</SelectItem>
                    <SelectItem value="tons">tons</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prodDate">Production Date *</Label>
              <Input
                id="prodDate"
                type="date"
                value={productionForm.productionDate}
                onChange={(e) => setProductionForm((prev) => ({ ...prev, productionDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prodNotes">Notes</Label>
              <Input
                id="prodNotes"
                placeholder="Optional notes..."
                value={productionForm.notes}
                onChange={(e) => setProductionForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProductionDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveProduction} disabled={createProductionMutation.isPending}>
              {createProductionMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* COMPLETE PRODUCTION DLG */}
      <Dialog
        open={showCompleteDialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            setShowCompleteDialog(null);
            setCompleteActualQty('');
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Complete Production</DialogTitle>
            <DialogDescription>
              Enter the actual quantity produced. Raw materials will be deducted from inventory.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="completeQty">Actual Quantity Produced *</Label>
              <Input
                id="completeQty"
                type="number"
                step="0.01"
                placeholder="e.g. 950"
                value={completeActualQty}
                onChange={(e) => setCompleteActualQty(e.target.value)}
              />
            </div>
            {completionDetail?.materials && completionDetail.materials.length > 0 && (
              <div className="space-y-2">
                <Label>Materials to consume</Label>
                <div className="border rounded-md p-3 space-y-2 text-sm">
                  {completionDetail.materials.map((m) => {
                    const planned = Number(m.plannedQuantity);
                    const available = m.availableQuantity != null ? Number(m.availableQuantity) : null;
                    const after = available != null ? available - planned : null;
                    return (
                      <div key={m.inventoryItemId} className="flex justify-between gap-4">
                        <span>{m.ingredientName ?? `Item #${m.inventoryItemId}`}</span>
                        <div className="text-right">
                          <div className="text-muted-foreground">
                            Deduct {formatQuantity(planned)} {m.unit}
                          </div>
                          {available != null && after != null && (
                            <div className={after < 0 ? 'text-red-600' : 'text-green-700'}>
                              {formatQuantity(available)}{' -> '}{formatQuantity(after)} {m.unit}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCompleteDialog(null); setCompleteActualQty(''); }}>Cancel</Button>
            <Button
              onClick={handleCompleteProduction}
              disabled={completeProductionMutation.isPending || !completeActualQty || Number(completeActualQty) <= 0}
            >
              {completeProductionMutation.isPending ? 'Completing...' : 'Complete Production'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE PRODUCTION CONFIRM */}
      <Dialog
        open={showDeleteProductionConfirm !== null}
        onOpenChange={(open) => { if (!open) setShowDeleteProductionConfirm(null); }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Production Batch</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this production batch? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteProductionConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => showDeleteProductionConfirm !== null && handleDeleteProduction(showDeleteProductionConfirm)}
              disabled={deleteProductionMutation.isPending}
            >
              {deleteProductionMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================= */}
      {/* DISTRIBUTION CREATE DLG   */}
      {/* ========================= */}
      <Dialog
        open={showDistributionDialog}
        onOpenChange={(open) => {
          setShowDistributionDialog(open);
          if (!open) setDistributionForm(EMPTY_DISTRIBUTION_FORM);
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>New Distribution</DialogTitle>
            <DialogDescription>Distribute feed to a farm batch.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="distProd">Production Batch (optional)</Label>
              <Select
                value={distributionForm.productionBatchId || 'none'}
                onValueChange={(v) => setDistributionForm((prev) => ({ ...prev, productionBatchId: v === 'none' ? '' : v }))}
              >
                <SelectTrigger id="distProd">
                  <SelectValue placeholder="Select production batch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Manual (no production link)</SelectItem>
                  {completedProductions.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.productionCode} — {Number(p.actualQuantity ?? 0).toLocaleString()} {p.unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="distBatch">Farm Batch *</Label>
              <Select
                value={distributionForm.farmBatchId}
                onValueChange={(v) => setDistributionForm((prev) => ({ ...prev, farmBatchId: v }))}
              >
                <SelectTrigger id="distBatch">
                  <SelectValue placeholder="Select farm batch" />
                </SelectTrigger>
                <SelectContent>
                  {farmBatches.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.batchCode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="distFeedType">Feed Type *</Label>
                <Select
                  value={distributionForm.feedType}
                  onValueChange={(v) => setDistributionForm((prev) => ({ ...prev, feedType: v }))}
                >
                  <SelectTrigger id="distFeedType">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="grower">Grower</SelectItem>
                    <SelectItem value="finisher">Finisher</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="distQty">Quantity *</Label>
                <Input
                  id="distQty"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 500"
                  value={distributionForm.quantity}
                  onChange={(e) => setDistributionForm((prev) => ({ ...prev, quantity: e.target.value }))}
                />
              </div>
            </div>
            {distributionForm.productionBatchId && (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm space-y-1">
                <p className="font-medium">Quantity Impact</p>
                {!distributionProductionDetail ? (
                  <p className="text-muted-foreground">Loading production availability...</p>
                ) : (
                  <>
                    <p className="text-muted-foreground">
                      Production: {distributionProductionDetail.production?.productionCode ?? `#${distributionForm.productionBatchId}`}
                    </p>
                    {distributionAvailableBefore != null && (
                      <p className="text-muted-foreground">
                        Available before: {formatQuantity(distributionAvailableBefore)} {distributionProductionDetail.production?.unit ?? distributionForm.unit}
                      </p>
                    )}
                    {distributionAvailableAfter != null && distributionQuantity > 0 && (
                      <p className={distributionAvailableAfter < 0 ? 'text-red-700' : 'text-green-700'}>
                        Available after: {formatQuantity(distributionAvailableAfter)} {distributionProductionDetail.production?.unit ?? distributionForm.unit}
                        {' '}({distributionQuantity > 0 ? '-' : ''}{formatQuantity(distributionQuantity)})
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="distDate">Distribution Date *</Label>
              <Input
                id="distDate"
                type="date"
                value={distributionForm.distributionDate}
                onChange={(e) => setDistributionForm((prev) => ({ ...prev, distributionDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="distNotes">Notes</Label>
              <Input
                id="distNotes"
                placeholder="Optional notes..."
                value={distributionForm.notes}
                onChange={(e) => setDistributionForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDistributionDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveDistribution} disabled={createDistributionMutation.isPending}>
              {createDistributionMutation.isPending ? 'Recording...' : 'Record Distribution'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE DISTRIBUTION CONFIRM */}
      <Dialog
        open={showDeleteDistributionConfirm !== null}
        onOpenChange={(open) => { if (!open) setShowDeleteDistributionConfirm(null); }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Distribution</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this distribution record?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDistributionConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => showDeleteDistributionConfirm !== null && handleDeleteDistribution(showDeleteDistributionConfirm)}
              disabled={deleteDistributionMutation.isPending}
            >
              {deleteDistributionMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CREATE PO DIALOG */}
      <Dialog
        open={showPoDialog}
        onOpenChange={(open) => {
          setShowPoDialog(open);
          if (!open) {
            setPoForm({
              supplierId: '',
              orderDate: new Date().toISOString().split('T')[0],
              expectedDeliveryDate: '',
              notes: '',
              items: [{ inventoryItemId: '', orderedQuantity: '', unitPrice: '', unit: 'kg' }],
            });
          }
        }}
      >
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Purchase Order</DialogTitle>
            <DialogDescription>Create a purchase order for a supplier.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Supplier *</Label>
                <Select
                  value={poForm.supplierId}
                  onValueChange={(v) => setPoForm((prev) => ({ ...prev, supplierId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliersList.filter((s) => s.status === 'active').map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.supplierName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Order Date *</Label>
                <Input
                  type="date"
                  value={poForm.orderDate}
                  onChange={(e) => setPoForm((prev) => ({ ...prev, orderDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Expected Delivery</Label>
                <Input
                  type="date"
                  value={poForm.expectedDeliveryDate}
                  onChange={(e) => setPoForm((prev) => ({ ...prev, expectedDeliveryDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  placeholder="Optional notes"
                  value={poForm.notes}
                  onChange={(e) => setPoForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Line Items</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPoForm((prev) => ({
                      ...prev,
                      items: [...prev.items, { inventoryItemId: '', orderedQuantity: '', unitPrice: '', unit: 'kg' }],
                    }))
                  }
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Item
                </Button>
              </div>
              {poForm.items.map((item, index) => (
                <div key={index} className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    {index === 0 && <Label className="text-xs text-muted-foreground">Inventory Item</Label>}
                    <Select
                      value={item.inventoryItemId}
                      onValueChange={(v) => {
                        const newItems = [...poForm.items];
                        newItems[index] = { ...newItems[index], inventoryItemId: v };
                        setPoForm((prev) => ({ ...prev, items: newItems }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select item" />
                      </SelectTrigger>
                      <SelectContent>
                        {inventoryList.map((inv) => (
                          <SelectItem key={inv.id} value={String(inv.id)}>
                            {inv.ingredientName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-20 space-y-1">
                    {index === 0 && <Label className="text-xs text-muted-foreground">Qty</Label>}
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0"
                      value={item.orderedQuantity}
                      onChange={(e) => {
                        const newItems = [...poForm.items];
                        newItems[index] = { ...newItems[index], orderedQuantity: e.target.value };
                        setPoForm((prev) => ({ ...prev, items: newItems }));
                      }}
                    />
                  </div>
                  <div className="w-24 space-y-1">
                    {index === 0 && <Label className="text-xs text-muted-foreground">Unit Price</Label>}
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={item.unitPrice}
                      onChange={(e) => {
                        const newItems = [...poForm.items];
                        newItems[index] = { ...newItems[index], unitPrice: e.target.value };
                        setPoForm((prev) => ({ ...prev, items: newItems }));
                      }}
                    />
                  </div>
                  <div className="w-16 space-y-1">
                    {index === 0 && <Label className="text-xs text-muted-foreground">Unit</Label>}
                    <Select
                      value={item.unit}
                      onValueChange={(v) => {
                        const newItems = [...poForm.items];
                        newItems[index] = { ...newItems[index], unit: v };
                        setPoForm((prev) => ({ ...prev, items: newItems }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="g">g</SelectItem>
                        <SelectItem value="l">l</SelectItem>
                        <SelectItem value="bags">bags</SelectItem>
                        <SelectItem value="units">units</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {poForm.items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-red-600 shrink-0"
                      onClick={() => {
                        setPoForm((prev) => ({
                          ...prev,
                          items: prev.items.filter((_, i) => i !== index),
                        }));
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {poForm.items.some((it) => it.orderedQuantity && it.unitPrice) && (
              <div className="text-sm text-right text-muted-foreground">
                Estimated Total: Rs. {poForm.items
                  .reduce((sum, it) => sum + (Number(it.orderedQuantity) || 0) * (Number(it.unitPrice) || 0), 0)
                  .toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPoDialog(false)}>
              Cancel
            </Button>
            <Button
              disabled={createPO.isPending}
              onClick={async () => {
                if (!poForm.supplierId) {
                  toast.error('Supplier is required');
                  return;
                }
                if (!poForm.orderDate) {
                  toast.error('Order date is required');
                  return;
                }
                const validItems = poForm.items.filter((it) => it.inventoryItemId && it.orderedQuantity && it.unitPrice);
                if (validItems.length === 0) {
                  toast.error('At least one line item is required');
                  return;
                }
                try {
                  await createPO.mutateAsync({
                    supplierId: Number(poForm.supplierId),
                    orderDate: poForm.orderDate,
                    expectedDeliveryDate: poForm.expectedDeliveryDate || undefined,
                    notes: poForm.notes || undefined,
                    items: validItems.map((it) => ({
                      inventoryItemId: Number(it.inventoryItemId),
                      orderedQuantity: Number(it.orderedQuantity),
                      unitPrice: Number(it.unitPrice),
                      unit: it.unit,
                    })),
                  });
                  toast.success('Purchase order created');
                  setShowPoDialog(false);
                  setPoForm({
                    supplierId: '',
                    orderDate: new Date().toISOString().split('T')[0],
                    expectedDeliveryDate: '',
                    notes: '',
                    items: [{ inventoryItemId: '', orderedQuantity: '', unitPrice: '', unit: 'kg' }],
                  });
                } catch (error) {
                  parseApiError(error, 'Failed to create purchase order');
                }
              }}
            >
              {createPO.isPending ? 'Creating...' : 'Create PO'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RECEIVE PO DIALOG */}
      <Dialog
        open={showReceiveDialog && showPoDetail !== null}
        onOpenChange={(open) => {
          if (!open) {
            setShowReceiveDialog(false);
            setShowPoDetail(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Receive Items</DialogTitle>
            <DialogDescription>Enter received quantities for purchase order items. Stock impact is shown before confirmation.</DialogDescription>
          </DialogHeader>
          <ReceivePOContent
            poId={showPoDetail!}
            onClose={() => {
              setShowReceiveDialog(false);
              setShowPoDetail(null);
            }}
            receivePOMutation={receivePOMutation}
            inventoryById={inventoryById}
          />
        </DialogContent>
      </Dialog>
      {/* VIEW RECIPE DETAILS DIALOG */}
      <Dialog
        open={viewingRecipe !== null}
        onOpenChange={(open) => {
          if (!open) {
            setViewingRecipe(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Recipe Details</DialogTitle>
            <DialogDescription>
              Viewing details for {viewingRecipe?.recipeName}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-muted-foreground">Name:</span> <span className="ml-2">{viewingRecipe?.recipeName}</span>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Type:</span> <Badge variant="secondary" className={`ml-2 ${FEED_TYPE_COLORS[viewingRecipe?.feedType || '']}`}>{viewingRecipe?.feedType}</Badge>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Status:</span> <span className={`ml-2 capitalize ${viewingRecipe?.status === 'active' ? 'text-green-600' : 'text-gray-500'}`}>{viewingRecipe?.status}</span>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Cost:</span> <span className="ml-2">Rs. {Number(viewingRecipe?.cost).toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Ingredients</h4>
              {recipeDetailLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ingredient</TableHead>
                      <TableHead>Proportion</TableHead>
                      <TableHead>Unit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {((recipeDetailData as any)?.data?.ingredients || []).map((ing: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell>{ing.ingredientName || 'Unknown Ingredient'}</TableCell>
                        <TableCell>{ing.proportion}</TableCell>
                        <TableCell>{ing.unit}</TableCell>
                      </TableRow>
                    ))}
                    {(!((recipeDetailData as any)?.data?.ingredients) || ((recipeDetailData as any)?.data?.ingredients.length === 0)) && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">No ingredients found.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingRecipe(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================= */}
      {/* INVENTORY LOTS DIALOG     */}
      {/* ========================= */}
      <Dialog open={showLotsDialog !== null} onOpenChange={(open) => { if (!open) setShowLotsDialog(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Inventory Lots — {(lotsData as unknown as { data?: { ingredientName?: string } })?.data?.ingredientName ?? 'Loading...'}</DialogTitle>
            <DialogDescription>
              FIFO cost tracking: lots are consumed oldest-first during production.
            </DialogDescription>
          </DialogHeader>
          {lotsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <>
              <div className="flex gap-4 mb-4">
                <div className="text-sm">
                  <span className="text-muted-foreground">Total Qty: </span>
                  <span className="font-medium">{(lotsData as unknown as { data?: { totalQuantity?: number } })?.data?.totalQuantity?.toLocaleString() ?? '--'}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Weighted Avg Cost: </span>
                  <span className="font-medium">Rs. {Number((lotsData as unknown as { data?: { weightedAvgCost?: number } })?.data?.weightedAvgCost ?? 0).toFixed(2)}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Active Lots: </span>
                  <span className="font-medium">{(lotsData as unknown as { data?: { lotCount?: number } })?.data?.lotCount ?? 0}</span>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lot Code</TableHead>
                    <TableHead>PO</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead className="text-right">Cost/Unit</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((lotsData as unknown as { data?: { lots?: Array<{ id: number; lotCode: string; poOrderCode: string | null; supplierName: string | null; receivedQuantity: string; remainingQuantity: string; costPerUnit: string; receivedDate: string }> } })?.data?.lots ?? []).map((lot) => {
                    const remaining = Number(lot.remainingQuantity);
                    const received = Number(lot.receivedQuantity);
                    const pct = received > 0 ? (remaining / received) * 100 : 0;
                    const colorClass = remaining <= 0 ? 'text-muted-foreground bg-muted/30' : pct < 10 ? 'bg-red-50/50' : pct < 50 ? 'bg-yellow-50/30' : '';
                    return (
                      <TableRow key={lot.id} className={colorClass}>
                        <TableCell className="font-mono text-xs">{lot.lotCode}</TableCell>
                        <TableCell className="text-xs">{lot.poOrderCode ?? '--'}</TableCell>
                        <TableCell className="text-xs">{lot.supplierName ?? '--'}</TableCell>
                        <TableCell className="text-right">{received.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium">{remaining.toLocaleString()}</TableCell>
                        <TableCell className="text-right">Rs. {Number(lot.costPerUnit).toFixed(2)}</TableCell>
                        <TableCell className="text-xs">{new Date(lot.receivedDate).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            title="View consumption history"
                            onClick={() => setShowLotHistoryDialog(lot.id)}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLotsDialog(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================= */}
      {/* LOT CONSUMPTION HISTORY   */}
      {/* ========================= */}
      <Dialog open={showLotHistoryDialog !== null} onOpenChange={(open) => { if (!open) setShowLotHistoryDialog(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lot Consumption History — {(lotHistoryData as unknown as { data?: { lot?: { lotCode?: string } } })?.data?.lot?.lotCode ?? 'Loading...'}</DialogTitle>
            <DialogDescription>
              Productions that consumed from this lot.
            </DialogDescription>
          </DialogHeader>
          {lotHistoryLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <>
              <div className="flex gap-4 mb-4">
                <div className="text-sm">
                  <span className="text-muted-foreground">Received: </span>
                  <span className="font-medium">{(lotHistoryData as unknown as { data?: { lot?: { receivedQuantity?: number } } })?.data?.lot?.receivedQuantity ?? '--'}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Remaining: </span>
                  <span className="font-medium">{(lotHistoryData as unknown as { data?: { lot?: { remainingQuantity?: number } } })?.data?.lot?.remainingQuantity ?? '--'}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Cost/Unit: </span>
                  <span className="font-medium">Rs. {Number((lotHistoryData as unknown as { data?: { lot?: { costPerUnit?: number } } })?.data?.lot?.costPerUnit ?? 0).toFixed(2)}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Total Consumed: </span>
                  <span className="font-medium">{(lotHistoryData as unknown as { data?: { totalConsumed?: number } })?.data?.totalConsumed ?? 0}</span>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Production Code</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Qty Used</TableHead>
                    <TableHead className="text-right">Cost/Unit</TableHead>
                    <TableHead className="text-right">Line Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((lotHistoryData as unknown as { data?: { consumptions?: Array<{ id: number; productionCode: string; productionDate: string; quantityUsed: string; costPerUnit: string; lineCost: string }> } })?.data?.consumptions ?? []).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.productionCode}</TableCell>
                      <TableCell className="text-xs">{new Date(c.productionDate).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">{Number(c.quantityUsed).toLocaleString()}</TableCell>
                      <TableCell className="text-right">Rs. {Number(c.costPerUnit).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium">Rs. {Number(c.lineCost).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  {((lotHistoryData as unknown as { data?: { consumptions?: unknown[] } })?.data?.consumptions ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No productions have consumed from this lot yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLotHistoryDialog(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================= */}
      {/* PRODUCTION COST BREAKDOWN */}
      {/* ========================= */}
      <Dialog open={showCostBreakdownDialog !== null} onOpenChange={(open) => { if (!open) setShowCostBreakdownDialog(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cost Breakdown — {(costBreakdownData as unknown as { data?: { productionCode?: string } })?.data?.productionCode ?? 'Loading...'}</DialogTitle>
            <DialogDescription>
              FIFO lot-level cost analysis showing which stock was consumed and from which source.
            </DialogDescription>
          </DialogHeader>
          {costBreakdownLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <>
              <div className="flex gap-4 mb-4">
                <div className="text-sm">
                  <span className="text-muted-foreground">Total Cost: </span>
                  <span className="font-semibold">Rs. {Number((costBreakdownData as unknown as { data?: { totalCost?: number } })?.data?.totalCost ?? 0).toFixed(2)}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Cost/Unit Output: </span>
                  <span className="font-semibold">Rs. {Number((costBreakdownData as unknown as { data?: { costPerUnit?: number } })?.data?.costPerUnit ?? 0).toFixed(2)}</span>
                </div>
              </div>

              {/* By Supplier */}
              <h4 className="text-sm font-medium mb-2">Cost by Supplier</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((costBreakdownData as unknown as { data?: { bySupplier?: Array<{ supplierName: string; totalCost: number; percentage: number }> } })?.data?.bySupplier ?? []).map((s) => (
                    <TableRow key={s.supplierName}>
                      <TableCell>{s.supplierName}</TableCell>
                      <TableCell className="text-right">Rs. {s.totalCost.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{s.percentage.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* By PO */}
              <h4 className="text-sm font-medium mb-2 mt-4">Cost by Purchase Order</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Code</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((costBreakdownData as unknown as { data?: { byPurchaseOrder?: Array<{ poOrderCode: string; supplierName: string; totalCost: number; percentage: number }> } })?.data?.byPurchaseOrder ?? []).map((po) => (
                    <TableRow key={po.poOrderCode}>
                      <TableCell className="font-mono text-xs">{po.poOrderCode}</TableCell>
                      <TableCell>{po.supplierName}</TableCell>
                      <TableCell className="text-right">Rs. {po.totalCost.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{po.percentage.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Lot Details */}
              <h4 className="text-sm font-medium mb-2 mt-4">Lot-Level Detail</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingredient</TableHead>
                    <TableHead>Lot Code</TableHead>
                    <TableHead>PO</TableHead>
                    <TableHead className="text-right">Qty Used</TableHead>
                    <TableHead className="text-right">Cost/Unit</TableHead>
                    <TableHead className="text-right">Line Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((costBreakdownData as unknown as { data?: { lotDetails?: Array<{ materialId: number; ingredientName: string; lotCode: string; poOrderCode: string | null; quantityUsed: string; costPerUnit: string; lineCost: string }> } })?.data?.lotDetails ?? []).map((ld, idx) => (
                    <TableRow key={`${ld.materialId}-${idx}`}>
                      <TableCell>{ld.ingredientName}</TableCell>
                      <TableCell className="font-mono text-xs">{ld.lotCode}</TableCell>
                      <TableCell className="text-xs">{ld.poOrderCode ?? '--'}</TableCell>
                      <TableCell className="text-right">{Number(ld.quantityUsed).toLocaleString()}</TableCell>
                      <TableCell className="text-right">Rs. {Number(ld.costPerUnit).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium">Rs. {Number(ld.lineCost).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCostBreakdownDialog(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
