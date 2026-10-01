import { qualified } from '../lib/sql-utils';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { StockError, getLocationByCode, planLotConsumptionOrLegacy } from '../lib/stock';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate } from '../validators/auth';
import {
  createRecipeSchema,
  updateRecipeSchema,
  createInventorySchema,
  updateInventorySchema,
  restockSchema,
  createProductionSchema,
  updateProductionStatusSchema,
  completeProductionSchema,
  createDistributionSchema,
  inventoryAdjustmentSchema,
  qcCheckpointSchema,
  createReportScheduleSchema,
  updateReportScheduleSchema,
} from '../validators/feed';
import { db } from '../db';
import {
  suppliers,
  feedRecipes,
  feedRecipeIngredients,
  feedInventory,
  feedProductionBatches,
  feedProductionMaterials,
  feedDistributions,
  inventoryAuditTrail,
  inventoryAlerts,
  inventoryItemTypes,
  purchaseOrders,
  purchaseOrderItems,
  inventoryLots,
  productionMaterialLots,
  reportSchedules,
  batches,
} from '../db/schema';
import { eq, and, ilike, sql, desc, gte, lte, asc } from 'drizzle-orm';
import { createAuditLog } from '../lib/audit';
import logger from '../lib/logger';
import { getProductionBatchAvailableQuantity, postInventoryMovement } from '../lib/inventory-movements';

const router = Router();

/** `/recipes/:id` would otherwise swallow `/recipes/cost-optimization` etc. (declared later): skip to the next route. */
function numericIdOnly(req: Request, _res: Response, next: NextFunction) {
  if (/^\d+$/.test(String(req.params.id))) next();
  else next('route');
}

async function getFeedInventoryType() {
  const [feedType] = await db
    .select()
    .from(inventoryItemTypes)
    .where(eq(inventoryItemTypes.isFeed, true))
    .orderBy(asc(inventoryItemTypes.id))
    .limit(1);

  return feedType;
}

async function isFeedInventoryItem(inventoryItemId: number) {
  const [baseItem] = await db
    .select({ id: feedInventory.id, itemTypeId: feedInventory.itemTypeId })
    .from(feedInventory)
    .where(eq(feedInventory.id, inventoryItemId))
    .limit(1);

  if (!baseItem) {
    return false;
  }

  if (baseItem.itemTypeId == null) {
    return true;
  }

  const [item] = await db
    .select({ id: feedInventory.id })
    .from(feedInventory)
    .innerJoin(inventoryItemTypes, eq(feedInventory.itemTypeId, inventoryItemTypes.id))
    .where(and(eq(feedInventory.id, inventoryItemId), eq(inventoryItemTypes.isFeed, true)))
    .limit(1);

  return !!item;
}

// =============================================================================
// SUPPLIERS CRUD
// =============================================================================

// GET /api/feed/suppliers — list all suppliers

// GET /api/feed/suppliers/:id — supplier detail

// POST /api/feed/suppliers — create supplier

// PUT /api/feed/suppliers/:id — update supplier

// DELETE /api/feed/suppliers/:id — soft delete (deactivate)

// GET /api/feed/suppliers/:id/inventory — inventory items for a supplier

// =============================================================================
// RECIPES CRUD
// =============================================================================

// GET /api/feed/recipes — list all recipes with ingredient count
router.get('/recipes', authenticate, requirePermission('feed_production:read'), async (req: Request, res: Response) => {
  try {
    const { feedType, status, search, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    let query = db
      .select({
        id: feedRecipes.id,
        recipeName: feedRecipes.recipeName,
        feedType: feedRecipes.feedType,
        status: feedRecipes.status,
        cost: feedRecipes.cost,
        version: feedRecipes.version,
        parentRecipeId: feedRecipes.parentRecipeId,
        targetProtein: feedRecipes.targetProtein,
        targetEnergy: feedRecipes.targetEnergy,
        targetFiber: feedRecipes.targetFiber,
        targetCalcium: feedRecipes.targetCalcium,
        createdAt: feedRecipes.createdAt,
        updatedAt: feedRecipes.updatedAt,
        ingredientCount: sql<number>`(SELECT count(*)::int FROM ${feedRecipeIngredients} WHERE ${qualified(feedRecipeIngredients.recipeId)} = feed_recipes.id)`,
        ingredientSummary: sql<string>`(
          SELECT string_agg(${qualified(feedRecipeIngredients.ingredientName)}, ', ' ORDER BY ${qualified(feedRecipeIngredients.proportion)} DESC)
          FROM ${feedRecipeIngredients}
          WHERE ${qualified(feedRecipeIngredients.recipeId)} = feed_recipes.id
        )`,
      })
      .from(feedRecipes)
      .$dynamic();

    const conditions = [];
    if (feedType && feedType !== 'all') {
      conditions.push(eq(feedRecipes.feedType, feedType as string));
    }
    if (status && status !== 'all') {
      conditions.push(eq(feedRecipes.status, status as string));
    }
    if (search) {
      conditions.push(ilike(feedRecipes.recipeName, `%${search as string}%`));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query
      .orderBy(desc(feedRecipes.createdAt))
      .limit(limitNum)
      .offset(offset);

    let countQuery = db.select({ total: sql<number>`count(*)::int` }).from(feedRecipes).$dynamic();
    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions));
    }
    const [{ total }] = await countQuery;

    res.json({
      success: true,
      data: results,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch recipes', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch recipes', code: 'RECIPES_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// GET /api/feed/recipes/:id — recipe detail with ingredients
router.get('/recipes/:id', numericIdOnly, authenticate, requirePermission('feed_production:read'), async (req: Request, res: Response) => {
  try {
    const recipeId = Number(req.params.id as string);

    const [recipe] = await db.select().from(feedRecipes).where(eq(feedRecipes.id, recipeId)).limit(1);
    if (!recipe) {
      res.status(404).json({ success: false, error: 'Recipe not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    // Fetch ingredients with inventory details
    const ingredients = await db
      .select({
        id: feedRecipeIngredients.id,
        recipeId: feedRecipeIngredients.recipeId,
        inventoryItemId: feedRecipeIngredients.inventoryItemId,
        supplierId: feedRecipeIngredients.supplierId,
        ingredientName: feedRecipeIngredients.ingredientName,
        proportion: feedRecipeIngredients.proportion,
        unit: feedRecipeIngredients.unit,
        costPerUnit: feedInventory.costPerUnit,
        availableQuantity: feedInventory.quantity,
      })
      .from(feedRecipeIngredients)
      .leftJoin(feedInventory, eq(feedRecipeIngredients.inventoryItemId, feedInventory.id))
      .where(eq(feedRecipeIngredients.recipeId, recipeId));

    // Calculate cost from ingredients
    const calculatedCost = ingredients.reduce((sum, ing) => {
      if (ing.costPerUnit && ing.proportion) {
        return sum + Number(ing.proportion) * Number(ing.costPerUnit);
      }
      return sum;
    }, 0);

    res.json({
      success: true,
      data: { recipe: { ...recipe, calculatedCost: Math.round(calculatedCost * 100) / 100 }, ingredients },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch recipe detail', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch recipe detail', code: 'RECIPE_DETAIL_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// POST /api/feed/recipes — create recipe with ingredients
router.post('/recipes', authenticate, requirePermission('feed_production:create'), validate(createRecipeSchema), async (req: Request, res: Response) => {
  try {
    const { recipeName, feedType, cost, ingredients } = req.body;

    // Check unique recipe name
    const [existing] = await db.select().from(feedRecipes).where(eq(feedRecipes.recipeName, recipeName)).limit(1);
    if (existing) {
      res.status(409).json({ success: false, error: 'A recipe with this name already exists', code: 'RECIPE_NAME_EXISTS', statusCode: 409, timestamp: new Date().toISOString() });
      return;
    }

    // Insert recipe
    const [newRecipe] = await db
      .insert(feedRecipes)
      .values({
        recipeName,
        feedType,
        cost: String(cost),
        status: 'active',
      })
      .returning();

    // Insert ingredients — validate each inventoryItemId exists
    if (ingredients && ingredients.length > 0) {
      const ingredientValues = [];
      for (const ing of ingredients as { inventoryItemId: number; proportion: number; unit: string }[]) {
        const [invItem] = await db.select().from(feedInventory).where(eq(feedInventory.id, ing.inventoryItemId)).limit(1);
        if (!invItem) {
          res.status(400).json({ success: false, error: `Inventory item ${ing.inventoryItemId} not found`, code: 'INVALID_INVENTORY_ITEM', statusCode: 400, timestamp: new Date().toISOString() });
          return;
        }
        if (invItem.itemTypeId != null && !(await isFeedInventoryItem(ing.inventoryItemId))) {
          res.status(400).json({ success: false, error: `Inventory item ${ing.inventoryItemId} is not configured as a feed item`, code: 'INVALID_FEED_INVENTORY_ITEM', statusCode: 400, timestamp: new Date().toISOString() });
          return;
        }
        ingredientValues.push({
          recipeId: newRecipe.id,
          inventoryItemId: ing.inventoryItemId,
          ingredientName: invItem.ingredientName,
          supplierId: invItem.supplierId,
          proportion: String(ing.proportion),
          unit: ing.unit,
        });
      }
      await db.insert(feedRecipeIngredients).values(ingredientValues);
    }

    // Fetch the full recipe with ingredients
    const insertedIngredients = await db
      .select()
      .from(feedRecipeIngredients)
      .where(eq(feedRecipeIngredients.recipeId, newRecipe.id));

    createAuditLog({
      userId: req.user!.id,
      action: 'recipe_created',
      entityType: 'feed_recipe',
      entityId: newRecipe.id,
      changes: { recipeName, feedType, cost, ingredientCount: ingredients.length },
    });

    res.status(201).json({ success: true, data: { recipe: newRecipe, ingredients: insertedIngredients }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to create recipe', { error });
    res.status(500).json({ success: false, error: 'Failed to create recipe', code: 'CREATE_RECIPE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// PUT /api/feed/recipes/:id — update recipe + replace ingredients
router.put('/recipes/:id', authenticate, requirePermission('feed_production:update'), validate(updateRecipeSchema), async (req: Request, res: Response) => {
  try {
    const recipeId = Number(req.params.id as string);

    const [existing] = await db.select().from(feedRecipes).where(eq(feedRecipes.id, recipeId)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Recipe not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    // If recipeName is changing, check uniqueness
    if (req.body.recipeName && req.body.recipeName !== existing.recipeName) {
      const [duplicate] = await db.select().from(feedRecipes).where(eq(feedRecipes.recipeName, req.body.recipeName)).limit(1);
      if (duplicate) {
        res.status(409).json({ success: false, error: 'A recipe with this name already exists', code: 'RECIPE_NAME_EXISTS', statusCode: 409, timestamp: new Date().toISOString() });
        return;
      }
    }

    // Update recipe fields (exclude ingredients from the set)
    const { ingredients, ...recipeFields } = req.body;
    const updateData: Record<string, unknown> = { ...recipeFields, updatedAt: new Date() };
    if (recipeFields.cost !== undefined) {
      updateData.cost = String(recipeFields.cost);
    }

    const [updated] = await db
      .update(feedRecipes)
      .set(updateData)
      .where(eq(feedRecipes.id, recipeId))
      .returning();

    // Replace ingredients if provided
    if (ingredients) {
      await db.delete(feedRecipeIngredients).where(eq(feedRecipeIngredients.recipeId, recipeId));

      if (ingredients.length > 0) {
        const ingredientValues = [];
        for (const ing of ingredients as { inventoryItemId: number; proportion: number; unit: string }[]) {
          const [invItem] = await db.select().from(feedInventory).where(eq(feedInventory.id, ing.inventoryItemId)).limit(1);
          if (!invItem) {
            res.status(400).json({ success: false, error: `Inventory item ${ing.inventoryItemId} not found`, code: 'INVALID_INVENTORY_ITEM', statusCode: 400, timestamp: new Date().toISOString() });
            return;
          }
          if (invItem.itemTypeId != null && !(await isFeedInventoryItem(ing.inventoryItemId))) {
            res.status(400).json({ success: false, error: `Inventory item ${ing.inventoryItemId} is not configured as a feed item`, code: 'INVALID_FEED_INVENTORY_ITEM', statusCode: 400, timestamp: new Date().toISOString() });
            return;
          }
          ingredientValues.push({
            recipeId,
            inventoryItemId: ing.inventoryItemId,
            ingredientName: invItem.ingredientName,
            supplierId: invItem.supplierId,
            proportion: String(ing.proportion),
            unit: ing.unit,
          });
        }
        await db.insert(feedRecipeIngredients).values(ingredientValues);
      }
    }

    const updatedIngredients = await db
      .select()
      .from(feedRecipeIngredients)
      .where(eq(feedRecipeIngredients.recipeId, recipeId));

    createAuditLog({
      userId: req.user!.id,
      action: 'recipe_updated',
      entityType: 'feed_recipe',
      entityId: recipeId,
      changes: { before: { recipeName: existing.recipeName, feedType: existing.feedType }, after: req.body },
    });

    res.json({ success: true, data: { recipe: updated, ingredients: updatedIngredients }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to update recipe', { error });
    res.status(500).json({ success: false, error: 'Failed to update recipe', code: 'UPDATE_RECIPE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// PATCH /api/feed/recipes/:id/status — toggle active/inactive
router.patch('/recipes/:id/status', authenticate, requirePermission('feed_production:update'), async (req: Request, res: Response) => {
  try {
    const recipeId = Number(req.params.id as string);
    const { status: newStatus } = req.body;

    if (!newStatus || !['active', 'inactive'].includes(newStatus)) {
      res.status(400).json({ success: false, error: 'Status must be active or inactive', code: 'INVALID_STATUS', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    const [existing] = await db.select().from(feedRecipes).where(eq(feedRecipes.id, recipeId)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Recipe not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const [updated] = await db
      .update(feedRecipes)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(feedRecipes.id, recipeId))
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: newStatus === 'active' ? 'recipe_activated' : 'recipe_deactivated',
      entityType: 'feed_recipe',
      entityId: recipeId,
      changes: { before: { status: existing.status }, after: { status: newStatus } },
    });

    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to update recipe status', { error });
    res.status(500).json({ success: false, error: 'Failed to update recipe status', code: 'UPDATE_RECIPE_STATUS_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// DELETE /api/feed/recipes/:id — permanent delete (cascade deletes ingredients)
router.delete('/recipes/:id', authenticate, requirePermission('feed_production:delete'), async (req: Request, res: Response) => {
  try {
    const recipeId = Number(req.params.id as string);

    const [existing] = await db.select().from(feedRecipes).where(eq(feedRecipes.id, recipeId)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Recipe not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    // Check if recipe is used in any production batches
    const [usedInProduction] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(feedProductionBatches)
      .where(eq(feedProductionBatches.recipeId, recipeId));

    if (usedInProduction.total > 0) {
      res.status(409).json({
        success: false,
        error: `Cannot delete recipe — it is used in ${usedInProduction.total} production batch(es). Set it to inactive instead.`,
        code: 'RECIPE_IN_USE',
        statusCode: 409,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Hard delete — ingredients cascade automatically via FK
    await db.delete(feedRecipes).where(eq(feedRecipes.id, recipeId));

    createAuditLog({
      userId: req.user!.id,
      action: 'recipe_deleted',
      entityType: 'feed_recipe',
      entityId: recipeId,
      changes: { recipeName: existing.recipeName, feedType: existing.feedType },
    });

    res.json({ success: true, data: { id: recipeId, deleted: true }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to delete recipe', { error });
    res.status(500).json({ success: false, error: 'Failed to delete recipe', code: 'DELETE_RECIPE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// =============================================================================
// INVENTORY CRUD
// =============================================================================

// GET /api/feed/inventory — list with low-stock flag
router.get('/inventory', authenticate, requirePermission('feed_inventory:read'), async (req: Request, res: Response) => {
  try {
    const { search, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    let query = db
      .select({
        id: feedInventory.id,
        ingredientName: feedInventory.ingredientName,
        supplierId: feedInventory.supplierId,
        supplierName: suppliers.supplierName,
        quantity: feedInventory.quantity,
        unit: feedInventory.unit,
        costPerUnit: feedInventory.costPerUnit,
        reorderLevel: feedInventory.reorderLevel,
        lastRestockDate: feedInventory.lastRestockDate,
        createdAt: feedInventory.createdAt,
        updatedAt: feedInventory.updatedAt,
      })
      .from(feedInventory)
      .innerJoin(inventoryItemTypes, eq(feedInventory.itemTypeId, inventoryItemTypes.id))
      .leftJoin(suppliers, eq(feedInventory.supplierId, suppliers.id))
      .$dynamic();

    const conditions = [eq(inventoryItemTypes.isFeed, true)];
    if (search) {
      conditions.push(ilike(feedInventory.ingredientName, `%${search as string}%`));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query
      .orderBy(desc(feedInventory.createdAt))
      .limit(limitNum)
      .offset(offset);

    let countQuery = db
      .select({ total: sql<number>`count(*)::int` })
      .from(feedInventory)
      .innerJoin(inventoryItemTypes, eq(feedInventory.itemTypeId, inventoryItemTypes.id))
      .$dynamic();
    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions));
    }
    const [{ total }] = await countQuery;

    // Add low-stock flag and lot count
    const itemIds = results.map((r) => r.id);
    let lotCounts: Record<number, number> = {};
    if (itemIds.length > 0) {
      const lotCountRows = await db
        .select({
          inventoryItemId: inventoryLots.inventoryItemId,
          count: sql<number>`count(*)::int`,
        })
        .from(inventoryLots)
        .where(sql`${inventoryLots.inventoryItemId} IN (${sql.join(itemIds.map(id => sql`${id}`), sql`, `)}) AND ${inventoryLots.remainingQuantity}::numeric > 0`)
        .groupBy(inventoryLots.inventoryItemId);
      lotCounts = Object.fromEntries(lotCountRows.map((r) => [r.inventoryItemId, r.count]));
    }

    const dataWithFlag = results.map((item) => ({
      ...item,
      lowStock: item.reorderLevel ? Number(item.quantity) < Number(item.reorderLevel) : false,
      lotCount: lotCounts[item.id] ?? 0,
    }));

    res.json({
      success: true,
      data: dataWithFlag,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch inventory', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch inventory', code: 'INVENTORY_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// POST /api/feed/inventory — add inventory item
router.post('/inventory', authenticate, requirePermission('feed_inventory:create'), validate(createInventorySchema), async (req: Request, res: Response) => {
  try {
    const { ingredientName, supplierId, quantity, unit, costPerUnit, reorderLevel } = req.body;

    // Validate supplier exists and is active
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);
    if (!supplier) {
      res.status(400).json({ success: false, error: 'Supplier not found', code: 'INVALID_SUPPLIER', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }
    if (supplier.status !== 'active') {
      res.status(400).json({ success: false, error: 'Supplier is not active', code: 'INACTIVE_SUPPLIER', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    const feedType = await getFeedInventoryType();
    if (!feedType) {
      res.status(500).json({ success: false, error: 'Feed inventory type is not configured', code: 'FEED_TYPE_NOT_CONFIGURED', statusCode: 500, timestamp: new Date().toISOString() });
      return;
    }

    const [newItem] = await db
      .insert(feedInventory)
      .values({
        itemTypeId: feedType.id,
        ingredientName,
        supplierId,
        quantity: String(quantity),
        unit,
        costPerUnit: String(costPerUnit),
        reorderLevel: reorderLevel != null ? String(reorderLevel) : null,
        lastRestockDate: new Date().toISOString().split('T')[0],
      })
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'inventory_created',
      entityType: 'feed_inventory',
      entityId: newItem.id,
      changes: { ingredientName, quantity, unit, costPerUnit },
    });

    res.status(201).json({ success: true, data: newItem, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to create inventory item', { error });
    res.status(500).json({ success: false, error: 'Failed to create inventory item', code: 'CREATE_INVENTORY_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// PUT /api/feed/inventory/:id — update inventory item
router.put('/inventory/:id', authenticate, requirePermission('feed_inventory:update'), validate(updateInventorySchema), async (req: Request, res: Response) => {
  try {
    const itemId = Number(req.params.id as string);

    const [existing] = await db.select().from(feedInventory).where(eq(feedInventory.id, itemId)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Inventory item not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const updateData: Record<string, unknown> = { ...req.body, updatedAt: new Date() };
    if (req.body.quantity !== undefined) {
      updateData.quantity = String(req.body.quantity);
    }
    if (req.body.costPerUnit !== undefined) {
      updateData.costPerUnit = String(req.body.costPerUnit);
    }
    if (req.body.reorderLevel !== undefined) {
      updateData.reorderLevel = req.body.reorderLevel != null ? String(req.body.reorderLevel) : null;
    }

    const [updated] = await db
      .update(feedInventory)
      .set(updateData)
      .where(eq(feedInventory.id, itemId))
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'inventory_updated',
      entityType: 'feed_inventory',
      entityId: itemId,
      changes: { before: { ingredientName: existing.ingredientName, quantity: existing.quantity }, after: req.body },
    });

    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to update inventory item', { error });
    res.status(500).json({ success: false, error: 'Failed to update inventory item', code: 'UPDATE_INVENTORY_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// POST /api/feed/inventory/:id/restock — restock: add quantity, update lastRestockDate
router.post('/inventory/:id/restock', authenticate, requirePermission('feed_inventory:update'), validate(restockSchema), async (req: Request, res: Response) => {
  try {
    const itemId = Number(req.params.id as string);
    const { quantity } = req.body;

    const [existing] = await db.select().from(feedInventory).where(eq(feedInventory.id, itemId)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Inventory item not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const newQuantity = Number(existing.quantity) + quantity;

    const [updated] = await db
      .update(feedInventory)
      .set({
        quantity: String(newQuantity),
        lastRestockDate: new Date().toISOString().split('T')[0],
        updatedAt: new Date(),
      })
      .where(eq(feedInventory.id, itemId))
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'inventory_restocked',
      entityType: 'feed_inventory',
      entityId: itemId,
      changes: { before: { quantity: existing.quantity }, after: { quantity: String(newQuantity) }, restockAmount: quantity },
    });

    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to restock inventory', { error });
    res.status(500).json({ success: false, error: 'Failed to restock inventory', code: 'RESTOCK_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// =============================================================================
// FEED PRODUCTION CRUD
// =============================================================================

// Helper: generate production code PROD-YYYYMMDD-XXX
async function generateProductionCode(date: string): Promise<string> {
  const dateStr = date.replace(/-/g, '').slice(0, 8);
  const prefix = `PROD-${dateStr}-`;
  const [result] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(feedProductionBatches)
    .where(ilike(feedProductionBatches.productionCode, `${prefix}%`));
  const seq = String((result?.total ?? 0) + 1).padStart(3, '0');
  return `${prefix}${seq}`;
}

// Helper: generate lot code LOT-YYYYMMDD-NNN (or LOT-ADJ-YYYYMMDD-NNN for adjustments)
async function generateLotCode(date: string, prefix = 'LOT'): Promise<string> {
  const dateStr = date.replace(/-/g, '').slice(0, 8);
  const lotPrefix = `${prefix}-${dateStr}-`;
  const [result] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(inventoryLots)
    .where(ilike(inventoryLots.lotCode, `${lotPrefix}%`));
  const seq = String((result?.total ?? 0) + 1).padStart(3, '0');
  return `${lotPrefix}${seq}`;
}

// Helper: recalculate weighted average cost from all remaining lots for an inventory item
async function recalculateWeightedAverageCost(inventoryItemId: number): Promise<number> {
  const [result] = await db
    .select({
      totalValue: sql<string>`COALESCE(SUM(${inventoryLots.remainingQuantity}::numeric * ${inventoryLots.costPerUnit}::numeric), 0)`,
      totalQty: sql<string>`COALESCE(SUM(${inventoryLots.remainingQuantity}::numeric), 0)`,
    })
    .from(inventoryLots)
    .where(and(
      eq(inventoryLots.inventoryItemId, inventoryItemId),
      sql`${inventoryLots.remainingQuantity}::numeric > 0`,
    ));

  const totalValue = Number(result?.totalValue ?? 0);
  const totalQty = Number(result?.totalQty ?? 0);

  if (totalQty === 0) return 0;
  return Math.round((totalValue / totalQty) * 100) / 100;
}

// Helper: FIFO consumption — consume inventory from oldest lots first
interface LotConsumption {
  lotId: number;
  lotCode: string;
  quantityUsed: number;
  costPerUnit: number;
  lineCost: number;
  previousRemaining: number;
  newRemaining: number;
}

async function consumeInventoryFIFO(
  inventoryItemId: number,
  requiredQuantity: number,
  options: { preferredLocationId?: number | null; allowExpired?: boolean } = {},
): Promise<{ lotConsumptions: LotConsumption[]; totalCost: number }> {
  return planLotConsumptionOrLegacy({ inventoryItemId, quantity: requiredQuantity, ...options });
}

// GET /api/feed/production — list production batches
router.get('/production', authenticate, requirePermission('feed_production:read'), async (req: Request, res: Response) => {
  try {
    const { status, recipeId, search, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    let query = db
      .select({
        id: feedProductionBatches.id,
        productionCode: feedProductionBatches.productionCode,
        recipeId: feedProductionBatches.recipeId,
        recipeName: feedRecipes.recipeName,
        feedType: feedRecipes.feedType,
        plannedQuantity: feedProductionBatches.plannedQuantity,
        actualQuantity: feedProductionBatches.actualQuantity,
        unit: feedProductionBatches.unit,
        status: feedProductionBatches.status,
        productionDate: feedProductionBatches.productionDate,
        productionCost: feedProductionBatches.productionCost,
        notes: feedProductionBatches.notes,
        createdAt: feedProductionBatches.createdAt,
        updatedAt: feedProductionBatches.updatedAt,
      })
      .from(feedProductionBatches)
      .leftJoin(feedRecipes, eq(feedProductionBatches.recipeId, feedRecipes.id))
      .$dynamic();

    const conditions = [];
    if (status && status !== 'all') {
      conditions.push(eq(feedProductionBatches.status, status as string));
    }
    if (recipeId) {
      conditions.push(eq(feedProductionBatches.recipeId, Number(recipeId)));
    }
    if (search) {
      conditions.push(ilike(feedProductionBatches.productionCode, `%${search as string}%`));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query
      .orderBy(desc(feedProductionBatches.createdAt))
      .limit(limitNum)
      .offset(offset);

    let countQuery = db.select({ total: sql<number>`count(*)::int` }).from(feedProductionBatches).$dynamic();
    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions));
    }
    const [{ total }] = await countQuery;

    res.json({
      success: true,
      data: results,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch production batches', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch production batches', code: 'PRODUCTION_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// GET /api/feed/production/summary — production summary stats
router.get('/production/summary', authenticate, requirePermission('feed_production:read'), async (_req: Request, res: Response) => {
  try {
    const [activeCount] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(feedProductionBatches)
      .where(
        and(
          sql`${feedProductionBatches.status} IN ('planned', 'in_progress')`,
        ),
      );

    const completedStats = await db
      .select({
        feedType: feedRecipes.feedType,
        totalProduced: sql<number>`coalesce(sum(${feedProductionBatches.actualQuantity}::numeric), 0)::numeric`,
        batchCount: sql<number>`count(*)::int`,
      })
      .from(feedProductionBatches)
      .leftJoin(feedRecipes, eq(feedProductionBatches.recipeId, feedRecipes.id))
      .where(eq(feedProductionBatches.status, 'completed'))
      .groupBy(feedRecipes.feedType);

    res.json({
      success: true,
      data: {
        activeProductionCount: activeCount?.total ?? 0,
        completedByFeedType: completedStats,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch production summary', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch production summary', code: 'PRODUCTION_SUMMARY_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// GET /api/feed/production/:id — production detail with materials
router.get('/production/:id', numericIdOnly, authenticate, requirePermission('feed_production:read'), async (req: Request, res: Response) => {
  try {
    const prodId = Number(req.params.id as string);

    const [production] = await db
      .select({
        id: feedProductionBatches.id,
        productionCode: feedProductionBatches.productionCode,
        recipeId: feedProductionBatches.recipeId,
        recipeName: feedRecipes.recipeName,
        feedType: feedRecipes.feedType,
        plannedQuantity: feedProductionBatches.plannedQuantity,
        actualQuantity: feedProductionBatches.actualQuantity,
        unit: feedProductionBatches.unit,
        status: feedProductionBatches.status,
        productionDate: feedProductionBatches.productionDate,
        productionCost: feedProductionBatches.productionCost,
        notes: feedProductionBatches.notes,
        createdAt: feedProductionBatches.createdAt,
        updatedAt: feedProductionBatches.updatedAt,
      })
      .from(feedProductionBatches)
      .leftJoin(feedRecipes, eq(feedProductionBatches.recipeId, feedRecipes.id))
      .where(eq(feedProductionBatches.id, prodId))
      .limit(1);

    if (!production) {
      res.status(404).json({ success: false, error: 'Production batch not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const materials = await db
      .select({
        id: feedProductionMaterials.id,
        productionBatchId: feedProductionMaterials.productionBatchId,
        inventoryItemId: feedProductionMaterials.inventoryItemId,
        ingredientName: feedInventory.ingredientName,
        plannedQuantity: feedProductionMaterials.plannedQuantity,
        actualQuantity: feedProductionMaterials.actualQuantity,
        actualCost: feedProductionMaterials.actualCost,
        weightedCostPerUnit: feedProductionMaterials.weightedCostPerUnit,
        unit: feedProductionMaterials.unit,
        availableQuantity: feedInventory.quantity,
        costPerUnit: feedInventory.costPerUnit,
      })
      .from(feedProductionMaterials)
      .leftJoin(feedInventory, eq(feedProductionMaterials.inventoryItemId, feedInventory.id))
      .where(eq(feedProductionMaterials.productionBatchId, prodId));

    // Fetch lot details for each material (only for completed productions)
    const materialIds = materials.map((m) => m.id);
    let lotDetailsByMaterial: Record<number, Array<{
      id: number; productionMaterialId: number; inventoryLotId: number; lotCode: string;
      quantityUsed: string; costPerUnit: string; lineCost: string;
      poOrderCode: string | null; supplierName: string | null; receivedDate: string | null;
    }>> = {};

    if (materialIds.length > 0 && production.status === 'completed') {
      const allLotDetails = await db
        .select({
          id: productionMaterialLots.id,
          productionMaterialId: productionMaterialLots.productionMaterialId,
          inventoryLotId: productionMaterialLots.inventoryLotId,
          lotCode: inventoryLots.lotCode,
          quantityUsed: productionMaterialLots.quantityUsed,
          costPerUnit: productionMaterialLots.costPerUnit,
          lineCost: productionMaterialLots.lineCost,
          poOrderCode: purchaseOrders.orderCode,
          supplierName: suppliers.supplierName,
          receivedDate: inventoryLots.receivedDate,
        })
        .from(productionMaterialLots)
        .innerJoin(inventoryLots, eq(productionMaterialLots.inventoryLotId, inventoryLots.id))
        .leftJoin(purchaseOrderItems, eq(inventoryLots.purchaseOrderItemId, purchaseOrderItems.id))
        .leftJoin(purchaseOrders, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
        .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
        .where(sql`${productionMaterialLots.productionMaterialId} IN (${sql.join(materialIds.map(id => sql`${id}`), sql`, `)})`);

      lotDetailsByMaterial = {};
      for (const ld of allLotDetails) {
        if (!lotDetailsByMaterial[ld.productionMaterialId]) {
          lotDetailsByMaterial[ld.productionMaterialId] = [];
        }
        lotDetailsByMaterial[ld.productionMaterialId].push(ld);
      }
    }

    const materialsWithLots = materials.map((m) => ({
      ...m,
      lotDetails: lotDetailsByMaterial[m.id] ?? [],
    }));

    // Get total distributed from this production
    const [distributed] = await db
      .select({ total: sql<number>`coalesce(sum(${feedDistributions.quantity}::numeric), 0)::numeric` })
      .from(feedDistributions)
      .where(eq(feedDistributions.productionBatchId, prodId));

    // Cost summary
    const totalMaterialCost = materialsWithLots.reduce((sum, m) => sum + Number(m.actualCost ?? 0), 0);
    const lotSourceCount = materialsWithLots.reduce((sum, m) => sum + (m.lotDetails?.length ?? 0), 0);

    res.json({
      success: true,
      data: {
        production,
        materials: materialsWithLots,
        costSummary: {
          totalMaterialCost: Math.round(totalMaterialCost * 100) / 100,
          costPerOutputUnit: production.actualQuantity
            ? Math.round((totalMaterialCost / Number(production.actualQuantity)) * 100) / 100
            : 0,
          lotSourceCount,
        },
        totalDistributed: Number(distributed?.total ?? 0),
        availableForDistribution: production.actualQuantity
          ? Number(production.actualQuantity) - Number(distributed?.total ?? 0)
          : 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch production detail', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch production detail', code: 'PRODUCTION_DETAIL_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// POST /api/feed/production — create production batch
router.post('/production', authenticate, requirePermission('feed_production:create'), validate(createProductionSchema), async (req: Request, res: Response) => {
  try {
    const { recipeId, plannedQuantity, unit, productionDate, notes } = req.body;

    // Validate recipe exists and is active
    const [recipe] = await db.select().from(feedRecipes).where(eq(feedRecipes.id, recipeId)).limit(1);
    if (!recipe) {
      res.status(404).json({ success: false, error: 'Recipe not found', code: 'RECIPE_NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }
    if (recipe.status !== 'active') {
      res.status(400).json({ success: false, error: 'Recipe is not active', code: 'RECIPE_INACTIVE', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    // Get recipe ingredients
    const ingredients = await db
      .select()
      .from(feedRecipeIngredients)
      .where(eq(feedRecipeIngredients.recipeId, recipeId));

    if (ingredients.length === 0) {
      res.status(400).json({ success: false, error: 'Recipe has no ingredients', code: 'NO_INGREDIENTS', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    // Generate production code
    const productionCode = await generateProductionCode(productionDate);

    // Create production batch
    const [newProd] = await db
      .insert(feedProductionBatches)
      .values({
        productionCode,
        recipeId,
        plannedQuantity: String(plannedQuantity),
        unit: unit || 'kg',
        status: 'planned',
        productionDate,
        notes: notes || null,
      })
      .returning();

    // Auto-create material lines from recipe proportions scaled to planned quantity
    // Recipe proportions represent the amount per unit of recipe cost; we scale by plannedQuantity
    const totalProportion = ingredients.reduce((sum, ing) => sum + Number(ing.proportion), 0);

    // Find matching inventory items for each ingredient via FK
    const materialInserts = [];
    for (const ingredient of ingredients) {
      if (!ingredient.inventoryItemId) {
        // Skip ingredients without inventory link (legacy)
        continue;
      }
      const [invItem] = await db
        .select()
        .from(feedInventory)
        .where(eq(feedInventory.id, ingredient.inventoryItemId))
        .limit(1);

      if (invItem) {
        const scaledQty = (Number(ingredient.proportion) / totalProportion) * plannedQuantity;
        materialInserts.push({
          productionBatchId: newProd.id,
          inventoryItemId: invItem.id,
          plannedQuantity: String(Math.round(scaledQty * 100) / 100),
          unit: ingredient.unit,
        });
      }
    }

    if (materialInserts.length > 0) {
      await db.insert(feedProductionMaterials).values(materialInserts);
    }

    // Fetch materials
    const materials = await db
      .select()
      .from(feedProductionMaterials)
      .where(eq(feedProductionMaterials.productionBatchId, newProd.id));

    createAuditLog({
      userId: req.user!.id,
      action: 'production_created',
      entityType: 'feed_production',
      entityId: newProd.id,
      changes: { productionCode, recipeId, plannedQuantity, materialCount: materials.length },
    });

    res.status(201).json({ success: true, data: { production: newProd, materials }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to create production batch', { error });
    res.status(500).json({ success: false, error: 'Failed to create production batch', code: 'CREATE_PRODUCTION_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// PUT /api/feed/production/:id/status — update production status
router.put('/production/:id/status', authenticate, requirePermission('feed_production:update'), validate(updateProductionStatusSchema), async (req: Request, res: Response) => {
  try {
    const prodId = Number(req.params.id as string);
    const { status: newStatus } = req.body;

    const [existing] = await db.select().from(feedProductionBatches).where(eq(feedProductionBatches.id, prodId)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Production batch not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      planned: ['in_progress', 'cancelled'],
      in_progress: ['completed', 'cancelled'],
    };

    const allowed = validTransitions[existing.status] || [];
    if (!allowed.includes(newStatus)) {
      res.status(400).json({
        success: false,
        error: `Cannot transition from '${existing.status}' to '${newStatus}'`,
        code: 'INVALID_STATUS_TRANSITION',
        statusCode: 400,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const [updated] = await db
      .update(feedProductionBatches)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(feedProductionBatches.id, prodId))
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'production_status_updated',
      entityType: 'feed_production',
      entityId: prodId,
      changes: { before: { status: existing.status }, after: { status: newStatus } },
    });

    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to update production status', { error });
    res.status(500).json({ success: false, error: 'Failed to update production status', code: 'UPDATE_PRODUCTION_STATUS_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// POST /api/feed/production/:id/complete — complete production: deduct inventory, calculate cost
router.post('/production/:id/complete', authenticate, requirePermission('feed_production:update'), validate(completeProductionSchema), async (req: Request, res: Response) => {
  try {
    const prodId = Number(req.params.id as string);
    const { actualQuantity, materials: materialUpdates } = req.body;

    const [existing] = await db.select().from(feedProductionBatches).where(eq(feedProductionBatches.id, prodId)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Production batch not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    if (existing.status !== 'in_progress') {
      res.status(400).json({ success: false, error: 'Production must be in_progress to complete', code: 'INVALID_STATUS', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    // Validate all materials and check inventory sufficiency
    let totalProductionCost = 0;
    const materialResults: { inventoryItemId: number; actualQuantity: number; actualCost: number; weightedCostPerUnit: number; lotConsumptions: LotConsumption[] }[] = [];

    for (const mat of materialUpdates as { inventoryItemId: number; actualQuantity: number }[]) {
      const [invItem] = await db.select().from(feedInventory).where(eq(feedInventory.id, mat.inventoryItemId)).limit(1);
      if (!invItem) {
        res.status(404).json({ success: false, error: `Inventory item ${mat.inventoryItemId} not found`, code: 'INVENTORY_NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
        return;
      }
      if (invItem.itemTypeId != null && !(await isFeedInventoryItem(mat.inventoryItemId))) {
        res.status(400).json({ success: false, error: `Inventory item ${mat.inventoryItemId} is not configured as a feed item`, code: 'INVALID_FEED_INVENTORY_ITEM', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }

      if (Number(invItem.quantity) < mat.actualQuantity) {
        res.status(400).json({
          success: false,
          error: `Insufficient inventory for "${invItem.ingredientName}": available ${invItem.quantity}, needed ${mat.actualQuantity}`,
          code: 'INSUFFICIENT_INVENTORY',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // FIFO lot consumption
      try {
        const millStore = await getLocationByCode('MILL');
        const { lotConsumptions, totalCost } = await consumeInventoryFIFO(mat.inventoryItemId, mat.actualQuantity, { preferredLocationId: millStore.id });
        materialResults.push({
          inventoryItemId: mat.inventoryItemId,
          actualQuantity: mat.actualQuantity,
          actualCost: totalCost,
          weightedCostPerUnit: Math.round((totalCost / mat.actualQuantity) * 100) / 100,
          lotConsumptions,
        });
        totalProductionCost += totalCost;
      } catch (err) {
        if (err instanceof StockError) {
          res.status(400).json({ success: false, error: `${invItem.ingredientName}: ${err.message}`, code: err.code, statusCode: 400, timestamp: new Date().toISOString() });
          return;
        }
        // Fallback to simple cost if no lots exist (legacy data)
        const simpleCost = mat.actualQuantity * Number(invItem.costPerUnit);
        materialResults.push({
          inventoryItemId: mat.inventoryItemId,
          actualQuantity: mat.actualQuantity,
          actualCost: Math.round(simpleCost * 100) / 100,
          weightedCostPerUnit: Number(invItem.costPerUnit),
          lotConsumptions: [],
        });
        totalProductionCost += simpleCost;
        logger.warn('FIFO consumption fallback for production', { prodId, inventoryItemId: mat.inventoryItemId, error: (err as Error).message });
      }
    }

    // Apply lot deductions, update inventory, create audit trail and material lot records
    for (const matResult of materialResults) {
      const [invItem] = await db.select().from(feedInventory).where(eq(feedInventory.id, matResult.inventoryItemId)).limit(1);
      const prevQty = Number(invItem!.quantity);
      const newQty = Math.round((prevQty - matResult.actualQuantity) * 100) / 100;

      // Deduct from individual lots
      for (const lc of matResult.lotConsumptions) {
        await db.update(inventoryLots).set({
          remainingQuantity: String(lc.newRemaining),
        }).where(eq(inventoryLots.id, lc.lotId));
      }

      // Recalculate inventory weighted average cost and update quantity
      const weightedAvgCost = await recalculateWeightedAverageCost(matResult.inventoryItemId);
      await db.update(feedInventory).set({
        quantity: String(newQty),
        costPerUnit: String(weightedAvgCost || Number(invItem!.costPerUnit)),
        updatedAt: new Date(),
      }).where(eq(feedInventory.id, matResult.inventoryItemId));

      // Create audit trail entries for each lot consumed
      for (const lc of matResult.lotConsumptions) {
        await db.insert(inventoryAuditTrail).values({
          inventoryItemId: matResult.inventoryItemId,
          changeType: 'production_deduction',
          previousQuantity: String(lc.previousRemaining),
          changeQuantity: String(-lc.quantityUsed),
          newQuantity: String(lc.newRemaining),
          referenceId: prodId,
          referenceType: 'production_batch',
          lotId: lc.lotId,
          costAtTime: String(lc.costPerUnit),
          notes: `Production ${existing.productionCode} — ${lc.lotCode}`,
          performedBy: req.user!.id,
        });

        await postInventoryMovement({
          movementType: 'production_consume',
          movementDate: existing.productionDate,
          sourceModule: 'feed',
          sourceEntityType: 'feed_production_batch',
          sourceEntityId: prodId,
          sourceCodeSnapshot: existing.productionCode,
          inventoryItemId: matResult.inventoryItemId,
          inventoryLotId: lc.lotId,
          productionBatchId: prodId,
          quantity: -lc.quantityUsed,
          unit: invItem!.unit,
          unitCost: lc.costPerUnit,
          lineCost: lc.lineCost,
          balanceAfterQuantity: lc.newRemaining,
          balanceScope: 'inventory_lot',
          notes: `Production ${existing.productionCode}`,
          createdBy: req.user!.id,
        });
      }

      // If no lots (legacy fallback), create a simple audit trail entry
      if (matResult.lotConsumptions.length === 0) {
        await db.insert(inventoryAuditTrail).values({
          inventoryItemId: matResult.inventoryItemId,
          changeType: 'production_deduction',
          previousQuantity: String(prevQty),
          changeQuantity: String(-matResult.actualQuantity),
          newQuantity: String(newQty),
          referenceId: prodId,
          referenceType: 'production_batch',
          notes: `Production ${existing.productionCode}`,
          performedBy: req.user!.id,
        });

        await postInventoryMovement({
          movementType: 'production_consume',
          movementDate: existing.productionDate,
          sourceModule: 'feed',
          sourceEntityType: 'feed_production_batch',
          sourceEntityId: prodId,
          sourceCodeSnapshot: existing.productionCode,
          inventoryItemId: matResult.inventoryItemId,
          productionBatchId: prodId,
          quantity: -matResult.actualQuantity,
          unit: invItem!.unit,
          unitCost: matResult.weightedCostPerUnit,
          lineCost: matResult.actualCost,
          balanceAfterQuantity: newQty,
          balanceScope: 'inventory_item',
          notes: `Production ${existing.productionCode}`,
          createdBy: req.user!.id,
        });
      }

      // Update production material with actual cost and quantity
      const [updatedMat] = await db
        .update(feedProductionMaterials)
        .set({
          actualQuantity: String(matResult.actualQuantity),
          actualCost: String(matResult.actualCost),
          weightedCostPerUnit: String(matResult.weightedCostPerUnit),
        })
        .where(
          and(
            eq(feedProductionMaterials.productionBatchId, prodId),
            eq(feedProductionMaterials.inventoryItemId, matResult.inventoryItemId),
          ),
        )
        .returning();

      // Create production material lot records for traceability
      if (updatedMat && matResult.lotConsumptions.length > 0) {
        for (const lc of matResult.lotConsumptions) {
          await db.insert(productionMaterialLots).values({
            productionMaterialId: updatedMat.id,
            inventoryLotId: lc.lotId,
            quantityUsed: String(lc.quantityUsed),
            costPerUnit: String(lc.costPerUnit),
            lineCost: String(lc.lineCost),
          });
        }
      }
    }

    // Update production batch
    const [updated] = await db
      .update(feedProductionBatches)
      .set({
        status: 'completed',
        actualQuantity: String(actualQuantity),
        productionCost: String(Math.round(totalProductionCost * 100) / 100),
        updatedAt: new Date(),
      })
      .where(eq(feedProductionBatches.id, prodId))
      .returning();

    await postInventoryMovement({
      movementType: 'production_output',
      movementDate: updated.productionDate,
      sourceModule: 'feed',
      sourceEntityType: 'feed_production_batch',
      sourceEntityId: prodId,
      sourceCodeSnapshot: updated.productionCode,
      productionBatchId: prodId,
      quantity: actualQuantity,
      unit: updated.unit,
      unitCost: actualQuantity > 0 ? Math.round((totalProductionCost / actualQuantity) * 100) / 100 : 0,
      lineCost: Math.round(totalProductionCost * 100) / 100,
      balanceAfterQuantity: actualQuantity,
      balanceScope: 'production_batch',
      notes: updated.notes || null,
      createdBy: req.user!.id,
    });

    createAuditLog({
      userId: req.user!.id,
      action: 'production_completed',
      entityType: 'feed_production',
      entityId: prodId,
      changes: {
        actualQuantity,
        productionCost: Math.round(totalProductionCost * 100) / 100,
        materialsConsumed: materialUpdates.length,
        fifoConsumption: materialResults.map((m) => ({
          inventoryItemId: m.inventoryItemId,
          actualCost: m.actualCost,
          lotsUsed: m.lotConsumptions.length,
        })),
      },
    });

    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to complete production', { error });
    res.status(500).json({ success: false, error: 'Failed to complete production', code: 'COMPLETE_PRODUCTION_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// DELETE /api/feed/production/:id — delete (only if planned or cancelled)
router.delete('/production/:id', authenticate, requirePermission('feed_production:delete'), async (req: Request, res: Response) => {
  try {
    const prodId = Number(req.params.id as string);

    const [existing] = await db.select().from(feedProductionBatches).where(eq(feedProductionBatches.id, prodId)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Production batch not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    if (!['planned', 'cancelled'].includes(existing.status)) {
      res.status(400).json({ success: false, error: 'Can only delete planned or cancelled production batches', code: 'CANNOT_DELETE', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    // Materials are cascade-deleted
    await db.delete(feedProductionBatches).where(eq(feedProductionBatches.id, prodId));

    createAuditLog({
      userId: req.user!.id,
      action: 'production_deleted',
      entityType: 'feed_production',
      entityId: prodId,
      changes: { productionCode: existing.productionCode, status: existing.status },
    });

    res.json({ success: true, data: { id: prodId }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to delete production batch', { error });
    res.status(500).json({ success: false, error: 'Failed to delete production batch', code: 'DELETE_PRODUCTION_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// GET /api/feed/production/:id/cost-breakdown — detailed cost analysis by supplier and PO
router.get('/production/:id/cost-breakdown', authenticate, requirePermission('feed_production:read'), async (req: Request, res: Response) => {
  try {
    const prodId = Number(req.params.id as string);

    const [production] = await db.select().from(feedProductionBatches).where(eq(feedProductionBatches.id, prodId)).limit(1);
    if (!production) {
      res.status(404).json({ success: false, error: 'Production batch not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    // Get all lot consumption records for this production
    const lotDetails = await db
      .select({
        materialId: productionMaterialLots.productionMaterialId,
        ingredientName: feedInventory.ingredientName,
        lotCode: inventoryLots.lotCode,
        quantityUsed: productionMaterialLots.quantityUsed,
        costPerUnit: productionMaterialLots.costPerUnit,
        lineCost: productionMaterialLots.lineCost,
        poOrderCode: purchaseOrders.orderCode,
        supplierName: suppliers.supplierName,
        receivedDate: inventoryLots.receivedDate,
      })
      .from(productionMaterialLots)
      .innerJoin(feedProductionMaterials, eq(productionMaterialLots.productionMaterialId, feedProductionMaterials.id))
      .innerJoin(inventoryLots, eq(productionMaterialLots.inventoryLotId, inventoryLots.id))
      .leftJoin(feedInventory, eq(feedProductionMaterials.inventoryItemId, feedInventory.id))
      .leftJoin(purchaseOrderItems, eq(inventoryLots.purchaseOrderItemId, purchaseOrderItems.id))
      .leftJoin(purchaseOrders, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(eq(feedProductionMaterials.productionBatchId, prodId));

    const totalCost = lotDetails.reduce((sum, ld) => sum + Number(ld.lineCost), 0);

    // Group by supplier
    const bySupplierMap = new Map<string, number>();
    for (const ld of lotDetails) {
      const name = ld.supplierName ?? 'Manual/Legacy';
      bySupplierMap.set(name, (bySupplierMap.get(name) ?? 0) + Number(ld.lineCost));
    }
    const bySupplier = Array.from(bySupplierMap.entries()).map(([supplierName, cost]) => ({
      supplierName,
      totalCost: Math.round(cost * 100) / 100,
      percentage: totalCost > 0 ? Math.round((cost / totalCost) * 10000) / 100 : 0,
    }));

    // Group by PO
    const byPOMap = new Map<string, { supplierName: string; totalCost: number }>();
    for (const ld of lotDetails) {
      const code = ld.poOrderCode ?? 'No PO';
      const existing = byPOMap.get(code);
      byPOMap.set(code, {
        supplierName: ld.supplierName ?? 'Manual/Legacy',
        totalCost: (existing?.totalCost ?? 0) + Number(ld.lineCost),
      });
    }
    const byPurchaseOrder = Array.from(byPOMap.entries()).map(([poOrderCode, data]) => ({
      poOrderCode,
      supplierName: data.supplierName,
      totalCost: Math.round(data.totalCost * 100) / 100,
      percentage: totalCost > 0 ? Math.round((data.totalCost / totalCost) * 10000) / 100 : 0,
    }));

    res.json({
      success: true,
      data: {
        productionCode: production.productionCode,
        totalCost: Math.round(totalCost * 100) / 100,
        costPerUnit: production.actualQuantity
          ? Math.round((totalCost / Number(production.actualQuantity)) * 100) / 100
          : 0,
        lotDetails,
        bySupplier,
        byPurchaseOrder,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch production cost breakdown', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch production cost breakdown', code: 'COST_BREAKDOWN_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// GET /api/feed/lots/:id/consumption-history — which productions consumed from a specific lot
router.get('/lots/:id/consumption-history', authenticate, requirePermission('feed_inventory:read'), async (req: Request, res: Response) => {
  try {
    const lotId = Number(req.params.id as string);

    const [lot] = await db.select().from(inventoryLots).where(eq(inventoryLots.id, lotId)).limit(1);
    if (!lot) {
      res.status(404).json({ success: false, error: 'Inventory lot not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const consumptions = await db
      .select({
        id: productionMaterialLots.id,
        productionCode: feedProductionBatches.productionCode,
        productionDate: feedProductionBatches.productionDate,
        ingredientName: feedInventory.ingredientName,
        quantityUsed: productionMaterialLots.quantityUsed,
        costPerUnit: productionMaterialLots.costPerUnit,
        lineCost: productionMaterialLots.lineCost,
        createdAt: feedProductionBatches.createdAt,
      })
      .from(productionMaterialLots)
      .innerJoin(feedProductionMaterials, eq(productionMaterialLots.productionMaterialId, feedProductionMaterials.id))
      .innerJoin(feedProductionBatches, eq(feedProductionMaterials.productionBatchId, feedProductionBatches.id))
      .leftJoin(feedInventory, eq(feedProductionMaterials.inventoryItemId, feedInventory.id))
      .where(eq(productionMaterialLots.inventoryLotId, lotId))
      .orderBy(desc(feedProductionBatches.productionDate));

    res.json({
      success: true,
      data: {
        lot: {
          id: lot.id,
          lotCode: lot.lotCode,
          receivedQuantity: Number(lot.receivedQuantity),
          remainingQuantity: Number(lot.remainingQuantity),
          costPerUnit: Number(lot.costPerUnit),
          receivedDate: lot.receivedDate,
        },
        consumptions,
        totalConsumed: consumptions.reduce((sum, c) => sum + Number(c.quantityUsed), 0),
        totalCostConsumed: consumptions.reduce((sum, c) => sum + Number(c.lineCost), 0),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch lot consumption history', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch lot consumption history', code: 'LOT_HISTORY_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// =============================================================================
// FEED DISTRIBUTION CRUD
// =============================================================================

// GET /api/feed/distribution — list distributions
router.get('/distribution', authenticate, requirePermission('feed_production:read'), async (req: Request, res: Response) => {
  try {
    const { farmBatchId, feedType, search, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    let query = db
      .select({
        id: feedDistributions.id,
        productionBatchId: feedDistributions.productionBatchId,
        productionCode: feedProductionBatches.productionCode,
        farmBatchId: feedDistributions.farmBatchId,
        farmBatchCode: batches.batchCode,
        feedType: feedDistributions.feedType,
        quantity: feedDistributions.quantity,
        unit: feedDistributions.unit,
        distributionDate: feedDistributions.distributionDate,
        notes: feedDistributions.notes,
        createdAt: feedDistributions.createdAt,
        updatedAt: feedDistributions.updatedAt,
      })
      .from(feedDistributions)
      .leftJoin(feedProductionBatches, eq(feedDistributions.productionBatchId, feedProductionBatches.id))
      .leftJoin(batches, eq(feedDistributions.farmBatchId, batches.id))
      .$dynamic();

    const conditions = [];
    if (farmBatchId) {
      conditions.push(eq(feedDistributions.farmBatchId, Number(farmBatchId)));
    }
    if (feedType && feedType !== 'all') {
      conditions.push(eq(feedDistributions.feedType, feedType as string));
    }
    if (search) {
      conditions.push(ilike(batches.batchCode, `%${search as string}%`));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query
      .orderBy(desc(feedDistributions.createdAt))
      .limit(limitNum)
      .offset(offset);

    const countQuery = db.select({ total: sql<number>`count(*)::int` }).from(feedDistributions).$dynamic();
    if (conditions.length > 0) {
      // Count with the same joins for search filter
      let joinedCount = db
        .select({ total: sql<number>`count(*)::int` })
        .from(feedDistributions)
        .leftJoin(batches, eq(feedDistributions.farmBatchId, batches.id))
        .$dynamic();
      if (conditions.length > 0) {
        joinedCount = joinedCount.where(and(...conditions));
      }
      const [countResult] = await joinedCount;
      const total = countResult?.total ?? 0;

      res.json({
        success: true,
        data: results,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        timestamp: new Date().toISOString(),
      });
      return;
    }
    const [{ total }] = await countQuery;

    res.json({
      success: true,
      data: results,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch distributions', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch distributions', code: 'DISTRIBUTION_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// GET /api/feed/distribution/by-batch/:batchId — distributions for a farm batch
router.get('/distribution/by-batch/:batchId', authenticate, requirePermission('feed_production:read'), async (req: Request, res: Response) => {
  try {
    const farmBatchId = Number(req.params.batchId as string);

    const distributions = await db
      .select({
        id: feedDistributions.id,
        productionBatchId: feedDistributions.productionBatchId,
        productionCode: feedProductionBatches.productionCode,
        feedType: feedDistributions.feedType,
        quantity: feedDistributions.quantity,
        unit: feedDistributions.unit,
        distributionDate: feedDistributions.distributionDate,
        notes: feedDistributions.notes,
        createdAt: feedDistributions.createdAt,
      })
      .from(feedDistributions)
      .leftJoin(feedProductionBatches, eq(feedDistributions.productionBatchId, feedProductionBatches.id))
      .where(eq(feedDistributions.farmBatchId, farmBatchId))
      .orderBy(desc(feedDistributions.distributionDate));

    const [totalQty] = await db
      .select({ total: sql<number>`coalesce(sum(${feedDistributions.quantity}::numeric), 0)::numeric` })
      .from(feedDistributions)
      .where(eq(feedDistributions.farmBatchId, farmBatchId));

    res.json({
      success: true,
      data: {
        distributions,
        totalDistributed: Number(totalQty?.total ?? 0),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch distributions for batch', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch distributions for batch', code: 'BATCH_DISTRIBUTION_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// GET /api/feed/distribution/:id — distribution detail
router.get('/distribution/:id', authenticate, requirePermission('feed_production:read'), async (req: Request, res: Response) => {
  try {
    const distId = Number(req.params.id as string);

    const [distribution] = await db
      .select({
        id: feedDistributions.id,
        productionBatchId: feedDistributions.productionBatchId,
        productionCode: feedProductionBatches.productionCode,
        farmBatchId: feedDistributions.farmBatchId,
        farmBatchCode: batches.batchCode,
        feedType: feedDistributions.feedType,
        quantity: feedDistributions.quantity,
        unit: feedDistributions.unit,
        distributionDate: feedDistributions.distributionDate,
        notes: feedDistributions.notes,
        createdAt: feedDistributions.createdAt,
        updatedAt: feedDistributions.updatedAt,
      })
      .from(feedDistributions)
      .leftJoin(feedProductionBatches, eq(feedDistributions.productionBatchId, feedProductionBatches.id))
      .leftJoin(batches, eq(feedDistributions.farmBatchId, batches.id))
      .where(eq(feedDistributions.id, distId))
      .limit(1);

    if (!distribution) {
      res.status(404).json({ success: false, error: 'Distribution not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    res.json({ success: true, data: distribution, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to fetch distribution detail', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch distribution detail', code: 'DISTRIBUTION_DETAIL_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// POST /api/feed/distribution — create distribution
router.post('/distribution', authenticate, requirePermission('feed_production:create'), validate(createDistributionSchema), async (req: Request, res: Response) => {
  try {
    const { productionBatchId, farmBatchId, feedType, quantity, unit, distributionDate, notes } = req.body;

    // Validate farm batch exists
    const [farmBatch] = await db.select().from(batches).where(eq(batches.id, farmBatchId)).limit(1);
    if (farmBatch?.status === 'closed') {
      res.status(400).json({ success: false, error: 'This batch is closed. Reopen it to make changes.', code: 'BATCH_CLOSED', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }
    if (!farmBatch) {
      res.status(404).json({ success: false, error: 'Farm batch not found', code: 'FARM_BATCH_NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    // If linked to a production batch, validate availability
    if (productionBatchId) {
      const [prodBatch] = await db.select().from(feedProductionBatches).where(eq(feedProductionBatches.id, productionBatchId)).limit(1);
      if (!prodBatch) {
        res.status(404).json({ success: false, error: 'Production batch not found', code: 'PROD_BATCH_NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
        return;
      }

      if (prodBatch.status !== 'completed') {
        res.status(400).json({ success: false, error: 'Can only distribute from completed production batches', code: 'PROD_NOT_COMPLETED', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }

      // Check available quantity
      const ledgerAvailable = await getProductionBatchAvailableQuantity(productionBatchId);
      const [distributed] = await db
        .select({ total: sql<number>`coalesce(sum(${feedDistributions.quantity}::numeric), 0)::numeric` })
        .from(feedDistributions)
        .where(eq(feedDistributions.productionBatchId, productionBatchId));
      const legacyAvailable = Number(prodBatch.actualQuantity) - Number(distributed?.total ?? 0);
      const available = ledgerAvailable > 0 ? ledgerAvailable : legacyAvailable;
      if (quantity > available) {
        res.status(400).json({
          success: false,
          error: `Insufficient produced feed: available ${available.toFixed(2)}, requested ${quantity}`,
          code: 'INSUFFICIENT_PRODUCED_FEED',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
        return;
      }
    }

    const [newDist] = await db
      .insert(feedDistributions)
      .values({
        productionBatchId: productionBatchId || null,
        farmBatchId,
        feedType,
        quantity: String(quantity),
        unit: unit || 'kg',
        distributionDate,
        notes: notes || null,
      })
      .returning();

    await postInventoryMovement({
      movementType: 'distribution_to_batch',
      movementDate: distributionDate,
      sourceModule: 'feed',
      sourceEntityType: 'feed_distribution',
      sourceEntityId: newDist.id,
      sourceCodeSnapshot: productionBatchId ? `production:${productionBatchId}` : `distribution:${newDist.id}`,
      productionBatchId: productionBatchId || null,
      feedDistributionId: newDist.id,
      batchId: farmBatchId,
      quantity: -quantity,
      unit: unit || 'kg',
      balanceAfterQuantity: productionBatchId ? await getProductionBatchAvailableQuantity(productionBatchId) : null,
      balanceScope: 'production_batch',
      notes: notes || null,
      createdBy: req.user!.id,
    });

    createAuditLog({
      userId: req.user!.id,
      action: 'distribution_created',
      entityType: 'feed_distribution',
      entityId: newDist.id,
      changes: { productionBatchId, farmBatchId, feedType, quantity },
    });

    res.status(201).json({ success: true, data: newDist, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to create distribution', { error });
    res.status(500).json({ success: false, error: 'Failed to create distribution', code: 'CREATE_DISTRIBUTION_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// DELETE /api/feed/distribution/:id — delete distribution
router.delete('/distribution/:id', authenticate, requirePermission('feed_production:delete'), async (req: Request, res: Response) => {
  try {
    const distId = Number(req.params.id as string);

    const [existing] = await db.select().from(feedDistributions).where(eq(feedDistributions.id, distId)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Distribution not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    await db.delete(feedDistributions).where(eq(feedDistributions.id, distId));

    createAuditLog({
      userId: req.user!.id,
      action: 'distribution_deleted',
      entityType: 'feed_distribution',
      entityId: distId,
      changes: { farmBatchId: existing.farmBatchId, quantity: existing.quantity },
    });

    res.json({ success: true, data: { id: distId }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to delete distribution', { error });
    res.status(500).json({ success: false, error: 'Failed to delete distribution', code: 'DELETE_DISTRIBUTION_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// =============================================================================
// RECIPE VERSIONING
// =============================================================================

// POST /api/feed/recipes/:id/version — create a new version of a recipe
router.post('/recipes/:id/version', authenticate, requirePermission('feed_inventory:create'), async (req: Request, res: Response) => {
  try {
    const recipeId = Number(req.params.id as string);
    const [original] = await db.select().from(feedRecipes).where(eq(feedRecipes.id, recipeId)).limit(1);
    if (!original) {
      res.status(404).json({ success: false, error: 'Recipe not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    // Get current max version for this recipe lineage
    const parentId = original.parentRecipeId ?? original.id;
    const [maxVersionResult] = await db
      .select({ maxVersion: sql<number>`COALESCE(max(${feedRecipes.version}), 1)::int` })
      .from(feedRecipes)
      .where(sql`${feedRecipes.id} = ${parentId} OR ${feedRecipes.parentRecipeId} = ${parentId}`);

    const newVersion = (maxVersionResult?.maxVersion ?? 1) + 1;

    // Get ingredients from original
    const originalIngredients = await db.select().from(feedRecipeIngredients).where(eq(feedRecipeIngredients.recipeId, recipeId));

    const body = req.body || {};
    const newName = body.recipeName || `${original.recipeName} v${newVersion}`;

    // Create new recipe version
    const [newRecipe] = await db.insert(feedRecipes).values({
      recipeName: newName,
      feedType: body.feedType || original.feedType,
      cost: String(body.cost || original.cost),
      version: newVersion,
      parentRecipeId: parentId,
      targetProtein: body.targetProtein !== undefined ? String(body.targetProtein) : original.targetProtein,
      targetEnergy: body.targetEnergy !== undefined ? String(body.targetEnergy) : original.targetEnergy,
      targetFiber: body.targetFiber !== undefined ? String(body.targetFiber) : original.targetFiber,
      targetCalcium: body.targetCalcium !== undefined ? String(body.targetCalcium) : original.targetCalcium,
    }).returning();

    // Copy ingredients or use provided ones
    const newIngredients = body.ingredients || originalIngredients.map((i: typeof originalIngredients[number]) => ({
      inventoryItemId: i.inventoryItemId,
      ingredientName: i.ingredientName,
      supplierId: i.supplierId,
      proportion: Number(i.proportion),
      unit: i.unit,
    }));

    for (const ing of newIngredients) {
      if (ing.inventoryItemId && !(await isFeedInventoryItem(ing.inventoryItemId))) {
        res.status(400).json({ success: false, error: `Inventory item ${ing.inventoryItemId} is not configured as a feed item`, code: 'INVALID_FEED_INVENTORY_ITEM', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }
      await db.insert(feedRecipeIngredients).values({
        recipeId: newRecipe.id,
        inventoryItemId: ing.inventoryItemId || null,
        ingredientName: ing.ingredientName,
        supplierId: ing.supplierId || null,
        proportion: String(ing.proportion),
        unit: ing.unit,
      });
    }

    // Deactivate old version
    await db.update(feedRecipes).set({ status: 'inactive', updatedAt: new Date() }).where(eq(feedRecipes.id, recipeId));

    createAuditLog({
      userId: req.user!.id,
      action: 'recipe_version_created',
      entityType: 'feed_recipe',
      entityId: newRecipe.id,
      changes: { parentRecipeId: parentId, version: newVersion, previousVersion: original.version },
    });

    res.status(201).json({ success: true, data: newRecipe, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to create recipe version', { error });
    res.status(500).json({ success: false, error: 'Failed to create recipe version', code: 'CREATE_RECIPE_VERSION_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// GET /api/feed/recipes/:id/versions — get all versions of a recipe
router.get('/recipes/:id/versions', authenticate, requirePermission('feed_inventory:read'), async (req: Request, res: Response) => {
  try {
    const recipeId = Number(req.params.id as string);
    const [original] = await db.select().from(feedRecipes).where(eq(feedRecipes.id, recipeId)).limit(1);
    if (!original) {
      res.status(404).json({ success: false, error: 'Recipe not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const parentId = original.parentRecipeId ?? original.id;
    const versions = await db.select().from(feedRecipes)
      .where(sql`${feedRecipes.id} = ${parentId} OR ${feedRecipes.parentRecipeId} = ${parentId}`)
      .orderBy(asc(feedRecipes.version));

    res.json({ success: true, data: versions, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to fetch recipe versions', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch recipe versions', code: 'RECIPE_VERSIONS_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// GET /api/feed/recipes/cost-optimization — get cost optimization suggestions
router.get('/recipes/cost-optimization', authenticate, requirePermission('feed_inventory:read'), async (req: Request, res: Response) => {
  try {
    // Get all active recipes with their ingredients
    const recipes = await db.select().from(feedRecipes).where(eq(feedRecipes.status, 'active'));
    const inventoryItems = await db.select().from(feedInventory);

    const suggestions = [];
    for (const recipe of recipes) {
      const ingredients = await db.select().from(feedRecipeIngredients).where(eq(feedRecipeIngredients.recipeId, recipe.id));

      const recipeSuggestions: { ingredientName: string; currentProportion: number; suggestedProportion: number; reason: string }[] = [];
      let potentialSavings = 0;

      for (const ing of ingredients) {
        // Check if any inventory items have significantly lower cost
        const currentInv = inventoryItems.find((inv) => inv.ingredientName === ing.ingredientName);
        if (currentInv && Number(currentInv.quantity) > Number(currentInv.reorderLevel || 0) * 2) {
          // Ingredient is well-stocked, suggest maintaining current proportion
          continue;
        }

        if (currentInv && Number(currentInv.quantity) < Number(currentInv.reorderLevel || 0)) {
          recipeSuggestions.push({
            ingredientName: ing.ingredientName,
            currentProportion: Number(ing.proportion),
            suggestedProportion: Number(ing.proportion) * 0.9,
            reason: `Low stock (${Number(currentInv.quantity).toFixed(1)} ${currentInv.unit} remaining). Consider reducing proportion or restocking.`,
          });
          potentialSavings += Number(recipe.cost) * 0.02;
        }
      }

      if (recipeSuggestions.length > 0) {
        suggestions.push({
          recipeId: recipe.id,
          recipeName: recipe.recipeName,
          currentCost: Number(recipe.cost),
          optimizedCost: Number(recipe.cost) - potentialSavings,
          savings: potentialSavings,
          savingsPercent: Number(((potentialSavings / Number(recipe.cost)) * 100).toFixed(1)),
          suggestions: recipeSuggestions,
        });
      }
    }

    res.json({ success: true, data: suggestions, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to generate cost optimization', { error });
    res.status(500).json({ success: false, error: 'Failed to generate cost optimization', code: 'COST_OPTIMIZATION_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// =============================================================================
// INVENTORY ALERTS & AUDIT TRAIL
// =============================================================================

// GET /api/feed/inventory/alerts — get active low-stock alerts
router.get('/inventory/alerts', authenticate, requirePermission('feed_inventory:read'), async (req: Request, res: Response) => {
  try {
    const { status = 'active' } = req.query;

    // Check all inventory items against reorder levels and generate/return alerts
    const inventoryItems = await db.select().from(feedInventory);
    const lowStockItems = inventoryItems.filter((item) =>
      item.reorderLevel && Number(item.quantity) <= Number(item.reorderLevel)
    );

    // Upsert alerts for low stock items
    for (const item of lowStockItems) {
      const [existingAlert] = await db.select().from(inventoryAlerts)
        .where(and(eq(inventoryAlerts.inventoryItemId, item.id), eq(inventoryAlerts.status, 'active')))
        .limit(1);

      if (!existingAlert) {
        // Calculate suggested order: bring up to 3x reorder level
        const suggestedQty = Number(item.reorderLevel || 0) * 3 - Number(item.quantity);
        await db.insert(inventoryAlerts).values({
          inventoryItemId: item.id,
          currentQuantity: item.quantity,
          reorderLevel: item.reorderLevel || '0',
          suggestedOrderQuantity: String(Math.max(suggestedQty, 0)),
        });
      }
    }

    // Resolve alerts for items back above reorder level
    const goodStockItems = inventoryItems.filter((item) =>
      !item.reorderLevel || Number(item.quantity) > Number(item.reorderLevel)
    );
    for (const item of goodStockItems) {
      await db.update(inventoryAlerts)
        .set({ status: 'resolved' })
        .where(and(eq(inventoryAlerts.inventoryItemId, item.id), eq(inventoryAlerts.status, 'active')));
    }

    // Fetch alerts based on status filter
    const conditions = [];
    if (status && status !== 'all') {
      conditions.push(eq(inventoryAlerts.status, status as string));
    }

    const alertsQuery = db.select({
      id: inventoryAlerts.id,
      inventoryItemId: inventoryAlerts.inventoryItemId,
      ingredientName: feedInventory.ingredientName,
      currentQuantity: inventoryAlerts.currentQuantity,
      reorderLevel: inventoryAlerts.reorderLevel,
      suggestedOrderQuantity: inventoryAlerts.suggestedOrderQuantity,
      status: inventoryAlerts.status,
      supplierId: feedInventory.supplierId,
      supplierName: suppliers.supplierName,
      createdAt: inventoryAlerts.createdAt,
    })
      .from(inventoryAlerts)
      .leftJoin(feedInventory, eq(inventoryAlerts.inventoryItemId, feedInventory.id))
      .leftJoin(suppliers, eq(feedInventory.supplierId, suppliers.id));

    const alerts = conditions.length > 0
      ? await alertsQuery.where(and(...conditions)).orderBy(desc(inventoryAlerts.createdAt))
      : await alertsQuery.orderBy(desc(inventoryAlerts.createdAt));

    res.json({ success: true, data: alerts, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to fetch inventory alerts', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch inventory alerts', code: 'INVENTORY_ALERTS_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// PUT /api/feed/inventory/alerts/:id/acknowledge — acknowledge an alert
router.put('/inventory/alerts/:id/acknowledge', authenticate, requirePermission('feed_inventory:update'), async (req: Request, res: Response) => {
  try {
    const alertId = Number(req.params.id as string);
    const [alert] = await db.select().from(inventoryAlerts).where(eq(inventoryAlerts.id, alertId)).limit(1);
    if (!alert) {
      res.status(404).json({ success: false, error: 'Alert not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    await db.update(inventoryAlerts).set({
      status: 'acknowledged',
      acknowledgedBy: req.user!.id,
      acknowledgedAt: new Date(),
    }).where(eq(inventoryAlerts.id, alertId));

    res.json({ success: true, data: { id: alertId, status: 'acknowledged' }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to acknowledge alert', { error });
    res.status(500).json({ success: false, error: 'Failed to acknowledge alert', code: 'ACKNOWLEDGE_ALERT_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// GET /api/feed/inventory/:id/audit-trail — get audit trail for an inventory item
router.get('/inventory/:id/audit-trail', authenticate, requirePermission('feed_inventory:read'), async (req: Request, res: Response) => {
  try {
    const itemId = Number(req.params.id as string);
    const { page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    const [item] = await db.select().from(feedInventory).where(eq(feedInventory.id, itemId)).limit(1);
    if (!item) {
      res.status(404).json({ success: false, error: 'Inventory item not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const [countResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(inventoryAuditTrail).where(eq(inventoryAuditTrail.inventoryItemId, itemId));

    const entries = await db.select().from(inventoryAuditTrail)
      .where(eq(inventoryAuditTrail.inventoryItemId, itemId))
      .orderBy(desc(inventoryAuditTrail.createdAt))
      .limit(limitNum)
      .offset(offset);

    const total = countResult?.count ?? 0;
    res.json({
      success: true,
      data: entries,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch inventory audit trail', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch inventory audit trail', code: 'AUDIT_TRAIL_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// GET /api/feed/inventory/:id/lots — get inventory lots for an item (FIFO order)
router.get('/inventory/:id/lots', authenticate, requirePermission('feed_inventory:read'), async (req: Request, res: Response) => {
  try {
    const itemId = Number(req.params.id as string);
    const { includeEmpty = 'false' } = req.query;

    const [item] = await db.select().from(feedInventory).where(eq(feedInventory.id, itemId)).limit(1);
    if (!item) {
      res.status(404).json({ success: false, error: 'Inventory item not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    let lotsQuery = db
      .select({
        id: inventoryLots.id,
        inventoryItemId: inventoryLots.inventoryItemId,
        purchaseOrderItemId: inventoryLots.purchaseOrderItemId,
        lotCode: inventoryLots.lotCode,
        receivedQuantity: inventoryLots.receivedQuantity,
        remainingQuantity: inventoryLots.remainingQuantity,
        costPerUnit: inventoryLots.costPerUnit,
        receivedDate: inventoryLots.receivedDate,
        expiryDate: inventoryLots.expiryDate,
        notes: inventoryLots.notes,
        createdAt: inventoryLots.createdAt,
        poOrderCode: purchaseOrders.orderCode,
        supplierName: suppliers.supplierName,
      })
      .from(inventoryLots)
      .leftJoin(purchaseOrderItems, eq(inventoryLots.purchaseOrderItemId, purchaseOrderItems.id))
      .leftJoin(purchaseOrders, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(eq(inventoryLots.inventoryItemId, itemId))
      .orderBy(asc(inventoryLots.receivedDate), asc(inventoryLots.id))
      .$dynamic();

    if (includeEmpty !== 'true') {
      lotsQuery = lotsQuery.where(and(
        eq(inventoryLots.inventoryItemId, itemId),
        sql`${inventoryLots.remainingQuantity}::numeric > 0`,
      ));
    }

    const lots = await lotsQuery;

    res.json({
      success: true,
      data: {
        ingredientName: item.ingredientName,
        totalQuantity: Number(item.quantity),
        weightedAvgCost: Number(item.costPerUnit),
        lotCount: lots.length,
        lots,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch inventory lots', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch inventory lots', code: 'INVENTORY_LOTS_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// POST /api/feed/inventory/:id/adjust — manual inventory adjustment with audit trail
router.post('/inventory/:id/adjust', authenticate, requirePermission('feed_inventory:update'), validate(inventoryAdjustmentSchema), async (req: Request, res: Response) => {
  try {
    const itemId = Number(req.params.id as string);
    const { quantity, reason, costPerUnit } = req.body;

    const [item] = await db.select().from(feedInventory).where(eq(feedInventory.id, itemId)).limit(1);
    if (!item) {
      res.status(404).json({ success: false, error: 'Inventory item not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const previousQuantity = Number(item.quantity);
    const newQuantity = previousQuantity + quantity;

    if (newQuantity < 0) {
      res.status(400).json({ success: false, error: 'Adjustment would result in negative quantity', code: 'INVALID_ADJUSTMENT', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    let lotInfo: { lotCode: string; lotId: number } | null = null;

    // For positive adjustments (adding stock), create an adjustment lot
    if (quantity > 0 && costPerUnit) {
      const today = new Date().toISOString().split('T')[0];
      const lotCode = await generateLotCode(today, 'LOT-ADJ');
      const [newLot] = await db.insert(inventoryLots).values({
        inventoryItemId: itemId,
        lotCode,
        receivedQuantity: String(quantity),
        remainingQuantity: String(quantity),
        costPerUnit: String(costPerUnit),
        receivedDate: today,
        notes: `Manual adjustment: ${reason}`,
      }).returning();
      lotInfo = { lotCode, lotId: newLot.id };

      await postInventoryMovement({
        movementType: 'adjustment',
        movementDate: today,
        sourceModule: 'feed',
        sourceEntityType: 'inventory_adjustment',
        sourceEntityId: itemId,
        sourceCodeSnapshot: lotCode,
        inventoryItemId: itemId,
        inventoryLotId: newLot.id,
        quantity,
        unit: item.unit,
        unitCost: costPerUnit,
        lineCost: Math.round(quantity * costPerUnit * 100) / 100,
        balanceAfterQuantity: quantity,
        balanceScope: 'inventory_lot',
        notes: reason,
        createdBy: req.user!.id,
      });
    }

    // For negative adjustments, deduct from oldest lots (FIFO)
    let usedLotLevelAdjustment = false;
    if (quantity < 0) {
      try {
        // A stock-count correction may remove expired stock too.
        const { lotConsumptions } = await consumeInventoryFIFO(itemId, Math.abs(quantity), { allowExpired: true });
        usedLotLevelAdjustment = lotConsumptions.length > 0;
        // Apply lot deductions
        for (const lc of lotConsumptions) {
          await db.update(inventoryLots).set({
            remainingQuantity: String(lc.newRemaining),
          }).where(eq(inventoryLots.id, lc.lotId));

          await postInventoryMovement({
            movementType: 'adjustment',
            movementDate: new Date().toISOString().split('T')[0],
            sourceModule: 'feed',
            sourceEntityType: 'inventory_adjustment',
            sourceEntityId: itemId,
            sourceCodeSnapshot: lc.lotCode,
            inventoryItemId: itemId,
            inventoryLotId: lc.lotId,
            quantity: -lc.quantityUsed,
            unit: item.unit,
            unitCost: lc.costPerUnit,
            lineCost: lc.lineCost,
            balanceAfterQuantity: lc.newRemaining,
            balanceScope: 'inventory_lot',
            notes: reason,
            createdBy: req.user!.id,
          });
        }
      } catch {
        // If FIFO consumption fails (e.g., no lots yet for legacy data), proceed with simple deduction
        logger.warn('FIFO deduction skipped for adjustment — no lots available', { itemId });
      }
    }

    // Update inventory quantity and recalculate weighted average cost
    const weightedAvgCost = await recalculateWeightedAverageCost(itemId);
    await db.update(feedInventory).set({
      quantity: String(newQuantity),
      costPerUnit: String(weightedAvgCost || Number(item.costPerUnit)),
      updatedAt: new Date(),
    }).where(eq(feedInventory.id, itemId));

    // Create audit trail entry
    await db.insert(inventoryAuditTrail).values({
      inventoryItemId: itemId,
      changeType: 'adjustment',
      previousQuantity: String(previousQuantity),
      changeQuantity: String(quantity),
      newQuantity: String(newQuantity),
      lotId: lotInfo?.lotId ?? null,
      costAtTime: costPerUnit ? String(costPerUnit) : null,
      performedBy: req.user!.id,
      notes: reason,
    });

    if (quantity < 0 && !usedLotLevelAdjustment) {
      await postInventoryMovement({
        movementType: 'adjustment',
        movementDate: new Date().toISOString().split('T')[0],
        sourceModule: 'feed',
        sourceEntityType: 'inventory_adjustment',
        sourceEntityId: itemId,
        inventoryItemId: itemId,
        quantity,
        unit: item.unit,
        unitCost: Number(item.costPerUnit),
        lineCost: Math.round(Math.abs(quantity) * Number(item.costPerUnit) * 100) / 100,
        balanceAfterQuantity: newQuantity,
        balanceScope: 'inventory_item',
        notes: reason,
        createdBy: req.user!.id,
      });
    }

    createAuditLog({
      userId: req.user!.id,
      action: 'inventory_adjusted',
      entityType: 'feed_inventory',
      entityId: itemId,
      changes: { previousQuantity, changeQuantity: quantity, newQuantity, reason, lotCode: lotInfo?.lotCode },
    });

    res.json({ success: true, data: { id: itemId, previousQuantity, changeQuantity: quantity, newQuantity, reason, lot: lotInfo }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to adjust inventory', { error });
    res.status(500).json({ success: false, error: 'Failed to adjust inventory', code: 'ADJUST_INVENTORY_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// GET /api/feed/inventory/reorder-suggestions — automated reorder suggestions
router.get('/inventory/reorder-suggestions', authenticate, requirePermission('feed_inventory:read'), async (req: Request, res: Response) => {
  try {
    const inventoryItems = await db.select({
      id: feedInventory.id,
      ingredientName: feedInventory.ingredientName,
      quantity: feedInventory.quantity,
      unit: feedInventory.unit,
      costPerUnit: feedInventory.costPerUnit,
      reorderLevel: feedInventory.reorderLevel,
      supplierId: feedInventory.supplierId,
      supplierName: suppliers.supplierName,
      supplierContact: suppliers.contactPerson,
      supplierPhone: suppliers.phoneNumber,
    })
      .from(feedInventory)
      .leftJoin(suppliers, eq(feedInventory.supplierId, suppliers.id));

    // Calculate upcoming demand from planned/in_progress production batches
    const pendingProductions = await db
      .select({
        productionCode: feedProductionBatches.productionCode,
        plannedQuantity: feedProductionBatches.plannedQuantity,
        recipeId: feedProductionBatches.recipeId,
        productionDate: feedProductionBatches.productionDate,
      })
      .from(feedProductionBatches)
      .where(sql`${feedProductionBatches.status} IN ('planned', 'in_progress')`);

    // Build demand map: inventoryItemId -> total needed
    const demandMap: Record<number, { total: number; batches: { code: string; qty: number; date: string }[] }> = {};
    for (const prod of pendingProductions) {
      const recipeIngredients = await db.select().from(feedRecipeIngredients).where(eq(feedRecipeIngredients.recipeId, prod.recipeId));
      const totalProportion = recipeIngredients.reduce((sum, ing) => sum + Number(ing.proportion), 0);
      for (const ing of recipeIngredients) {
        if (ing.inventoryItemId) {
          const scaledQty = (Number(ing.proportion) / totalProportion) * Number(prod.plannedQuantity);
          if (!demandMap[ing.inventoryItemId]) {
            demandMap[ing.inventoryItemId] = { total: 0, batches: [] };
          }
          demandMap[ing.inventoryItemId].total += scaledQty;
          demandMap[ing.inventoryItemId].batches.push({
            code: prod.productionCode,
            qty: Math.round(scaledQty * 100) / 100,
            date: prod.productionDate,
          });
        }
      }
    }

    const suggestions = inventoryItems
      .filter((item) => {
        const demand = demandMap[item.id]?.total || 0;
        return (item.reorderLevel && Number(item.quantity) <= Number(item.reorderLevel) * 1.2) ||
          (demand > 0 && Number(item.quantity) < demand * 1.2);
      })
      .map((item) => {
        const demand = demandMap[item.id] || { total: 0, batches: [] };
        const suggestedQty = Math.max(
          Number(item.reorderLevel || 0) * 3 - Number(item.quantity),
          demand.total * 1.2 - Number(item.quantity),
          0
        );
        return {
          inventoryItemId: item.id,
          ingredientName: item.ingredientName,
          currentQuantity: Number(item.quantity),
          reorderLevel: Number(item.reorderLevel),
          unit: item.unit,
          suggestedOrderQuantity: Math.round(suggestedQty * 100) / 100,
          estimatedCost: Math.round(suggestedQty * Number(item.costPerUnit) * 100) / 100,
          supplierId: item.supplierId,
          supplierName: item.supplierName,
          supplierContact: item.supplierContact,
          supplierPhone: item.supplierPhone,
          upcomingDemand: Math.round(demand.total * 100) / 100,
          demandBreakdown: demand.batches,
          urgency: Number(item.quantity) <= Number(item.reorderLevel || 0) * 0.5 ? 'critical' : Number(item.quantity) <= Number(item.reorderLevel) ? 'high' : 'medium',
        };
      })
      .sort((a, b) => {
        const urgencyOrder = { critical: 0, high: 1, medium: 2 };
        return (urgencyOrder[a.urgency as keyof typeof urgencyOrder] ?? 2) - (urgencyOrder[b.urgency as keyof typeof urgencyOrder] ?? 2);
      });

    res.json({ success: true, data: suggestions, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to generate reorder suggestions', { error });
    res.status(500).json({ success: false, error: 'Failed to generate reorder suggestions', code: 'REORDER_SUGGESTIONS_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// =============================================================================
// FEED PRODUCTION OPTIMIZATION (scheduling, waste, QC)
// =============================================================================

// POST /api/feed/production/:id/qc — QC checkpoint for a production batch
router.post('/production/:id/qc', authenticate, requirePermission('feed_production:update'), validate(qcCheckpointSchema), async (req: Request, res: Response) => {
  try {
    const prodId = Number(req.params.id as string);
    const { qcNotes } = req.body;

    const [production] = await db.select().from(feedProductionBatches).where(eq(feedProductionBatches.id, prodId)).limit(1);
    if (!production) {
      res.status(404).json({ success: false, error: 'Production batch not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    if (production.status !== 'in_progress') {
      res.status(400).json({ success: false, error: 'QC can only be performed on in-progress batches', code: 'INVALID_QC_STATUS', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    await db.update(feedProductionBatches).set({
      qcPassedAt: new Date(),
      qcPassedBy: req.user!.id,
      qcNotes: qcNotes || null,
      updatedAt: new Date(),
    }).where(eq(feedProductionBatches.id, prodId));

    createAuditLog({
      userId: req.user!.id,
      action: 'production_qc_passed',
      entityType: 'feed_production',
      entityId: prodId,
      changes: { qcNotes },
    });

    res.json({ success: true, data: { id: prodId, qcPassedAt: new Date().toISOString(), qcPassedBy: req.user!.id, qcNotes }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to perform QC checkpoint', { error });
    res.status(500).json({ success: false, error: 'Failed to perform QC checkpoint', code: 'QC_CHECKPOINT_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// GET /api/feed/production/schedule — get scheduled production batches
router.get('/production/schedule', authenticate, requirePermission('feed_production:read'), async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const conditions = [sql`${feedProductionBatches.status} IN ('planned', 'in_progress')`];

    if (startDate) {
      conditions.push(gte(feedProductionBatches.productionDate, startDate as string));
    }
    if (endDate) {
      conditions.push(lte(feedProductionBatches.productionDate, endDate as string));
    }

    const scheduled = await db.select({
      id: feedProductionBatches.id,
      productionCode: feedProductionBatches.productionCode,
      recipeId: feedProductionBatches.recipeId,
      recipeName: feedRecipes.recipeName,
      feedType: feedRecipes.feedType,
      plannedQuantity: feedProductionBatches.plannedQuantity,
      unit: feedProductionBatches.unit,
      status: feedProductionBatches.status,
      productionDate: feedProductionBatches.productionDate,
      scheduledDate: feedProductionBatches.scheduledDate,
      qcPassedAt: feedProductionBatches.qcPassedAt,
      notes: feedProductionBatches.notes,
    })
      .from(feedProductionBatches)
      .leftJoin(feedRecipes, eq(feedProductionBatches.recipeId, feedRecipes.id))
      .where(and(...conditions))
      .orderBy(asc(feedProductionBatches.productionDate));

    res.json({ success: true, data: scheduled, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to fetch production schedule', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch production schedule', code: 'PRODUCTION_SCHEDULE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// GET /api/feed/production/waste-summary — waste tracking summary
router.get('/production/waste-summary', authenticate, requirePermission('feed_production:read'), async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const conditions = [eq(feedProductionBatches.status, 'completed')];

    if (startDate) conditions.push(gte(feedProductionBatches.productionDate, startDate as string));
    if (endDate) conditions.push(lte(feedProductionBatches.productionDate, endDate as string));

    const productions = await db.select({
      id: feedProductionBatches.id,
      productionCode: feedProductionBatches.productionCode,
      recipeName: feedRecipes.recipeName,
      plannedQuantity: feedProductionBatches.plannedQuantity,
      actualQuantity: feedProductionBatches.actualQuantity,
      wasteQuantity: feedProductionBatches.wasteQuantity,
      wasteReason: feedProductionBatches.wasteReason,
      productionDate: feedProductionBatches.productionDate,
    })
      .from(feedProductionBatches)
      .leftJoin(feedRecipes, eq(feedProductionBatches.recipeId, feedRecipes.id))
      .where(and(...conditions))
      .orderBy(desc(feedProductionBatches.productionDate));

    const totalPlanned = productions.reduce((sum, p) => sum + Number(p.plannedQuantity || 0), 0);
    const totalActual = productions.reduce((sum, p) => sum + Number(p.actualQuantity || 0), 0);
    const totalWaste = productions.reduce((sum, p) => sum + Number(p.wasteQuantity || 0), 0);
    const wasteRate = totalPlanned > 0 ? Number(((totalWaste / totalPlanned) * 100).toFixed(2)) : 0;

    // Group waste by reason
    const wasteByReason: Record<string, number> = {};
    for (const p of productions) {
      if (p.wasteQuantity && Number(p.wasteQuantity) > 0) {
        const reason = p.wasteReason || 'Unspecified';
        wasteByReason[reason] = (wasteByReason[reason] || 0) + Number(p.wasteQuantity);
      }
    }

    res.json({
      success: true,
      data: {
        totalPlanned,
        totalActual,
        totalWaste,
        wasteRate,
        wasteByReason: Object.entries(wasteByReason).map(([reason, qty]) => ({ reason, quantity: qty })),
        productions: productions.filter((p) => Number(p.wasteQuantity || 0) > 0),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch waste summary', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch waste summary', code: 'WASTE_SUMMARY_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// =============================================================================
// PURCHASE ORDERS
// =============================================================================


// GET /api/feed/purchase-orders — list purchase orders

// GET /api/feed/purchase-orders/:id — purchase order detail with line items

// POST /api/feed/purchase-orders — create purchase order

// PUT /api/feed/purchase-orders/:id — update purchase order (draft only)

// DELETE /api/feed/purchase-orders/:id — delete purchase order (draft only, no received items)

// PUT /api/feed/purchase-orders/:id/status — submit or cancel purchase order

// POST /api/feed/purchase-orders/:id/receive — receive items from a purchase order

// GET /api/feed/suppliers/:id/purchase-orders — purchase order history for a supplier

// =============================================================================
// REPORT SCHEDULES
// =============================================================================

// GET /api/feed/report-schedules — list all report schedules
router.get('/report-schedules', authenticate, requirePermission('reports:read'), async (req: Request, res: Response) => {
  try {
    const { isActive } = req.query;
    const conditions = [];
    if (isActive !== undefined) {
      conditions.push(eq(reportSchedules.isActive, isActive === 'true'));
    }

    const schedules = conditions.length > 0
      ? await db.select().from(reportSchedules).where(and(...conditions)).orderBy(desc(reportSchedules.createdAt))
      : await db.select().from(reportSchedules).orderBy(desc(reportSchedules.createdAt));

    res.json({ success: true, data: schedules, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to fetch report schedules', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch report schedules', code: 'REPORT_SCHEDULES_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// POST /api/feed/report-schedules — create a new report schedule
router.post('/report-schedules', authenticate, requirePermission('reports:create'), validate(createReportScheduleSchema), async (req: Request, res: Response) => {
  try {
    const { reportType, scheduleName, cronExpression, filters, recipientEmails } = req.body;

    // Calculate next run time (simple cron parsing for display)
    const nextRunAt = calculateNextRun(cronExpression);

    const [schedule] = await db.insert(reportSchedules).values({
      reportType,
      scheduleName,
      cronExpression,
      filters: filters || {},
      recipientEmails: recipientEmails || [],
      createdBy: req.user!.id,
      nextRunAt,
    }).returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'report_schedule_created',
      entityType: 'report_schedule',
      entityId: schedule.id,
      changes: { reportType, scheduleName, cronExpression },
    });

    res.status(201).json({ success: true, data: schedule, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to create report schedule', { error });
    res.status(500).json({ success: false, error: 'Failed to create report schedule', code: 'CREATE_REPORT_SCHEDULE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// PUT /api/feed/report-schedules/:id — update a report schedule
router.put('/report-schedules/:id', authenticate, requirePermission('reports:update'), validate(updateReportScheduleSchema), async (req: Request, res: Response) => {
  try {
    const scheduleId = Number(req.params.id as string);
    const [existing] = await db.select().from(reportSchedules).where(eq(reportSchedules.id, scheduleId)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Report schedule not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const updateData: Record<string, unknown> = { ...req.body, updatedAt: new Date() };
    if (req.body.cronExpression) {
      updateData.nextRunAt = calculateNextRun(req.body.cronExpression);
    }

    const [updated] = await db.update(reportSchedules).set(updateData).where(eq(reportSchedules.id, scheduleId)).returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'report_schedule_updated',
      entityType: 'report_schedule',
      entityId: scheduleId,
      changes: req.body,
    });

    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to update report schedule', { error });
    res.status(500).json({ success: false, error: 'Failed to update report schedule', code: 'UPDATE_REPORT_SCHEDULE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// DELETE /api/feed/report-schedules/:id — delete a report schedule
router.delete('/report-schedules/:id', authenticate, requirePermission('reports:delete'), async (req: Request, res: Response) => {
  try {
    const scheduleId = Number(req.params.id as string);
    const [existing] = await db.select().from(reportSchedules).where(eq(reportSchedules.id, scheduleId)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Report schedule not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    await db.delete(reportSchedules).where(eq(reportSchedules.id, scheduleId));

    createAuditLog({
      userId: req.user!.id,
      action: 'report_schedule_deleted',
      entityType: 'report_schedule',
      entityId: scheduleId,
    });

    res.json({ success: true, data: { id: scheduleId }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to delete report schedule', { error });
    res.status(500).json({ success: false, error: 'Failed to delete report schedule', code: 'DELETE_REPORT_SCHEDULE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// Helper: simple next run calculation from cron expression
function calculateNextRun(cronExpression: string): Date {
  // Parse simple cron: daily @6am, weekly Monday @6am, monthly 1st @6am
  const now = new Date();
  const parts = cronExpression.split(' ');

  if (parts.length >= 5) {
    const hour = parseInt(parts[1]) || 6;
    const dayOfMonth = parts[2] !== '*' ? parseInt(parts[2]) : null;
    const dayOfWeek = parts[4] !== '*' ? parseInt(parts[4]) : null;

    const next = new Date(now);
    next.setHours(hour, 0, 0, 0);

    if (next <= now) {
      if (dayOfWeek !== null) {
        // Weekly: advance to next occurrence of that weekday
        const daysUntil = (dayOfWeek - now.getDay() + 7) % 7 || 7;
        next.setDate(next.getDate() + daysUntil);
      } else if (dayOfMonth !== null) {
        // Monthly: advance to next month
        next.setMonth(next.getMonth() + 1);
        next.setDate(dayOfMonth);
      } else {
        // Daily: advance to tomorrow
        next.setDate(next.getDate() + 1);
      }
    }
    return next;
  }

  // Fallback: tomorrow at 6am
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(6, 0, 0, 0);
  return tomorrow;
}

export default router;
