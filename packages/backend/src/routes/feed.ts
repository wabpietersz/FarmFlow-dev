import { Router, type Request, type Response } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate } from '../validators/auth';
import {
  createSupplierSchema,
  updateSupplierSchema,
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
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  updatePurchaseOrderStatusSchema,
  receivePurchaseOrderSchema,
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
  purchaseOrders,
  purchaseOrderItems,
  reportSchedules,
  batches,
} from '../db/schema';
import { eq, and, ilike, sql, desc, sum, gte, lte, asc } from 'drizzle-orm';
import { createAuditLog } from '../lib/audit';
import logger from '../lib/logger';

const router = Router();

// =============================================================================
// SUPPLIERS CRUD
// =============================================================================

// GET /api/feed/suppliers — list all suppliers
router.get('/suppliers', authenticate, requirePermission('feed_inventory:read'), async (req: Request, res: Response) => {
  try {
    const { status, search, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    let query = db.select().from(suppliers).$dynamic();

    const conditions = [];
    if (status && status !== 'all') {
      conditions.push(eq(suppliers.status, status as string));
    }
    if (search) {
      conditions.push(ilike(suppliers.supplierName, `%${search as string}%`));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query
      .orderBy(desc(suppliers.createdAt))
      .limit(limitNum)
      .offset(offset);

    let countQuery = db.select({ total: sql<number>`count(*)::int` }).from(suppliers).$dynamic();
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
    logger.error('Failed to fetch suppliers', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch suppliers', code: 'SUPPLIERS_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// GET /api/feed/suppliers/:id — supplier detail
router.get('/suppliers/:id', authenticate, requirePermission('feed_inventory:read'), async (req: Request, res: Response) => {
  try {
    const supplierId = Number(req.params.id as string);

    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);
    if (!supplier) {
      res.status(404).json({ success: false, error: 'Supplier not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    res.json({
      success: true,
      data: supplier,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch supplier detail', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch supplier detail', code: 'SUPPLIER_DETAIL_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// POST /api/feed/suppliers — create supplier
router.post('/suppliers', authenticate, requirePermission('feed_inventory:create'), validate(createSupplierSchema), async (req: Request, res: Response) => {
  try {
    const { supplierName, contactPerson, phoneNumber, email, address } = req.body;

    // Check unique supplier name
    const [existing] = await db.select().from(suppliers).where(eq(suppliers.supplierName, supplierName)).limit(1);
    if (existing) {
      res.status(409).json({ success: false, error: 'A supplier with this name already exists', code: 'SUPPLIER_NAME_EXISTS', statusCode: 409, timestamp: new Date().toISOString() });
      return;
    }

    const [newSupplier] = await db
      .insert(suppliers)
      .values({
        supplierName,
        contactPerson: contactPerson || null,
        phoneNumber: phoneNumber || null,
        email: email || null,
        address: address || null,
        status: 'active',
      })
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'supplier_created',
      entityType: 'supplier',
      entityId: newSupplier.id,
      changes: { supplierName, contactPerson },
    });

    res.status(201).json({ success: true, data: newSupplier, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to create supplier', { error });
    res.status(500).json({ success: false, error: 'Failed to create supplier', code: 'CREATE_SUPPLIER_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// PUT /api/feed/suppliers/:id — update supplier
router.put('/suppliers/:id', authenticate, requirePermission('feed_inventory:update'), validate(updateSupplierSchema), async (req: Request, res: Response) => {
  try {
    const supplierId = Number(req.params.id as string);

    const [existing] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Supplier not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    // If supplierName is changing, check uniqueness
    if (req.body.supplierName && req.body.supplierName !== existing.supplierName) {
      const [duplicate] = await db.select().from(suppliers).where(eq(suppliers.supplierName, req.body.supplierName)).limit(1);
      if (duplicate) {
        res.status(409).json({ success: false, error: 'A supplier with this name already exists', code: 'SUPPLIER_NAME_EXISTS', statusCode: 409, timestamp: new Date().toISOString() });
        return;
      }
    }

    const [updated] = await db
      .update(suppliers)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(suppliers.id, supplierId))
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'supplier_updated',
      entityType: 'supplier',
      entityId: supplierId,
      changes: { before: { supplierName: existing.supplierName, status: existing.status }, after: req.body },
    });

    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to update supplier', { error });
    res.status(500).json({ success: false, error: 'Failed to update supplier', code: 'UPDATE_SUPPLIER_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// DELETE /api/feed/suppliers/:id — soft delete (deactivate)
router.delete('/suppliers/:id', authenticate, requirePermission('feed_inventory:delete'), async (req: Request, res: Response) => {
  try {
    const supplierId = Number(req.params.id as string);

    const [existing] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Supplier not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    // Check for inventory items using this supplier
    const [linkedInventory] = await db
      .select({ id: feedInventory.id })
      .from(feedInventory)
      .where(eq(feedInventory.supplierId, supplierId))
      .limit(1);

    if (linkedInventory) {
      res.status(409).json({ success: false, error: 'Cannot deactivate supplier with active inventory items. Reassign inventory first.', code: 'SUPPLIER_HAS_INVENTORY', statusCode: 409, timestamp: new Date().toISOString() });
      return;
    }

    const [updated] = await db
      .update(suppliers)
      .set({ status: 'inactive', updatedAt: new Date() })
      .where(eq(suppliers.id, supplierId))
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'supplier_deactivated',
      entityType: 'supplier',
      entityId: supplierId,
      changes: { before: { status: 'active' }, after: { status: 'inactive' } },
    });

    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to deactivate supplier', { error });
    res.status(500).json({ success: false, error: 'Failed to deactivate supplier', code: 'DELETE_SUPPLIER_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// GET /api/feed/suppliers/:id/inventory — inventory items for a supplier
router.get('/suppliers/:id/inventory', authenticate, requirePermission('feed_inventory:read'), async (req: Request, res: Response) => {
  try {
    const supplierId = Number(req.params.id as string);
    const items = await db.select().from(feedInventory).where(eq(feedInventory.supplierId, supplierId)).orderBy(desc(feedInventory.createdAt));
    res.json({ success: true, data: items, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to fetch supplier inventory', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch supplier inventory', code: 'SUPPLIER_INVENTORY_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

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
        ingredientCount: sql<number>`(SELECT count(*)::int FROM ${feedRecipeIngredients} WHERE ${feedRecipeIngredients.recipeId} = feed_recipes.id)`,
        ingredientSummary: sql<string>`(
          SELECT string_agg(${feedRecipeIngredients.ingredientName}, ', ' ORDER BY ${feedRecipeIngredients.proportion} DESC)
          FROM ${feedRecipeIngredients}
          WHERE ${feedRecipeIngredients.recipeId} = feed_recipes.id
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
router.get('/recipes/:id', authenticate, requirePermission('feed_production:read'), async (req: Request, res: Response) => {
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
      .leftJoin(suppliers, eq(feedInventory.supplierId, suppliers.id))
      .$dynamic();

    const conditions = [];
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

    let countQuery = db.select({ total: sql<number>`count(*)::int` }).from(feedInventory).$dynamic();
    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions));
    }
    const [{ total }] = await countQuery;

    // Add low-stock flag
    const dataWithFlag = results.map((item) => ({
      ...item,
      lowStock: item.reorderLevel ? Number(item.quantity) < Number(item.reorderLevel) : false,
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

    const [newItem] = await db
      .insert(feedInventory)
      .values({
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
router.get('/production/:id', authenticate, requirePermission('feed_production:read'), async (req: Request, res: Response) => {
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
        unit: feedProductionMaterials.unit,
        availableQuantity: feedInventory.quantity,
        costPerUnit: feedInventory.costPerUnit,
      })
      .from(feedProductionMaterials)
      .leftJoin(feedInventory, eq(feedProductionMaterials.inventoryItemId, feedInventory.id))
      .where(eq(feedProductionMaterials.productionBatchId, prodId));

    // Get total distributed from this production
    const [distributed] = await db
      .select({ total: sql<number>`coalesce(sum(${feedDistributions.quantity}::numeric), 0)::numeric` })
      .from(feedDistributions)
      .where(eq(feedDistributions.productionBatchId, prodId));

    res.json({
      success: true,
      data: {
        production,
        materials,
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
    let totalCost = 0;
    const inventoryDeductions: { id: number; currentQty: number; deductQty: number; costPerUnit: number }[] = [];

    for (const mat of materialUpdates as { inventoryItemId: number; actualQuantity: number }[]) {
      const [invItem] = await db.select().from(feedInventory).where(eq(feedInventory.id, mat.inventoryItemId)).limit(1);
      if (!invItem) {
        res.status(404).json({ success: false, error: `Inventory item ${mat.inventoryItemId} not found`, code: 'INVENTORY_NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
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

      totalCost += mat.actualQuantity * Number(invItem.costPerUnit);
      inventoryDeductions.push({
        id: invItem.id,
        currentQty: Number(invItem.quantity),
        deductQty: mat.actualQuantity,
        costPerUnit: Number(invItem.costPerUnit),
      });
    }

    // Deduct from inventory and create audit trail entries
    for (const ded of inventoryDeductions) {
      await db
        .update(feedInventory)
        .set({
          quantity: String(ded.currentQty - ded.deductQty),
          updatedAt: new Date(),
        })
        .where(eq(feedInventory.id, ded.id));

      // Create audit trail entry for each deduction
      await db.insert(inventoryAuditTrail).values({
        inventoryItemId: ded.id,
        changeType: 'production_deduction',
        previousQuantity: String(ded.currentQty),
        changeQuantity: String(-ded.deductQty),
        newQuantity: String(ded.currentQty - ded.deductQty),
        referenceId: prodId,
        referenceType: 'production_batch',
        notes: `Production ${existing.productionCode}`,
        performedBy: req.user!.id,
      });
    }

    // Update material actual quantities
    for (const mat of materialUpdates as { inventoryItemId: number; actualQuantity: number }[]) {
      await db
        .update(feedProductionMaterials)
        .set({ actualQuantity: String(mat.actualQuantity) })
        .where(
          and(
            eq(feedProductionMaterials.productionBatchId, prodId),
            eq(feedProductionMaterials.inventoryItemId, mat.inventoryItemId),
          ),
        );
    }

    // Update production batch
    const [updated] = await db
      .update(feedProductionBatches)
      .set({
        status: 'completed',
        actualQuantity: String(actualQuantity),
        productionCost: String(Math.round(totalCost * 100) / 100),
        updatedAt: new Date(),
      })
      .where(eq(feedProductionBatches.id, prodId))
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'production_completed',
      entityType: 'feed_production',
      entityId: prodId,
      changes: {
        actualQuantity,
        productionCost: Math.round(totalCost * 100) / 100,
        materialsConsumed: materialUpdates.length,
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

    let countQuery = db.select({ total: sql<number>`count(*)::int` }).from(feedDistributions).$dynamic();
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
      const [distributed] = await db
        .select({ total: sql<number>`coalesce(sum(${feedDistributions.quantity}::numeric), 0)::numeric` })
        .from(feedDistributions)
        .where(eq(feedDistributions.productionBatchId, productionBatchId));

      const available = Number(prodBatch.actualQuantity) - Number(distributed?.total ?? 0);
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
        // Find cheaper alternative in inventory for the same ingredient type
        const alternatives = inventoryItems.filter(
          (inv) => inv.ingredientName !== ing.ingredientName && Number(inv.costPerUnit) < Number(recipe.cost) * Number(ing.proportion) / 100
        );

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

// POST /api/feed/inventory/:id/adjust — manual inventory adjustment with audit trail
router.post('/inventory/:id/adjust', authenticate, requirePermission('feed_inventory:update'), validate(inventoryAdjustmentSchema), async (req: Request, res: Response) => {
  try {
    const itemId = Number(req.params.id as string);
    const { quantity, reason } = req.body;

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

    // Update inventory
    await db.update(feedInventory).set({
      quantity: String(newQuantity),
      updatedAt: new Date(),
    }).where(eq(feedInventory.id, itemId));

    // Create audit trail entry
    await db.insert(inventoryAuditTrail).values({
      inventoryItemId: itemId,
      changeType: 'adjustment',
      previousQuantity: String(previousQuantity),
      changeQuantity: String(quantity),
      newQuantity: String(newQuantity),
      performedBy: req.user!.id,
    });

    createAuditLog({
      userId: req.user!.id,
      action: 'inventory_adjusted',
      entityType: 'feed_inventory',
      entityId: itemId,
      changes: { previousQuantity, changeQuantity: quantity, newQuantity, reason },
    });

    res.json({ success: true, data: { id: itemId, previousQuantity, changeQuantity: quantity, newQuantity, reason }, timestamp: new Date().toISOString() });
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

// Helper: generate PO code PO-YYYYMMDD-XXX
async function generatePOCode(date: string): Promise<string> {
  const dateStr = date.replace(/-/g, '').slice(0, 8);
  const prefix = `PO-${dateStr}-`;
  const [result] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(purchaseOrders)
    .where(ilike(purchaseOrders.orderCode, `${prefix}%`));
  const seq = String((result?.total ?? 0) + 1).padStart(3, '0');
  return `${prefix}${seq}`;
}

// GET /api/feed/purchase-orders — list purchase orders
router.get('/purchase-orders', authenticate, requirePermission('feed_inventory:read'), async (req: Request, res: Response) => {
  try {
    const { status, supplierId, search, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    let query = db
      .select({
        id: purchaseOrders.id,
        orderCode: purchaseOrders.orderCode,
        supplierId: purchaseOrders.supplierId,
        supplierName: suppliers.supplierName,
        orderDate: purchaseOrders.orderDate,
        expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
        actualDeliveryDate: purchaseOrders.actualDeliveryDate,
        status: purchaseOrders.status,
        totalCost: purchaseOrders.totalCost,
        notes: purchaseOrders.notes,
        createdBy: purchaseOrders.createdBy,
        createdAt: purchaseOrders.createdAt,
        updatedAt: purchaseOrders.updatedAt,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .$dynamic();

    const conditions = [];
    if (status && status !== 'all') {
      conditions.push(eq(purchaseOrders.status, status as string));
    }
    if (supplierId) {
      conditions.push(eq(purchaseOrders.supplierId, Number(supplierId)));
    }
    if (search) {
      conditions.push(ilike(purchaseOrders.orderCode, `%${search as string}%`));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(limitNum)
      .offset(offset);

    let countQuery = db.select({ total: sql<number>`count(*)::int` }).from(purchaseOrders).$dynamic();
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
    logger.error('Failed to fetch purchase orders', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch purchase orders', code: 'PO_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// GET /api/feed/purchase-orders/:id — purchase order detail with line items
router.get('/purchase-orders/:id', authenticate, requirePermission('feed_inventory:read'), async (req: Request, res: Response) => {
  try {
    const poId = Number(req.params.id as string);

    const [po] = await db
      .select({
        id: purchaseOrders.id,
        orderCode: purchaseOrders.orderCode,
        supplierId: purchaseOrders.supplierId,
        supplierName: suppliers.supplierName,
        orderDate: purchaseOrders.orderDate,
        expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
        actualDeliveryDate: purchaseOrders.actualDeliveryDate,
        status: purchaseOrders.status,
        totalCost: purchaseOrders.totalCost,
        notes: purchaseOrders.notes,
        createdBy: purchaseOrders.createdBy,
        createdAt: purchaseOrders.createdAt,
        updatedAt: purchaseOrders.updatedAt,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(eq(purchaseOrders.id, poId))
      .limit(1);

    if (!po) {
      res.status(404).json({ success: false, error: 'Purchase order not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    // Fetch line items with inventory details
    const items = await db
      .select({
        id: purchaseOrderItems.id,
        purchaseOrderId: purchaseOrderItems.purchaseOrderId,
        inventoryItemId: purchaseOrderItems.inventoryItemId,
        ingredientName: feedInventory.ingredientName,
        orderedQuantity: purchaseOrderItems.orderedQuantity,
        unitPrice: purchaseOrderItems.unitPrice,
        receivedQuantity: purchaseOrderItems.receivedQuantity,
        unit: purchaseOrderItems.unit,
        notes: purchaseOrderItems.notes,
      })
      .from(purchaseOrderItems)
      .leftJoin(feedInventory, eq(purchaseOrderItems.inventoryItemId, feedInventory.id))
      .where(eq(purchaseOrderItems.purchaseOrderId, poId));

    const itemsWithPercentage = items.map((item) => ({
      ...item,
      receivedPercentage: Number(item.orderedQuantity) > 0
        ? Math.round((Number(item.receivedQuantity) / Number(item.orderedQuantity)) * 10000) / 100
        : 0,
    }));

    res.json({
      success: true,
      data: { purchaseOrder: po, items: itemsWithPercentage },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch purchase order detail', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch purchase order detail', code: 'PO_DETAIL_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// POST /api/feed/purchase-orders — create purchase order
router.post('/purchase-orders', authenticate, requirePermission('feed_inventory:create'), validate(createPurchaseOrderSchema), async (req: Request, res: Response) => {
  try {
    const { supplierId, orderDate, expectedDeliveryDate, notes, items } = req.body;

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

    // Validate each item's inventoryItemId exists
    for (const item of items as { inventoryItemId: number; orderedQuantity: number; unitPrice: number; unit: string; notes?: string | null }[]) {
      const [invItem] = await db.select().from(feedInventory).where(eq(feedInventory.id, item.inventoryItemId)).limit(1);
      if (!invItem) {
        res.status(400).json({ success: false, error: `Inventory item ${item.inventoryItemId} not found`, code: 'INVALID_INVENTORY_ITEM', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }
    }

    // Auto-generate order code
    const orderCode = await generatePOCode(orderDate);

    // Calculate total cost
    const totalCost = (items as { orderedQuantity: number; unitPrice: number }[]).reduce(
      (sum, item) => sum + item.orderedQuantity * item.unitPrice,
      0
    );

    // Insert purchase order
    const [newPO] = await db
      .insert(purchaseOrders)
      .values({
        orderCode,
        supplierId,
        orderDate,
        expectedDeliveryDate: expectedDeliveryDate || null,
        status: 'draft',
        totalCost: String(Math.round(totalCost * 100) / 100),
        notes: notes || null,
        createdBy: req.user!.id,
      })
      .returning();

    // Insert line items
    await db.insert(purchaseOrderItems).values(
      (items as { inventoryItemId: number; orderedQuantity: number; unitPrice: number; unit: string; notes?: string | null }[]).map((item) => ({
        purchaseOrderId: newPO.id,
        inventoryItemId: item.inventoryItemId,
        orderedQuantity: String(item.orderedQuantity),
        unitPrice: String(item.unitPrice),
        unit: item.unit,
        notes: item.notes || null,
      })),
    );

    // Fetch inserted items
    const insertedItems = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, newPO.id));

    createAuditLog({
      userId: req.user!.id,
      action: 'purchase_order_created',
      entityType: 'purchase_order',
      entityId: newPO.id,
      changes: { orderCode, supplierId, totalCost: Math.round(totalCost * 100) / 100, itemCount: items.length },
    });

    res.status(201).json({ success: true, data: { purchaseOrder: newPO, items: insertedItems }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to create purchase order', { error });
    res.status(500).json({ success: false, error: 'Failed to create purchase order', code: 'CREATE_PO_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// PUT /api/feed/purchase-orders/:id — update purchase order (draft only)
router.put('/purchase-orders/:id', authenticate, requirePermission('feed_inventory:update'), validate(updatePurchaseOrderSchema), async (req: Request, res: Response) => {
  try {
    const poId = Number(req.params.id as string);

    const [existing] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Purchase order not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    if (existing.status !== 'draft') {
      res.status(400).json({ success: false, error: 'Can only update draft purchase orders', code: 'PO_NOT_DRAFT', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    const { items, ...headerFields } = req.body;

    // Update header fields
    const updateData: Record<string, unknown> = { ...headerFields, updatedAt: new Date() };
    const [updated] = await db
      .update(purchaseOrders)
      .set(updateData)
      .where(eq(purchaseOrders.id, poId))
      .returning();

    // Replace items if provided
    if (items) {
      await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, poId));

      if (items.length > 0) {
        // Validate each item's inventoryItemId
        for (const item of items as { inventoryItemId: number; orderedQuantity: number; unitPrice: number; unit: string; notes?: string | null }[]) {
          const [invItem] = await db.select().from(feedInventory).where(eq(feedInventory.id, item.inventoryItemId)).limit(1);
          if (!invItem) {
            res.status(400).json({ success: false, error: `Inventory item ${item.inventoryItemId} not found`, code: 'INVALID_INVENTORY_ITEM', statusCode: 400, timestamp: new Date().toISOString() });
            return;
          }
        }

        await db.insert(purchaseOrderItems).values(
          (items as { inventoryItemId: number; orderedQuantity: number; unitPrice: number; unit: string; notes?: string | null }[]).map((item) => ({
            purchaseOrderId: poId,
            inventoryItemId: item.inventoryItemId,
            orderedQuantity: String(item.orderedQuantity),
            unitPrice: String(item.unitPrice),
            unit: item.unit,
            notes: item.notes || null,
          })),
        );

        // Recalculate total cost
        const totalCost = (items as { orderedQuantity: number; unitPrice: number }[]).reduce(
          (sum, item) => sum + item.orderedQuantity * item.unitPrice,
          0
        );
        await db.update(purchaseOrders).set({ totalCost: String(Math.round(totalCost * 100) / 100) }).where(eq(purchaseOrders.id, poId));
      }
    }

    const updatedItems = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, poId));
    const [freshPO] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)).limit(1);

    createAuditLog({
      userId: req.user!.id,
      action: 'purchase_order_updated',
      entityType: 'purchase_order',
      entityId: poId,
      changes: { before: { notes: existing.notes }, after: req.body },
    });

    res.json({ success: true, data: { purchaseOrder: freshPO, items: updatedItems }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to update purchase order', { error });
    res.status(500).json({ success: false, error: 'Failed to update purchase order', code: 'UPDATE_PO_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// DELETE /api/feed/purchase-orders/:id — delete purchase order (draft only, no received items)
router.delete('/purchase-orders/:id', authenticate, requirePermission('feed_inventory:delete'), async (req: Request, res: Response) => {
  try {
    const poId = Number(req.params.id as string);

    const [existing] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Purchase order not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    if (existing.status !== 'draft') {
      res.status(400).json({ success: false, error: 'Can only delete draft purchase orders', code: 'PO_NOT_DRAFT', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    // Check no received items
    const [receivedCheck] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(purchaseOrderItems)
      .where(and(eq(purchaseOrderItems.purchaseOrderId, poId), sql`${purchaseOrderItems.receivedQuantity}::numeric > 0`));

    if ((receivedCheck?.total ?? 0) > 0) {
      res.status(400).json({ success: false, error: 'Cannot delete purchase order with received items', code: 'PO_HAS_RECEIVED', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    // Cascade delete (items have onDelete cascade)
    await db.delete(purchaseOrders).where(eq(purchaseOrders.id, poId));

    createAuditLog({
      userId: req.user!.id,
      action: 'purchase_order_deleted',
      entityType: 'purchase_order',
      entityId: poId,
      changes: { orderCode: existing.orderCode, status: existing.status },
    });

    res.json({ success: true, data: { id: poId }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to delete purchase order', { error });
    res.status(500).json({ success: false, error: 'Failed to delete purchase order', code: 'DELETE_PO_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// PUT /api/feed/purchase-orders/:id/status — submit or cancel purchase order
router.put('/purchase-orders/:id/status', authenticate, requirePermission('feed_inventory:update'), validate(updatePurchaseOrderStatusSchema), async (req: Request, res: Response) => {
  try {
    const poId = Number(req.params.id as string);
    const { status: newStatus } = req.body;

    const [existing] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Purchase order not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    // Validate transitions
    if (newStatus === 'submitted') {
      if (existing.status !== 'draft') {
        res.status(400).json({ success: false, error: 'Can only submit draft purchase orders', code: 'INVALID_PO_TRANSITION', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }
    } else if (newStatus === 'cancelled') {
      if (!['draft', 'submitted'].includes(existing.status)) {
        res.status(400).json({ success: false, error: 'Can only cancel draft or submitted purchase orders', code: 'INVALID_PO_TRANSITION', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }
      // Block cancel if any items have been received
      const [receivedCheck] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(purchaseOrderItems)
        .where(and(eq(purchaseOrderItems.purchaseOrderId, poId), sql`${purchaseOrderItems.receivedQuantity}::numeric > 0`));

      if ((receivedCheck?.total ?? 0) > 0) {
        res.status(400).json({ success: false, error: 'Cannot cancel purchase order with received items', code: 'PO_HAS_RECEIVED', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }
    }

    const [updated] = await db
      .update(purchaseOrders)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(purchaseOrders.id, poId))
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'purchase_order_status_updated',
      entityType: 'purchase_order',
      entityId: poId,
      changes: { before: { status: existing.status }, after: { status: newStatus } },
    });

    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to update purchase order status', { error });
    res.status(500).json({ success: false, error: 'Failed to update purchase order status', code: 'UPDATE_PO_STATUS_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// POST /api/feed/purchase-orders/:id/receive — receive items from a purchase order
router.post('/purchase-orders/:id/receive', authenticate, requirePermission('feed_inventory:update'), validate(receivePurchaseOrderSchema), async (req: Request, res: Response) => {
  try {
    const poId = Number(req.params.id as string);
    const { items: receiveItems } = req.body;

    const [existing] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Purchase order not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    if (!['submitted', 'partially_received'].includes(existing.status)) {
      res.status(400).json({ success: false, error: 'Purchase order must be submitted or partially received to receive items', code: 'INVALID_PO_STATUS', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    const receivedItemIds: number[] = [];

    for (const receiveItem of receiveItems as { itemId: number; receivedQuantity: number }[]) {
      // Fetch the PO line item
      const [poItem] = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.id, receiveItem.itemId)).limit(1);
      if (!poItem) {
        res.status(404).json({ success: false, error: `Purchase order item ${receiveItem.itemId} not found`, code: 'PO_ITEM_NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
        return;
      }
      if (poItem.purchaseOrderId !== poId) {
        res.status(400).json({ success: false, error: `Item ${receiveItem.itemId} does not belong to this purchase order`, code: 'PO_ITEM_MISMATCH', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }

      const newReceivedQty = Number(poItem.receivedQuantity) + receiveItem.receivedQuantity;
      if (newReceivedQty > Number(poItem.orderedQuantity)) {
        res.status(400).json({
          success: false,
          error: `Received quantity (${newReceivedQty}) would exceed ordered quantity (${poItem.orderedQuantity}) for item ${receiveItem.itemId}`,
          code: 'EXCEEDS_ORDERED_QTY',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Update PO item received quantity
      await db.update(purchaseOrderItems).set({
        receivedQuantity: String(newReceivedQty),
      }).where(eq(purchaseOrderItems.id, receiveItem.itemId));

      // Auto-restock inventory
      const [invItem] = await db.select().from(feedInventory).where(eq(feedInventory.id, poItem.inventoryItemId)).limit(1);
      if (invItem) {
        const prevQty = Number(invItem.quantity);
        const newQty = prevQty + receiveItem.receivedQuantity;
        await db.update(feedInventory).set({
          quantity: String(newQty),
          lastRestockDate: new Date().toISOString().split('T')[0],
          costPerUnit: poItem.unitPrice, // Update cost from PO price
          updatedAt: new Date(),
        }).where(eq(feedInventory.id, poItem.inventoryItemId));

        // Create audit trail entry
        await db.insert(inventoryAuditTrail).values({
          inventoryItemId: poItem.inventoryItemId,
          changeType: 'purchase_receive',
          previousQuantity: String(prevQty),
          changeQuantity: String(receiveItem.receivedQuantity),
          newQuantity: String(newQty),
          referenceId: poId,
          referenceType: 'purchase_order',
          notes: `PO ${existing.orderCode} item received`,
          performedBy: req.user!.id,
        });
      }

      receivedItemIds.push(receiveItem.itemId);
    }

    // Determine PO status: partially_received or received
    const allItems = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, poId));
    const allFullyReceived = allItems.every((item) => Number(item.receivedQuantity) >= Number(item.orderedQuantity));
    const anyReceived = allItems.some((item) => Number(item.receivedQuantity) > 0);

    const newStatus = allFullyReceived ? 'received' : (anyReceived ? 'partially_received' : existing.status);

    const poUpdateData: Record<string, unknown> = { status: newStatus, updatedAt: new Date() };
    // Set actualDeliveryDate on first receive
    if (!existing.actualDeliveryDate) {
      poUpdateData.actualDeliveryDate = new Date().toISOString().split('T')[0];
    }

    const [updatedPO] = await db.update(purchaseOrders).set(poUpdateData).where(eq(purchaseOrders.id, poId)).returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'purchase_order_received',
      entityType: 'purchase_order',
      entityId: poId,
      changes: { receivedItems: receivedItemIds, newStatus, previousStatus: existing.status },
    });

    res.json({ success: true, data: updatedPO, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to receive purchase order items', { error });
    res.status(500).json({ success: false, error: 'Failed to receive purchase order items', code: 'PO_RECEIVE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// GET /api/feed/suppliers/:id/purchase-orders — purchase order history for a supplier
router.get('/suppliers/:id/purchase-orders', authenticate, requirePermission('feed_inventory:read'), async (req: Request, res: Response) => {
  try {
    const supplierId = Number(req.params.id as string);
    const { page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    const results = await db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.supplierId, supplierId))
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(limitNum)
      .offset(offset);

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.supplierId, supplierId));

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
    logger.error('Failed to fetch supplier purchase orders', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch supplier purchase orders', code: 'SUPPLIER_PO_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

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
