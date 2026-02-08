import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import {
  useSuppliers,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  useRecipes,
  useCreateRecipe,
  useUpdateRecipe,
  useDeleteRecipe,
  useInventory,
  useCreateInventory,
  useUpdateInventory,
  useRestockInventory,
} from '@/hooks/useFeed';
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
} from 'lucide-react';
import { toast } from 'sonner';
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
  ingredientName: string;
  proportion: string;
  unit: string;
}

interface RecipeForm {
  recipeName: string;
  feedType: string;
  cost: string;
  ingredients: RecipeIngredient[];
}

interface InventoryForm {
  ingredientName: string;
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
  ingredients: [{ ingredientName: '', proportion: '', unit: 'kg' }],
};

const EMPTY_INVENTORY_FORM: InventoryForm = {
  ingredientName: '',
  quantity: '',
  unit: 'kg',
  costPerUnit: '',
  reorderLevel: '',
};

// --- Component ---

export default function FeedPage() {
  const { hasPermission } = useAuthStore();

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

  const createSupplierMutation = useCreateSupplier();
  const updateSupplierMutation = useUpdateSupplier(editingSupplier ? String(editingSupplier.id) : '0');
  const deleteSupplierMutation = useDeleteSupplier();

  const createRecipeMutation = useCreateRecipe();
  const updateRecipeMutation = useUpdateRecipe(editingRecipe ? String(editingRecipe.id) : '0');
  const deleteRecipeMutation = useDeleteRecipe();

  const createInventoryMutation = useCreateInventory();
  const updateInventoryMutation = useUpdateInventory(editingInventory ? String(editingInventory.id) : '0');
  const restockInventoryMutation = useRestockInventory();

  // Derived data
  const suppliersList = suppliersData?.data ?? [];
  const suppliersTotalPages = suppliersData?.totalPages ?? 0;
  const suppliersTotal = suppliersData?.total ?? 0;

  const recipesList = recipesData?.data ?? [];
  const recipesTotalPages = recipesData?.totalPages ?? 0;
  const recipesTotal = recipesData?.total ?? 0;

  const inventoryList = inventoryData?.data ?? [];
  const inventoryTotalPages = inventoryData?.totalPages ?? 0;
  const inventoryTotal = inventoryData?.total ?? 0;

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
    } catch {
      toast.error(editingSupplier ? 'Failed to update supplier' : 'Failed to create supplier');
    }
  };

  const handleDeleteSupplier = async (id: number) => {
    try {
      await deleteSupplierMutation.mutateAsync(id);
      toast.success('Supplier deactivated');
      setShowDeleteSupplierConfirm(null);
    } catch {
      toast.error('Failed to deactivate supplier');
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

  const handleOpenEditRecipe = (recipe: {
    id: number;
    recipeName: string;
    feedType: string;
    cost?: number | string | null;
    ingredients?: RecipeIngredient[];
  }) => {
    setEditingRecipe({ id: recipe.id });
    setRecipeForm({
      recipeName: recipe.recipeName,
      feedType: recipe.feedType,
      cost: recipe.cost != null ? String(recipe.cost) : '',
      ingredients:
        recipe.ingredients && recipe.ingredients.length > 0
          ? recipe.ingredients
          : [{ ingredientName: '', proportion: '', unit: 'kg' }],
    });
    setShowRecipeDialog(true);
  };

  const handleAddIngredient = () => {
    setRecipeForm((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, { ingredientName: '', proportion: '', unit: 'kg' }],
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
        ingredients: recipeForm.ingredients.filter((ing) => ing.ingredientName.trim()),
      };
      if (editingRecipe) {
        await updateRecipeMutation.mutateAsync(payload);
        toast.success('Recipe updated successfully');
      } else {
        await createRecipeMutation.mutateAsync(payload);
        toast.success('Recipe created successfully');
      }
      setShowRecipeDialog(false);
      setEditingRecipe(null);
      setRecipeForm(EMPTY_RECIPE_FORM);
    } catch {
      toast.error(editingRecipe ? 'Failed to update recipe' : 'Failed to create recipe');
    }
  };

  const handleDeleteRecipe = async (id: number) => {
    try {
      await deleteRecipeMutation.mutateAsync(id);
      toast.success('Recipe deleted');
      setShowDeleteRecipeConfirm(null);
    } catch {
      toast.error('Failed to delete recipe');
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
  }) => {
    setEditingInventory({ id: item.id });
    setInventoryForm({
      ingredientName: item.ingredientName,
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
    try {
      const payload = {
        ingredientName: inventoryForm.ingredientName,
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
    } catch {
      toast.error(editingInventory ? 'Failed to update inventory item' : 'Failed to create inventory item');
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
    } catch {
      toast.error('Failed to restock inventory');
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

      <Tabs defaultValue="suppliers">
        <TabsList>
          <TabsTrigger value="suppliers" className="gap-2">
            <Package className="h-4 w-4" />
            Suppliers
          </TabsTrigger>
          <TabsTrigger value="recipes" className="gap-2">
            <FlaskConical className="h-4 w-4" />
            Recipes
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-2">
            <Warehouse className="h-4 w-4" />
            Inventory
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
                        {(hasPermission('feed_production:update') || hasPermission('feed_production:delete')) && (
                          <TableHead className="w-[120px]" />
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recipesList.map((recipe) => (
                        <TableRow key={recipe.id}>
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
                              ? `R${Number(recipe.cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                              : '--'}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground">
                            {(recipe as unknown as { ingredients?: unknown[] }).ingredients?.length ?? 0}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize ${recipe.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                            >
                              {recipe.status ?? 'active'}
                            </span>
                          </TableCell>
                          {(hasPermission('feed_production:update') || hasPermission('feed_production:delete')) && (
                            <TableCell>
                              <div className="flex gap-1">
                                {hasPermission('feed_production:update') && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleOpenEditRecipe(recipe)}
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
                                ? `R${Number(item.costPerUnit).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
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
            </div>

            {/* Ingredients Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Ingredients</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddIngredient}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Ingredient
                </Button>
              </div>
              {recipeForm.ingredients.map((ingredient, index) => (
                <div key={index} className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    {index === 0 && (
                      <Label className="text-xs text-muted-foreground">Name</Label>
                    )}
                    <Input
                      placeholder="Ingredient name"
                      value={ingredient.ingredientName}
                      onChange={(e) => handleIngredientChange(index, 'ingredientName', e.target.value)}
                    />
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
            <DialogTitle>Delete Recipe</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this recipe? This action cannot be undone.
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
              {deleteRecipeMutation.isPending ? 'Deleting...' : 'Delete'}
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
    </div>
  );
}
