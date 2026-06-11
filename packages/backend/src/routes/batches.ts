import { Router, type Request, type Response } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate } from '../validators/auth';
import { createBatchSchema, updateBatchSchema, createChickPlacementSchema, createDailyRecordSchema, updateDailyRecordSchema, recordMortalitySchema, createVaccinationSchema } from '../validators/batch';
import { db } from '../db';
import { batches, cages, sites, dailyRecords, vaccinations, batchInventoryConsumptions, chickPlacements, feedInventory, inventoryAuditTrail, inventoryItemTypes, inventoryLots, purchaseOrderItems, supplierContracts, suppliers } from '../db/schema';
import { eq, sql, and, desc, asc } from 'drizzle-orm';
import { createAuditLog } from '../lib/audit';
import logger from '../lib/logger';
import { buildSingleBatchCostSummary } from '../lib/batch-costs';
import { postInventoryMovement } from '../lib/inventory-movements';
import { assertPeriodOpen } from '../lib/period-locks';

const router = Router();

interface LotConsumption {
  lotId: number;
  purchaseOrderItemId?: number | null;
  quantityUsed: number;
  costPerUnit: number;
  lineCost: number;
  previousRemaining: number;
  newRemaining: number;
}

async function getInventoryItemForBatch(itemId: number) {
  const [item] = await db
    .select({
      id: feedInventory.id,
      ingredientName: feedInventory.ingredientName,
      quantity: feedInventory.quantity,
      unit: feedInventory.unit,
      costPerUnit: feedInventory.costPerUnit,
      allowsBatchAllocation: inventoryItemTypes.allowsBatchAllocation,
      isFeed: inventoryItemTypes.isFeed,
      typeCode: inventoryItemTypes.typeCode,
      typeName: inventoryItemTypes.typeName,
    })
    .from(feedInventory)
    .innerJoin(inventoryItemTypes, eq(feedInventory.itemTypeId, inventoryItemTypes.id))
    .where(eq(feedInventory.id, itemId))
    .limit(1);

  return item;
}

async function consumeInventoryFIFOForBatch(
  inventoryItemId: number,
  requiredQuantity: number,
): Promise<{ lotConsumptions: LotConsumption[]; totalCost: number }> {
  const availableLots = await db
    .select()
    .from(inventoryLots)
    .where(and(
      eq(inventoryLots.inventoryItemId, inventoryItemId),
      sql`${inventoryLots.remainingQuantity}::numeric > 0`,
    ))
    .orderBy(asc(inventoryLots.receivedDate), asc(inventoryLots.id));

  const totalAvailable = availableLots.reduce((sum, lot) => sum + Number(lot.remainingQuantity), 0);
  if (totalAvailable < requiredQuantity) {
    throw new Error(`Insufficient lot quantity for inventory item ${inventoryItemId}`);
  }

  const lotConsumptions: LotConsumption[] = [];
  let remaining = requiredQuantity;
  let totalCost = 0;

  for (const lot of availableLots) {
    if (remaining <= 0) break;

    const lotRemaining = Number(lot.remainingQuantity);
    const consume = Math.min(remaining, lotRemaining);
    const cost = Number(lot.costPerUnit);
    const lineCost = Math.round(consume * cost * 100) / 100;

    lotConsumptions.push({
      lotId: lot.id,
      purchaseOrderItemId: lot.purchaseOrderItemId,
      quantityUsed: consume,
      costPerUnit: cost,
      lineCost,
      previousRemaining: lotRemaining,
      newRemaining: Math.round((lotRemaining - consume) * 100) / 100,
    });

    totalCost += lineCost;
    remaining = Math.round((remaining - consume) * 100) / 100;
  }

  return { lotConsumptions, totalCost: Math.round(totalCost * 100) / 100 };
}

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

    const [newBatch] = await db
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

    // Mark cage as occupied
    await db.update(cages).set({ status: 'occupied', updatedAt: new Date() }).where(eq(cages.id, cageId));

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

    const [updated] = await db
      .update(batches)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(batches.id, batchId))
      .returning();

    // If batch is sold or culled, free up the cage
    if (req.body.status === 'sold' || req.body.status === 'culled') {
      await db.update(cages).set({ status: 'empty', updatedAt: new Date() }).where(eq(cages.id, existing.cageId));
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

    const { vaccineType, vaccinationDate, inventoryItemId, quantityUsed, notes } = req.body;
    await assertPeriodOpen(vaccinationDate, quantityUsed ? 'inventory' : 'costing');

    let inventoryCost = 0;
    let inventoryUnit: string | null = null;

    if (inventoryItemId && quantityUsed) {
      const item = await getInventoryItemForBatch(inventoryItemId);
      if (!item) {
        res.status(404).json({ success: false, error: 'Inventory item not found', code: 'INVENTORY_ITEM_NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
        return;
      }
      if (item.isFeed || !item.allowsBatchAllocation) {
        res.status(400).json({ success: false, error: 'Selected inventory item cannot be allocated to the batch', code: 'INVALID_VACCINE_INVENTORY', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }
      if (Number(item.quantity) < quantityUsed) {
        res.status(400).json({ success: false, error: 'Insufficient inventory quantity', code: 'INSUFFICIENT_INVENTORY', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }

      inventoryUnit = item.unit;
      try {
        const result = await consumeInventoryFIFOForBatch(inventoryItemId, quantityUsed);
        inventoryCost = result.totalCost;

        for (const consumption of result.lotConsumptions) {
          await db.update(inventoryLots).set({
            remainingQuantity: String(consumption.newRemaining),
          }).where(eq(inventoryLots.id, consumption.lotId));

          await db.insert(batchInventoryConsumptions).values({
            batchId,
            inventoryItemId,
            inventoryLotId: consumption.lotId,
            purchaseOrderItemId: consumption.purchaseOrderItemId ?? null,
            quantity: String(consumption.quantityUsed),
            unit: item.unit,
            unitCost: String(consumption.costPerUnit),
            lineCost: String(consumption.lineCost),
            consumptionDate: vaccinationDate,
            referenceType: 'vaccination',
            referenceId: batchId,
            notes: notes || null,
            createdBy: req.user!.id,
          });

          await db.insert(inventoryAuditTrail).values({
            inventoryItemId,
            changeType: 'vaccination_consumption',
            previousQuantity: String(consumption.previousRemaining),
            changeQuantity: String(-consumption.quantityUsed),
            newQuantity: String(consumption.newRemaining),
            referenceId: batchId,
            referenceType: 'batch',
            notes: `Vaccination ${vaccineType}${notes ? ` - ${notes}` : ''}`,
            lotId: consumption.lotId,
            costAtTime: String(consumption.costPerUnit),
            performedBy: req.user!.id,
          });

          await postInventoryMovement({
            movementType: 'batch_consume',
            movementDate: vaccinationDate,
            sourceModule: 'batches',
            sourceEntityType: 'vaccination',
            sourceEntityId: batchId,
            sourceCodeSnapshot: batch.batchCode,
            inventoryItemId,
            inventoryLotId: consumption.lotId,
            purchaseOrderItemId: consumption.purchaseOrderItemId ?? null,
            batchId,
            quantity: -consumption.quantityUsed,
            unit: item.unit,
            unitCost: consumption.costPerUnit,
            lineCost: consumption.lineCost,
            balanceAfterQuantity: consumption.newRemaining,
            balanceScope: 'inventory_lot',
            notes: notes || null,
            createdBy: req.user!.id,
          });
        }
      } catch (error) {
        inventoryCost = Math.round(quantityUsed * Number(item.costPerUnit) * 100) / 100;
        await db.insert(batchInventoryConsumptions).values({
          batchId,
          inventoryItemId,
          quantity: String(quantityUsed),
          unit: item.unit,
          unitCost: String(item.costPerUnit),
          lineCost: String(inventoryCost),
          consumptionDate: vaccinationDate,
          referenceType: 'vaccination',
          referenceId: batchId,
          notes: notes || null,
          createdBy: req.user!.id,
        });
      }

      const newQuantity = Math.round((Number(item.quantity) - quantityUsed) * 100) / 100;
      await db
        .update(feedInventory)
        .set({
          quantity: String(newQuantity),
          updatedAt: new Date(),
        })
        .where(eq(feedInventory.id, inventoryItemId));
    }

    const [record] = await db
      .insert(vaccinations)
      .values({
        batchId,
        vaccineType,
        vaccinationDate,
        inventoryItemId: inventoryItemId ?? null,
        quantityUsed: quantityUsed != null ? String(quantityUsed) : null,
        unit: inventoryUnit,
        inventoryCost: inventoryCost > 0 ? String(inventoryCost) : null,
        notes: notes || null,
        recordedBy: req.user!.id,
      })
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'vaccination_recorded',
      entityType: 'vaccination',
      entityId: record.id,
      changes: { batchId, vaccineType, vaccinationDate, inventoryItemId: inventoryItemId ?? null, quantityUsed: quantityUsed ?? null, inventoryCost },
    });

    res.status(201).json({ success: true, data: record, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to create vaccination record', { error });
    res.status(500).json({ success: false, error: 'Failed to create vaccination record', code: 'CREATE_VACCINATION_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

export default router;
