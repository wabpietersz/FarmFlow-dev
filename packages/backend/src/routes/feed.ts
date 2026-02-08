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
} from '../validators/feed';
import { db } from '../db';
import { suppliers, feedRecipes, feedRecipeIngredients, feedInventory } from '../db/schema';
import { eq, and, ilike, sql, desc } from 'drizzle-orm';
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
      // Soft delete is safe even with linked inventory — just mark inactive
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

// =============================================================================
// RECIPES CRUD
// =============================================================================

// GET /api/feed/recipes — list all recipes
router.get('/recipes', authenticate, requirePermission('feed_production:read'), async (req: Request, res: Response) => {
  try {
    const { feedType, status, search, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    let query = db.select().from(feedRecipes).$dynamic();

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

    const ingredients = await db
      .select()
      .from(feedRecipeIngredients)
      .where(eq(feedRecipeIngredients.recipeId, recipeId));

    res.json({
      success: true,
      data: { recipe, ingredients },
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

    // Insert ingredients
    if (ingredients && ingredients.length > 0) {
      await db.insert(feedRecipeIngredients).values(
        ingredients.map((ing: { ingredientName: string; supplierId?: number | null; proportion: number; unit: string }) => ({
          recipeId: newRecipe.id,
          ingredientName: ing.ingredientName,
          supplierId: ing.supplierId || null,
          proportion: String(ing.proportion),
          unit: ing.unit,
        })),
      );
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
      // Delete existing ingredients
      await db.delete(feedRecipeIngredients).where(eq(feedRecipeIngredients.recipeId, recipeId));

      // Insert new ingredients
      if (ingredients.length > 0) {
        await db.insert(feedRecipeIngredients).values(
          ingredients.map((ing: { ingredientName: string; supplierId?: number | null; proportion: number; unit: string }) => ({
            recipeId,
            ingredientName: ing.ingredientName,
            supplierId: ing.supplierId || null,
            proportion: String(ing.proportion),
            unit: ing.unit,
          })),
        );
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

// DELETE /api/feed/recipes/:id — soft delete
router.delete('/recipes/:id', authenticate, requirePermission('feed_production:delete'), async (req: Request, res: Response) => {
  try {
    const recipeId = Number(req.params.id as string);

    const [existing] = await db.select().from(feedRecipes).where(eq(feedRecipes.id, recipeId)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Recipe not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const [updated] = await db
      .update(feedRecipes)
      .set({ status: 'inactive', updatedAt: new Date() })
      .where(eq(feedRecipes.id, recipeId))
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'recipe_deactivated',
      entityType: 'feed_recipe',
      entityId: recipeId,
      changes: { before: { status: 'active' }, after: { status: 'inactive' } },
    });

    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to deactivate recipe', { error });
    res.status(500).json({ success: false, error: 'Failed to deactivate recipe', code: 'DELETE_RECIPE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
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

    let query = db.select().from(feedInventory).$dynamic();

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

    const [newItem] = await db
      .insert(feedInventory)
      .values({
        ingredientName,
        supplierId: supplierId || null,
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

export default router;
