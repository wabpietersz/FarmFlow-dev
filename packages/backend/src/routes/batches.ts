import { Router, type Request, type Response } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate } from '../validators/auth';
import { createBatchSchema, updateBatchSchema, createChickPlacementSchema, createDailyRecordSchema, updateDailyRecordSchema, recordMortalitySchema, createVaccinationSchema } from '../validators/batch';
import { db } from '../db';
import { batches, cages, sites, dailyRecords, vaccinations, batchInventoryConsumptions, chickPlacements, feedInventory, inventoryAuditTrail, inventoryItemTypes, inventoryLots, purchaseOrderItems, supplierContracts, suppliers } from '../db/schema';
import { eq, sql, and, desc, asc } from 'drizzle-orm';
import { createAuditLog } from '../lib/audit';
import logger from '../lib/logger';
import { BatchCloseError, buildSingleBatchCostSummary, closeBatch, getBatchPerformance, reopenBatch } from '../lib/batch-costs';
import { buildCostingModel } from '../lib/costing';
import { FarmOpsError, applyHealthTemplate, recordVaccination } from '../lib/batch-health';
import { setUpNewBatch, startTurnaroundForBatch } from '../lib/farm-ops';
import { closeBatchSchema } from '../validators/batch';
import { postInventoryMovement } from '../lib/inventory-movements';
import { assertPeriodOpen } from '../lib/period-locks';

const router = Router();

// GET /api/batches — list all batches
router.get('/', authenticate, requirePermission('batches:read'), async (req: Request, res: Response) => {
  try {
    const { status, siteId, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    let query = db
      .select({
        id: batches.id,
        batchCode: batches.batchCode,
        siteId: batches.siteId,
        siteName: sites.siteName,
        cageId: batches.cageId,
        cageNumber: cages.cageNumber,
        chicksPlaced: batches.chicksPlaced,
        placementDate: batches.placementDate,
        expectedDeliveryDate: batches.expectedDeliveryDate,
        actualDeliveryDate: batches.actualDeliveryDate,
        status: batches.status,
        notes: batches.notes,
        createdAt: batches.createdAt,
        updatedAt: batches.updatedAt,
      })
      .from(batches)
      .leftJoin(sites, eq(batches.siteId, sites.id))
      .leftJoin(cages, eq(batches.cageId, cages.id))
      .$dynamic();

    const conditions = [];
    if (status && status !== 'all') {
      conditions.push(eq(batches.status, status as string));
    }
    if (siteId) {
      conditions.push(eq(batches.siteId, Number(siteId)));
    }

    // Apply site restriction for farm managers
    if (req.user!.siteId) {
      conditions.push(eq(batches.siteId, req.user!.siteId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query
      .orderBy(desc(batches.createdAt))
      .limit(limitNum)
      .offset(offset);

    // Get total count
    let countQuery = db.select({ total: sql<number>`count(*)::int` }).from(batches).$dynamic();
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
    logger.error('Failed to fetch batches', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch batches', code: 'BATCHES_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// GET /api/batches/:id — batch detail with recent records
// GET /api/batches/costing/overview — how each month's farm, admin and mill costs were absorbed into batches
router.get('/costing/overview', authenticate, requirePermission('batches:read'), async (req: Request, res: Response) => {
  try {
    const from = typeof req.query.from === 'string' ? req.query.from.slice(0, 7) : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to.slice(0, 7) : undefined;
    const model = await buildCostingModel();
    const inRange = (month: string) => (!from || month >= from) && (!to || month <= to);
    const siteRows = await db.select({ id: sites.id, siteName: sites.siteName }).from(sites);
    const siteNames = new Map(siteRows.map((site) => [site.id, site.siteName]));
    res.json({
      success: true,
      data: {
        pools: model.pools.filter((pool) => inRange(pool.month)).map((pool) => ({
          ...pool,
          label: pool.kind === 'site' ? siteNames.get(pool.siteId ?? 0) ?? `Site ${pool.siteId}` : pool.kind === 'mill' ? 'Feed Mill' : 'Admin / shared',
        })),
        mill: [...model.mill.values()].filter((month) => inRange(month.month)).sort((a, b) => a.month.localeCompare(b.month)),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to build costing overview', { error });
    res.status(500).json({ success: false, error: 'Failed to build costing overview', code: 'COSTING_OVERVIEW_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.get('/:id', authenticate, requirePermission('batches:read'), async (req: Request, res: Response) => {
  try {
    const batchId = Number(req.params.id as string);

    const [batch] = await db
      .select({
        id: batches.id,
        batchCode: batches.batchCode,
        siteId: batches.siteId,
        siteName: sites.siteName,
        cageId: batches.cageId,
        cageNumber: cages.cageNumber,
        chicksPlaced: batches.chicksPlaced,
        placementDate: batches.placementDate,
        expectedDeliveryDate: batches.expectedDeliveryDate,
        actualDeliveryDate: batches.actualDeliveryDate,
        status: batches.status,
        notes: batches.notes,
        createdAt: batches.createdAt,
        updatedAt: batches.updatedAt,
      })
      .from(batches)
      .leftJoin(sites, eq(batches.siteId, sites.id))
      .leftJoin(cages, eq(batches.cageId, cages.id))
      .where(eq(batches.id, batchId))
      .limit(1);

    if (!batch) {
      res.status(404).json({ success: false, error: 'Batch not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    // Get recent daily records
    const records = await db
      .select()
      .from(dailyRecords)
      .where(eq(dailyRecords.batchId, batchId))
      .orderBy(desc(dailyRecords.recordDate))
      .limit(30);

    // Get vaccinations
    const batchVaccinations = await db
      .select()
      .from(vaccinations)
      .where(eq(vaccinations.batchId, batchId))
      .orderBy(desc(vaccinations.vaccinationDate));

    const [chickPlacement] = await db
      .select({
        id: chickPlacements.id,
        batchId: chickPlacements.batchId,
        supplierId: chickPlacements.supplierId,
        supplierName: suppliers.supplierName,
        contractId: chickPlacements.contractId,
        contractCode: supplierContracts.contractCode,
        placementDate: chickPlacements.placementDate,
        invoiceReference: chickPlacements.invoiceReference,
        deliveredQuantity: chickPlacements.deliveredQuantity,
        mortalityOnArrival: chickPlacements.mortalityOnArrival,
        acceptedQuantity: chickPlacements.acceptedQuantity,
        unitCost: chickPlacements.unitCost,
        batchOpeningCost: chickPlacements.batchOpeningCost,
        notes: chickPlacements.notes,
        createdAt: chickPlacements.createdAt,
        updatedAt: chickPlacements.updatedAt,
      })
      .from(chickPlacements)
      .leftJoin(suppliers, eq(chickPlacements.supplierId, suppliers.id))
      .leftJoin(supplierContracts, eq(chickPlacements.contractId, supplierContracts.id))
      .where(eq(chickPlacements.batchId, batchId))
      .orderBy(desc(chickPlacements.id))
      .limit(1);

    const inventoryConsumptions = await db
      .select({
        id: batchInventoryConsumptions.id,
        inventoryItemId: batchInventoryConsumptions.inventoryItemId,
        inventoryLotId: batchInventoryConsumptions.inventoryLotId,
        purchaseOrderItemId: batchInventoryConsumptions.purchaseOrderItemId,
        ingredientName: feedInventory.ingredientName,
        itemCode: feedInventory.itemCode,
        typeName: inventoryItemTypes.typeName,
        typeCode: inventoryItemTypes.typeCode,
        quantity: batchInventoryConsumptions.quantity,
        unit: batchInventoryConsumptions.unit,
        unitCost: batchInventoryConsumptions.unitCost,
        lineCost: batchInventoryConsumptions.lineCost,
        consumptionDate: batchInventoryConsumptions.consumptionDate,
        referenceType: batchInventoryConsumptions.referenceType,
        referenceId: batchInventoryConsumptions.referenceId,
        notes: batchInventoryConsumptions.notes,
      })
      .from(batchInventoryConsumptions)
      .innerJoin(feedInventory, eq(batchInventoryConsumptions.inventoryItemId, feedInventory.id))
      .innerJoin(inventoryItemTypes, eq(feedInventory.itemTypeId, inventoryItemTypes.id))
      .where(eq(batchInventoryConsumptions.batchId, batchId))
      .orderBy(desc(batchInventoryConsumptions.consumptionDate), desc(batchInventoryConsumptions.id));

    // Calculate FCR from latest record
    const latestRecord = records[0];
    let fcr: number | null = null;
    if (latestRecord && Number(latestRecord.averageWeight) > 0) {
      const totalFeed = records.reduce((sum, r) => sum + Number(r.feedConsumption), 0);
      const avgWeight = Number(latestRecord.averageWeight);
      const birdCount = latestRecord.birdCount;
      if (avgWeight > 0 && birdCount > 0) {
        fcr = Number((totalFeed / (avgWeight * birdCount / 1000)).toFixed(2));
      }
    }

    // Calculate total mortality
    const totalMortality = records.reduce((sum, r) => sum + r.mortalityCount, 0);
    const mortalityRate = batch.chicksPlaced > 0
      ? Number(((totalMortality / batch.chicksPlaced) * 100).toFixed(2))
      : 0;
    const totalInventoryCost = Number(inventoryConsumptions.reduce((sum, item) => sum + Number(item.lineCost), 0).toFixed(2));
    const totalInventoryQuantity = Number(inventoryConsumptions.reduce((sum, item) => sum + Number(item.quantity), 0).toFixed(2));
    const costSummary = await buildSingleBatchCostSummary(batchId);

    res.json({
      success: true,
      data: {
        batch,
        chickPlacement: chickPlacement ?? null,
        dailyRecords: records,
        vaccinations: batchVaccinations,
        inventoryConsumptions,
        costSummary,
        stats: {
          fcr,
          totalMortality,
          mortalityRate,
          currentBirdCount: latestRecord?.birdCount ?? batch.chicksPlaced,
          currentAge: latestRecord?.currentAge ?? 0,
          latestWeight: latestRecord ? Number(latestRecord.averageWeight) : null,
          totalInventoryCost,
          totalInventoryQuantity,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch batch detail', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch batch detail', code: 'BATCH_DETAIL_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.get('/:id/costs', authenticate, requirePermission('batches:read'), async (req: Request, res: Response) => {
  try {
    const batchId = Number(req.params.id as string);
    const costSummary = await buildSingleBatchCostSummary(batchId);

    if (!costSummary) {
      res.status(404).json({ success: false, error: 'Batch not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    res.json({ success: true, data: {
      batchId: costSummary.batchId,
      batchCode: costSummary.batchCode,
      chickCost: costSummary.chickCost ?? 0,
      feedCost: costSummary.feedCost,
      inventoryCost: costSummary.inventoryCost,
      laborCost: costSummary.laborCost,
      operationalExpenseCost: costSummary.operationalExpenseCost,
      totalCost: costSummary.totalCost,
      costPerBird: costSummary.costPerBird,
    }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to fetch batch costs', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch batch costs', code: 'BATCH_COSTS_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.get('/:id/cost-ledger', authenticate, requirePermission('batches:read'), async (req: Request, res: Response) => {
  try {
    const batchId = Number(req.params.id as string);
    const costSummary = await buildSingleBatchCostSummary(batchId);

    if (!costSummary) {
      res.status(404).json({ success: false, error: 'Batch not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    res.json({
      success: true,
      data: {
        batchId: costSummary.batchId,
        batchCode: costSummary.batchCode,
        totals: {
          chickCost: costSummary.chickCost ?? 0,
          feedCost: costSummary.feedCost,
          inventoryCost: costSummary.inventoryCost,
          laborCost: costSummary.laborCost,
          operationalExpenseCost: costSummary.operationalExpenseCost,
          totalCost: costSummary.totalCost,
          costPerBird: costSummary.costPerBird,
        },
        ledger: costSummary.ledger,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch batch cost ledger', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch batch cost ledger', code: 'BATCH_COST_LEDGER_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// GET /api/batches/:id/performance — KPIs, full cost build-up and P&L (frozen once closed)
router.get('/:id/performance', authenticate, requirePermission('batches:read'), async (req: Request, res: Response) => {
  try {
    const performance = await getBatchPerformance(Number(req.params.id as string));
    if (!performance) {
      res.status(404).json({ success: false, error: 'Batch not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }
    res.json({ success: true, data: performance, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to fetch batch performance', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch batch performance', code: 'BATCH_PERFORMANCE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// POST /api/batches/:id/close — freeze the batch's final costs, revenue and KPIs
router.post('/:id/close', authenticate, requirePermission('batches:update'), validate(closeBatchSchema), async (req: Request, res: Response) => {
  try {
    const batchId = Number(req.params.id as string);
    const snapshot = await closeBatch({
      batchId,
      closedBy: req.user!.id,
      notes: req.body.notes || null,
      acceptVariance: req.body.acceptVariance ?? false,
    });
    createAuditLog({
      userId: req.user!.id,
      action: 'batch_closed',
      entityType: 'batch',
      entityId: batchId,
      changes: { revenue: snapshot.revenue, totalCost: snapshot.totalCost, profit: snapshot.profit },
    });
    res.json({ success: true, data: snapshot, timestamp: new Date().toISOString() });
  } catch (error) {
    if (error instanceof BatchCloseError) {
      res.status(400).json({ success: false, error: error.message, code: 'BATCH_CLOSE_REJECTED', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }
    logger.error('Failed to close batch', { error });
    res.status(500).json({ success: false, error: 'Failed to close batch', code: 'BATCH_CLOSE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// POST /api/batches/:id/reopen — discard the frozen close-out so the batch can be corrected
router.post('/:id/reopen', authenticate, requirePermission('batches:update'), async (req: Request, res: Response) => {
  try {
    const batchId = Number(req.params.id as string);
    const snapshot = await reopenBatch(batchId);
    createAuditLog({
      userId: req.user!.id,
      action: 'batch_reopened',
      entityType: 'batch',
      entityId: batchId,
      changes: { discardedSnapshot: { revenue: snapshot.revenue, totalCost: snapshot.totalCost, profit: snapshot.profit, closedAt: snapshot.closedAt } },
    });
    res.json({ success: true, data: { batchId }, timestamp: new Date().toISOString() });
  } catch (error) {
    if (error instanceof BatchCloseError) {
      res.status(400).json({ success: false, error: error.message, code: 'BATCH_REOPEN_REJECTED', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }
    logger.error('Failed to reopen batch', { error });
    res.status(500).json({ success: false, error: 'Failed to reopen batch', code: 'BATCH_REOPEN_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// POST /api/batches — create a new batch
router.post('/', authenticate, requirePermission('batches:create'), validate(createBatchSchema), async (req: Request, res: Response) => {
  try {
    const { batchCode, siteId, cageId, chicksPlaced, placementDate, expectedDeliveryDate, notes } = req.body;

    // Verify batch code is unique
    const [existingBatch] = await db.select().from(batches).where(eq(batches.batchCode, batchCode)).limit(1);
    if (existingBatch) {
      res.status(409).json({ success: false, error: 'Batch code already exists', code: 'BATCH_CODE_EXISTS', statusCode: 409, timestamp: new Date().toISOString() });
      return;
    }

    // Verify cage exists and is empty
    const [cage] = await db.select().from(cages).where(eq(cages.id, cageId)).limit(1);
    if (!cage) {
      res.status(400).json({ success: false, error: 'Cage not found', code: 'CAGE_NOT_FOUND', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }
    if (cage.status === 'occupied') {
      res.status(400).json({ success: false, error: 'Cage is already occupied', code: 'CAGE_OCCUPIED', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    // Verify site
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) {
      res.status(400).json({ success: false, error: 'Site not found', code: 'SITE_NOT_FOUND', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    const newBatch = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(batches)
        .values({
          batchCode,
          siteId,
          cageId,
          chicksPlaced,
          placementDate,
          expectedDeliveryDate: expectedDeliveryDate || null,
          notes: notes || null,
          status: 'placement',
        })
        .returning();
      await tx.update(cages).set({ status: 'occupied', updatedAt: new Date() }).where(eq(cages.id, cageId));
      // Default growth curve + health programme; ends any cleaning turnaround on this house.
      await setUpNewBatch({ batchId: created.id, placementDate }, tx);
      return created;
    });

    createAuditLog({
      userId: req.user!.id,
      action: 'batch_created',
      entityType: 'batch',
      entityId: newBatch.id,
      changes: { batchCode, siteId, cageId, chicksPlaced, placementDate },
    });

    res.status(201).json({ success: true, data: newBatch, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to create batch', { error });
    res.status(500).json({ success: false, error: 'Failed to create batch', code: 'CREATE_BATCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// PUT /api/batches/:id — update batch status/details
router.put('/:id', authenticate, requirePermission('batches:update'), validate(updateBatchSchema), async (req: Request, res: Response) => {
  try {
    const batchId = Number(req.params.id as string);
    const [existing] = await db.select().from(batches).where(eq(batches.id, batchId)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Batch not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }
    if (existing.status === 'closed') {
      res.status(400).json({ success: false, error: 'This batch is closed. Reopen it to make changes.', code: 'BATCH_CLOSED', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    const finishing = (req.body.status === 'sold' || req.body.status === 'culled') && !existing.actualDeliveryDate && !req.body.actualDeliveryDate;
    const [updated] = await db
      .update(batches)
      .set({
        ...req.body,
        ...(finishing ? { actualDeliveryDate: new Date().toISOString().slice(0, 10) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(batches.id, batchId))
      .returning();

    // Batch leaves the house: the house goes into turnaround (cleaning) until it is marked ready.
    if ((req.body.status === 'sold' || req.body.status === 'culled') && existing.status !== req.body.status) {
      await startTurnaroundForBatch({ batchId, startedDate: updated.actualDeliveryDate ? String(updated.actualDeliveryDate) : undefined, userId: req.user!.id });
    }

    createAuditLog({
      userId: req.user!.id,
      action: 'batch_updated',
      entityType: 'batch',
      entityId: batchId,
      changes: { before: { status: existing.status }, after: { status: updated.status } },
    });

    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to update batch', { error });
    res.status(500).json({ success: false, error: 'Failed to update batch', code: 'UPDATE_BATCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.post('/:id/chick-placement', authenticate, requirePermission('batches:update'), validate(createChickPlacementSchema), async (req: Request, res: Response) => {
  try {
    const batchId = Number(req.params.id as string);
    await assertPeriodOpen(req.body.placementDate, 'costing');

    const [batch] = await db.select().from(batches).where(eq(batches.id, batchId)).limit(1);
    if (!batch) {
      res.status(404).json({ success: false, error: 'Batch not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }
    if (batch.status === 'closed') {
      res.status(400).json({ success: false, error: 'This batch is closed. Reopen it to make changes.', code: 'BATCH_CLOSED', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    if (req.body.supplierId) {
      const [supplier] = await db.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.id, req.body.supplierId)).limit(1);
      if (!supplier) {
        res.status(400).json({ success: false, error: 'Supplier not found', code: 'INVALID_SUPPLIER', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }
    }

    if (req.body.contractId) {
      const [contract] = await db.select().from(supplierContracts).where(eq(supplierContracts.id, req.body.contractId)).limit(1);
      if (!contract || (req.body.supplierId && contract.supplierId !== req.body.supplierId)) {
        res.status(400).json({ success: false, error: 'Contract does not belong to the selected supplier', code: 'INVALID_CONTRACT', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }
    }

    const acceptedQuantity = Math.max(req.body.deliveredQuantity - (req.body.mortalityOnArrival ?? 0), 0);
    const batchOpeningCost = Number((acceptedQuantity * req.body.unitCost).toFixed(2));

    const [existing] = await db.select().from(chickPlacements).where(eq(chickPlacements.batchId, batchId)).limit(1);
    const values = {
      batchId,
      supplierId: req.body.supplierId ?? null,
      contractId: req.body.contractId ?? null,
      placementDate: req.body.placementDate,
      invoiceReference: req.body.invoiceReference || null,
      deliveredQuantity: req.body.deliveredQuantity,
      mortalityOnArrival: req.body.mortalityOnArrival ?? 0,
      acceptedQuantity,
      unitCost: req.body.unitCost.toFixed(2),
      batchOpeningCost: batchOpeningCost.toFixed(2),
      notes: req.body.notes || null,
      createdBy: req.user!.id,
      updatedAt: new Date(),
    };

    const [placement] = existing
      ? await db.update(chickPlacements).set(values).where(eq(chickPlacements.id, existing.id)).returning()
      : await db.insert(chickPlacements).values(values).returning();

    await db
      .update(batches)
      .set({
        chicksPlaced: acceptedQuantity,
        placementDate: req.body.placementDate,
        updatedAt: new Date(),
      })
      .where(eq(batches.id, batchId));

    // Placement date or bird numbers changed: re-date pending health tasks and resize doses.
    await applyHealthTemplate({ batchId, templateId: batch.healthTemplateId ?? null });

    createAuditLog({
      userId: req.user!.id,
      action: existing ? 'chick_placement_updated' : 'chick_placement_recorded',
      entityType: 'chick_placement',
      entityId: placement.id,
      changes: { batchId, acceptedQuantity, batchOpeningCost },
    });

    res.status(existing ? 200 : 201).json({ success: true, data: placement, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to save chick placement', { error });
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to save chick placement', code: 'CHICK_PLACEMENT_SAVE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// POST /api/batches/:id/daily-records — add a daily record
router.post('/:id/daily-records', authenticate, requirePermission('daily_records:create'), validate(createDailyRecordSchema), async (req: Request, res: Response) => {
  try {
    const batchId = Number(req.params.id as string);
    const [batch] = await db.select().from(batches).where(eq(batches.id, batchId)).limit(1);
    if (!batch) {
      res.status(404).json({ success: false, error: 'Batch not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }
    if (batch.status === 'closed') {
      res.status(400).json({ success: false, error: 'This batch is closed. Reopen it to make changes.', code: 'BATCH_CLOSED', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    const { recordDate, currentAge, birdCount, mortalityCount, mortalityCause, waterConsumption, feedConsumption, averageWeight, temperature, humidity, ammoniaLevel, notes } = req.body;

    // Check for duplicate date
    const [existingRecord] = await db
      .select()
      .from(dailyRecords)
      .where(and(eq(dailyRecords.batchId, batchId), eq(dailyRecords.recordDate, recordDate)))
      .limit(1);

    if (existingRecord) {
      res.status(409).json({ success: false, error: 'A record already exists for this date', code: 'RECORD_EXISTS', statusCode: 409, timestamp: new Date().toISOString() });
      return;
    }

    const [record] = await db
      .insert(dailyRecords)
      .values({
        batchId,
        recordDate,
        currentAge,
        birdCount,
        mortalityCount: mortalityCount ?? 0,
        mortalityCause: mortalityCause || null,
        waterConsumption: waterConsumption?.toString() ?? null,
        feedConsumption: feedConsumption.toString(),
        averageWeight: averageWeight?.toString() ?? null,
        temperature: temperature?.toString() ?? null,
        humidity: humidity ?? null,
        ammoniaLevel: ammoniaLevel?.toString() ?? null,
        recordedBy: req.user!.id,
        notes: notes || null,
      })
      .returning();

    // Auto-transition batch to 'growing' if still in 'placement'
    if (batch.status === 'placement') {
      await db.update(batches).set({ status: 'growing', updatedAt: new Date() }).where(eq(batches.id, batchId));
    }

    res.status(201).json({ success: true, data: record, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to create daily record', { error });
    res.status(500).json({ success: false, error: 'Failed to create daily record', code: 'CREATE_RECORD_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});


// PUT /api/batches/:id/daily-records/:recordId — update a daily record
router.put('/:id/daily-records/:recordId', authenticate, requirePermission('daily_records:update'), validate(updateDailyRecordSchema), async (req: Request, res: Response) => {
  try {
    const batchId = Number(req.params.id as string);
    const recordId = Number(req.params.recordId as string);

    // Verify batch exists
    const [batch] = await db.select().from(batches).where(eq(batches.id, batchId)).limit(1);
    if (!batch) {
      res.status(404).json({ success: false, error: 'Batch not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }
    if (batch.status === 'closed') {
      res.status(400).json({ success: false, error: 'This batch is closed. Reopen it to make changes.', code: 'BATCH_CLOSED', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    // Verify record exists and belongs to batch
    const [existingRecord] = await db
      .select()
      .from(dailyRecords)
      .where(and(eq(dailyRecords.id, recordId), eq(dailyRecords.batchId, batchId)))
      .limit(1);

    if (!existingRecord) {
      res.status(404).json({ success: false, error: 'Daily record not found', code: 'RECORD_NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    const body = req.body;

    if (body.birdCount !== undefined) updateData.birdCount = body.birdCount;
    if (body.mortalityCount !== undefined) updateData.mortalityCount = body.mortalityCount;
    if (body.mortalityCause !== undefined) updateData.mortalityCause = body.mortalityCause;
    if (body.waterConsumption !== undefined) updateData.waterConsumption = body.waterConsumption?.toString() ?? null;
    if (body.feedConsumption !== undefined) updateData.feedConsumption = body.feedConsumption.toString();
    if (body.averageWeight !== undefined) updateData.averageWeight = body.averageWeight?.toString() ?? null;
    if (body.temperature !== undefined) updateData.temperature = body.temperature?.toString() ?? null;
    if (body.humidity !== undefined) updateData.humidity = body.humidity;
    if (body.ammoniaLevel !== undefined) updateData.ammoniaLevel = body.ammoniaLevel?.toString() ?? null;
    if (body.notes !== undefined) updateData.notes = body.notes;

    const [updated] = await db
      .update(dailyRecords)
      .set(updateData)
      .where(eq(dailyRecords.id, recordId))
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'daily_record_updated',
      entityType: 'daily_record',
      entityId: recordId,
      changes: { batchId, ...req.body },
    });

    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to update daily record', { error });
    res.status(500).json({ success: false, error: 'Failed to update daily record', code: 'UPDATE_RECORD_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// POST /api/batches/:id/mortality — quick mortality recording
router.post('/:id/mortality', authenticate, requirePermission('daily_records:create'), validate(recordMortalitySchema), async (req: Request, res: Response) => {
  try {
    const batchId = Number(req.params.id as string);
    const [batch] = await db.select().from(batches).where(eq(batches.id, batchId)).limit(1);
    if (!batch) {
      res.status(404).json({ success: false, error: 'Batch not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }
    if (batch.status === 'closed') {
      res.status(400).json({ success: false, error: 'This batch is closed. Reopen it to make changes.', code: 'BATCH_CLOSED', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    const { count, cause, notes } = req.body;
    const today = new Date().toISOString().split('T')[0];

    // Calculate current age from placement date
    const placementDate = new Date(batch.placementDate);
    const now = new Date();
    const currentAge = Math.floor((now.getTime() - placementDate.getTime()) / (1000 * 60 * 60 * 24));

    // Get latest record to determine current bird count
    const [latestRecord] = await db
      .select()
      .from(dailyRecords)
      .where(eq(dailyRecords.batchId, batchId))
      .orderBy(desc(dailyRecords.recordDate))
      .limit(1);

    const previousBirdCount = latestRecord?.birdCount ?? batch.chicksPlaced;
    const newBirdCount = Math.max(0, previousBirdCount - count);

    // Check if a record already exists for today
    const [existingRecord] = await db
      .select()
      .from(dailyRecords)
      .where(and(eq(dailyRecords.batchId, batchId), eq(dailyRecords.recordDate, today)))
      .limit(1);

    if (existingRecord) {
      // Update the existing record — add to mortality count, update bird count
      const updatedMortality = existingRecord.mortalityCount + count;
      const updatedBirdCount = Math.max(0, existingRecord.birdCount - count);
      const [updated] = await db
        .update(dailyRecords)
        .set({
          mortalityCount: updatedMortality,
          birdCount: updatedBirdCount,
          mortalityCause: cause || existingRecord.mortalityCause,
          notes: notes ? (existingRecord.notes ? `${existingRecord.notes}; ${notes}` : notes) : existingRecord.notes,
          updatedAt: new Date(),
        })
        .where(eq(dailyRecords.id, existingRecord.id))
        .returning();

      res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
      return;
    }

    // Create a new daily record with mortality data and sensible defaults
    const [record] = await db
      .insert(dailyRecords)
      .values({
        batchId,
        recordDate: today,
        currentAge,
        birdCount: newBirdCount,
        mortalityCount: count,
        mortalityCause: cause || null,
        feedConsumption: '0',
        recordedBy: req.user!.id,
        notes: notes || null,
      })
      .returning();

    // Auto-transition batch to 'growing' if still in 'placement'
    if (batch.status === 'placement') {
      await db.update(batches).set({ status: 'growing', updatedAt: new Date() }).where(eq(batches.id, batchId));
    }

    res.status(201).json({ success: true, data: record, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to record mortality', { error });
    res.status(500).json({ success: false, error: 'Failed to record mortality', code: 'RECORD_MORTALITY_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// POST /api/batches/:id/vaccinations — add a vaccination record
router.post('/:id/vaccinations', authenticate, requirePermission('vaccinations:create'), validate(createVaccinationSchema), async (req: Request, res: Response) => {
  try {
    const batchId = Number(req.params.id as string);
    const [batch] = await db.select().from(batches).where(eq(batches.id, batchId)).limit(1);
    if (!batch) {
      res.status(404).json({ success: false, error: 'Batch not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }
    if (batch.status === 'closed') {
      res.status(400).json({ success: false, error: 'This batch is closed. Reopen it to make changes.', code: 'BATCH_CLOSED', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    const { vaccineType, vaccinationDate, inventoryItemId, quantityUsed, notes } = req.body;
    const record = await recordVaccination({
      batchId,
      vaccineType,
      vaccinationDate,
      inventoryItemId: inventoryItemId ?? null,
      quantityUsed: quantityUsed ?? null,
      notes: notes || null,
      userId: req.user!.id,
    });
    const inventoryCost = Number(record.inventoryCost ?? 0);

    createAuditLog({
      userId: req.user!.id,
      action: 'vaccination_recorded',
      entityType: 'vaccination',
      entityId: record.id,
      changes: { batchId, vaccineType, vaccinationDate, inventoryItemId: inventoryItemId ?? null, quantityUsed: quantityUsed ?? null, inventoryCost },
    });

    res.status(201).json({ success: true, data: record, timestamp: new Date().toISOString() });
  } catch (error) {
    if (error instanceof FarmOpsError) {
      res.status(error.statusCode).json({ success: false, error: error.message, code: error.code, statusCode: error.statusCode, timestamp: new Date().toISOString() });
      return;
    }
    logger.error('Failed to create vaccination record', { error });
    res.status(500).json({ success: false, error: 'Failed to create vaccination record', code: 'CREATE_VACCINATION_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

export default router;
