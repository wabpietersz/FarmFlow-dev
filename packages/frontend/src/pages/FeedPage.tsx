import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import {
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
  useInventoryLots,
  useProductionCostBreakdown,
  useLotConsumptionHistory,
} from '@/hooks/useFeed';
import { useBatches } from '@/hooks/useBatches';
import { useInventorySuppliers } from '@/hooks/useInventoryManagement';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableActionsHead, TableActionsCell } from '@/components/ui/table';
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
  FlaskConical,
  Warehouse,
  RefreshCw,
  Factory,
  Truck,
  Play,
  CheckCircle,
  XCircle,
  } from 'lucide-react';
import { toast } from 'sonner';
import { apiPut, parseApiError } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import type { FeedType } from '@farmflow/shared';
import { RowActions } from '@/components/ui/row-actions';
import { StatusBadge } from '@/components/ui/status-badge';

// --- Types ---

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

/** Extra fields the recipe list returns beyond the shared type */
type RecipeExtras = { ingredientSummary?: string; ingredientCount?: number; status?: string };

export default function FeedPage() {
  const { hasPermission } = useAuthStore();
  const canUpdateProduction = hasPermission('feed_production:update');
  const queryClient = useQueryClient();

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
    ingredients?: Array<{ ingredientName?: string; proportion?: string | number; unit?: string }>;
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
  // DATA HOOKS
  // =====================
  // Supplier choices for feed inventory items (suppliers are managed on the Stock page)
  const { data: suppliersData } = useInventorySuppliers({ status: 'active' });
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

  // Derived data
  const suppliersList = suppliersData?.data ?? [];

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
  const handleOpenCreateRecipe = () => {
    setEditingRecipe(null);
    setRecipeForm(EMPTY_RECIPE_FORM);
    setShowRecipeDialog(true);
  };

  // Track which recipe detail we've already loaded ingredients for
  const [loadedRecipeDetailId, setLoadedRecipeDetailId] = useState<number | null>(null);

  const handleOpenEditRecipe = (recipe: {
    id: number;
    recipeName: string;
    feedType: string;
    cost?: number | string | null;
  }) => {
    setLoadedRecipeDetailId(null); // reset so the ingredients load again
    setEditingRecipe({ id: recipe.id });
    // Set basic fields immediately; ingredients load from the detail query below
    setRecipeForm({
      recipeName: recipe.recipeName,
      feedType: recipe.feedType,
      cost: recipe.cost != null ? String(recipe.cost) : '',
      status: (recipe as typeof recipe & RecipeExtras).status ?? 'active',
      ingredients: [{ inventoryItemId: '', proportion: '', unit: 'kg' }],
    });
    setShowRecipeDialog(true);
  };

  // When recipe detail loads, populate ingredients into the form
  const recipeDetailForEdit = (recipeDetailData as unknown as { data?: { recipe?: Record<string, unknown>; ingredients?: { inventoryItemId?: number | null; ingredientName?: string; proportion?: string; unit?: string }[] } })?.data;
  const recipeDetailIngredients = recipeDetailForEdit?.ingredients ?? [];

  // When the recipe's detail arrives, fill its ingredients into the form once (during render, not in an effect)
  if (editingRecipe && recipeDetailForEdit?.ingredients && loadedRecipeDetailId !== editingRecipe.id) {
    setLoadedRecipeDetailId(editingRecipe.id);
    const loadedIngredients = recipeDetailForEdit.ingredients
      .filter((ing) => ing.inventoryItemId != null)
      .map((ing) => ({
        inventoryItemId: String(ing.inventoryItemId ?? ''),
        proportion: String(ing.proportion ?? ''),
        unit: ing.unit ?? 'kg',
      }));
    if (loadedIngredients.length > 0) {
      setRecipeForm((prev) => ({ ...prev, ingredients: loadedIngredients }));
    }
  }

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
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Feed mill</h1>
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
                      <Plus className="h-4 w-4" />
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
                      <Plus className="h-4 w-4" />
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
                        <TableActionsHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recipesList.map((recipe) => (
                        <TableRow key={recipe.id} className={recipe.status === 'inactive' ? 'opacity-60' : ''} onOpen={() => setViewingRecipe({
                                  id: recipe.id,
                                  recipeName: recipe.recipeName,
                                  feedType: recipe.feedType,
                                  cost: recipe.cost ? String(recipe.cost) : '0',
                                  status: recipe.status ?? 'active',
                                  ingredientSummary: (recipe as typeof recipe & RecipeExtras).ingredientSummary,
                                })}>
                          <TableCell className="font-semibold">{recipe.recipeName}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">
                              {recipe.feedType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {recipe.cost != null
                              ? `Rs. ${Number(recipe.cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                              : '--'}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground text-sm max-w-[300px] truncate" title={(recipe as typeof recipe & RecipeExtras).ingredientSummary}>
                            {(recipe as typeof recipe & RecipeExtras).ingredientSummary || ((recipe as typeof recipe & RecipeExtras).ingredientCount ? `${(recipe as typeof recipe & RecipeExtras).ingredientCount} ingredients` : '--')}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={recipe.status ?? 'active'} />
                          </TableCell>
                          <TableActionsCell>
                            <RowActions
                              label={`recipe ${recipe.recipeName}`}
                              open={() => setViewingRecipe({
                                  id: recipe.id,
                                  recipeName: recipe.recipeName,
                                  feedType: recipe.feedType,
                                  cost: recipe.cost ? String(recipe.cost) : '0',
                                  status: recipe.status ?? 'active',
                                  ingredientSummary: (recipe as typeof recipe & RecipeExtras).ingredientSummary,
                                })}
                              actions={[
                                { label: 'Edit', icon: Pencil, hidden: !hasPermission('feed_production:update'), onSelect: () => handleOpenEditRecipe(recipe) },
                                {
                                  label: recipe.status === 'active' ? 'Deactivate' : 'Activate',
                                  icon: recipe.status === 'active' ? XCircle : CheckCircle,
                                  hidden: !hasPermission('feed_production:update'),
                                  onSelect: () => handleToggleRecipeStatus(recipe.id, recipe.status ?? 'active'),
                                },
                                { label: 'Delete', icon: Trash2, destructive: true, hidden: !hasPermission('feed_production:delete'), onSelect: () => setShowDeleteRecipeConfirm(recipe.id) },
                              ]}
                            />
                          </TableActionsCell>
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
                      <Plus className="h-4 w-4" />
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
                      <Plus className="h-4 w-4" />
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
                        <TableActionsHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventoryList.map((item) => {
                        const isLowStock =
                          item.reorderLevel != null &&
                          Number(item.quantity) < Number(item.reorderLevel);
                        return (
                          <TableRow key={item.id} onOpen={item.lotCount ? () => setShowLotsDialog(item.id) : undefined}>
                            <TableCell className="font-semibold">{item.ingredientName}</TableCell>
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
                              {item.lotCount != null && item.lotCount > 0 ? `${item.lotCount} lots` : <span className="text-muted-foreground">--</span>}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={isLowStock ? 'low' : 'ok'} label={isLowStock ? 'Low' : 'OK'} tone={isLowStock ? 'danger' : undefined} />
                            </TableCell>
                            <TableActionsCell>
                              <RowActions
                                label={item.ingredientName}
                                openLabel="Open lots for"
                                open={item.lotCount ? () => setShowLotsDialog(item.id) : undefined}
                                actions={[
                                  { label: 'Edit', icon: Pencil, hidden: !hasPermission('feed_inventory:update'), onSelect: () => handleOpenEditInventory(item) },
                                  {
                                    label: 'Restock',
                                    icon: RefreshCw,
                                    hidden: !hasPermission('feed_inventory:update'),
                                    onSelect: () => { setShowRestockDialog(item.id); setRestockQuantity(''); },
                                  },
                                ]}
                              />
                            </TableActionsCell>
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
                      <Plus className="h-4 w-4" />
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
                      <Plus className="h-4 w-4" />
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
                        <TableActionsHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productionsList.map((prod) => (
                        <TableRow key={prod.id} onOpen={prod.status === 'completed' ? () => setShowCostBreakdownDialog(prod.id) : undefined}>
                          <TableCell className="font-semibold">{prod.productionCode}</TableCell>
                          <TableCell>{(prod as { recipeName?: string }).recipeName ?? '--'}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {(prod as { feedType?: string }).feedType ? (
                              <Badge variant="secondary" className="capitalize">
                                {(prod as { feedType?: string }).feedType}
                              </Badge>
                            ) : '--'}
                          </TableCell>
                          <TableCell>{Number(prod.plannedQuantity).toLocaleString()} {prod.unit}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {prod.actualQuantity != null ? `${Number(prod.actualQuantity).toLocaleString()} ${prod.unit}` : '--'}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={prod.status} tone={prod.status === 'cancelled' ? 'neutral' : undefined} />
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">
                            {new Date(prod.productionDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {prod.productionCost != null
                              ? `Rs. ${Number(prod.productionCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                              : '--'}
                          </TableCell>
                          <TableActionsCell>
                            <RowActions
                              label={`production ${prod.productionCode}`}
                              openLabel="Open cost breakdown for"
                              open={prod.status === 'completed' ? () => setShowCostBreakdownDialog(prod.id) : undefined}
                              actions={[
                                { label: 'Start', icon: Play, primary: true, hidden: !canUpdateProduction || prod.status !== 'planned', onSelect: () => handleStartProduction(prod.id) },
                                { label: 'Complete', icon: CheckCircle, primary: true, hidden: !canUpdateProduction || prod.status !== 'in_progress', onSelect: () => handleOpenComplete(prod.id) },
                                { label: 'Cancel run', icon: XCircle, hidden: !canUpdateProduction || !(prod.status === 'planned' || prod.status === 'in_progress'), onSelect: () => handleCancelProduction(prod.id) },
                                {
                                  label: 'Delete',
                                  icon: Trash2,
                                  destructive: true,
                                  hidden: !canUpdateProduction || !hasPermission('feed_production:delete') || !(prod.status === 'planned' || prod.status === 'cancelled'),
                                  onSelect: () => setShowDeleteProductionConfirm(prod.id),
                                },
                              ]}
                            />
                          </TableActionsCell>
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
                      <Plus className="h-4 w-4" />
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
                      <Plus className="h-4 w-4" />
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
                        <TableActionsHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {distributionsList.map((dist) => (
                        <TableRow key={dist.id}>
                          <TableCell className="font-semibold">
                            {(dist as { productionCode?: string }).productionCode ?? 'Manual'}
                          </TableCell>
                          <TableCell className="font-medium">
                            {(dist as { farmBatchCode?: string }).farmBatchCode ?? '--'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">
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
                          <TableActionsCell>
                            <RowActions
                              label="this distribution"
                              actions={[{ label: 'Delete', icon: Trash2, destructive: true, hidden: !hasPermission('feed_production:delete'), onSelect: () => setShowDeleteDistributionConfirm(dist.id) }]}
                            />
                          </TableActionsCell>
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

      </Tabs>

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
                      className="text-danger shrink-0"
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
                  {suppliersList.filter((s: { status: string }) => s.status === 'active').map((s: { id: number; supplierName: string }) => (
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
                <p className={editQuantityDelta >= 0 ? 'text-success' : 'text-danger'}>
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
              <p className="text-success">
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
                            <div className={after < 0 ? 'text-danger' : 'text-success'}>
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
                      <p className={distributionAvailableAfter < 0 ? 'text-danger' : 'text-success'}>
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
                <span className="font-medium text-muted-foreground">Type:</span> <Badge variant="secondary" className="ml-2 capitalize">{viewingRecipe?.feedType}</Badge>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Status:</span> <span className={`ml-2 capitalize ${viewingRecipe?.status === 'active' ? 'text-success' : 'text-muted-foreground'}`}>{viewingRecipe?.status}</span>
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
                    {recipeDetailIngredients.map((ing, i: number) => (
                      <TableRow key={i}>
                        <TableCell>{ing.ingredientName || 'Unknown Ingredient'}</TableCell>
                        <TableCell>{ing.proportion}</TableCell>
                        <TableCell>{ing.unit}</TableCell>
                      </TableRow>
                    ))}
                    {recipeDetailIngredients.length === 0 && (
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
                    <TableActionsHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((lotsData as unknown as { data?: { lots?: Array<{ id: number; lotCode: string; poOrderCode: string | null; supplierName: string | null; receivedQuantity: string; remainingQuantity: string; costPerUnit: string; receivedDate: string }> } })?.data?.lots ?? []).map((lot) => {
                    const remaining = Number(lot.remainingQuantity);
                    const received = Number(lot.receivedQuantity);
                    const pct = received > 0 ? (remaining / received) * 100 : 0;
                    const colorClass = remaining <= 0 ? 'text-muted-foreground bg-muted/30' : pct < 10 ? 'bg-danger-soft' : pct < 50 ? 'bg-warning-soft' : '';
                    return (
                      <TableRow key={lot.id} className={colorClass} onOpen={() => setShowLotHistoryDialog(lot.id)}>
                        <TableCell className="font-semibold">{lot.lotCode}</TableCell>
                        <TableCell className="text-xs">{lot.poOrderCode ?? '--'}</TableCell>
                        <TableCell className="text-xs">{lot.supplierName ?? '--'}</TableCell>
                        <TableCell className="text-right">{received.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium">{remaining.toLocaleString()}</TableCell>
                        <TableCell className="text-right">Rs. {Number(lot.costPerUnit).toFixed(2)}</TableCell>
                        <TableCell className="text-xs">{new Date(lot.receivedDate).toLocaleDateString()}</TableCell>
                        <TableActionsCell>
                          <RowActions label={`lot ${lot.lotCode}`} openLabel="Open usage history for" open={() => setShowLotHistoryDialog(lot.id)} />
                        </TableActionsCell>
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
