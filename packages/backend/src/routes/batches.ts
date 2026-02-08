import { Router, type Request, type Response } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate } from '../validators/auth';
import { createBatchSchema, updateBatchSchema, createDailyRecordSchema, createVaccinationSchema } from '../validators/batch';
import { db } from '../db';
import { batches, cages, sites, dailyRecords, vaccinations } from '../db/schema';
import { eq, sql, and, desc } from 'drizzle-orm';
import { createAuditLog } from '../lib/audit';
import logger from '../lib/logger';

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

    res.json({
      success: true,
      data: {
        batch,
        dailyRecords: records,
        vaccinations: batchVaccinations,
        stats: {
          fcr,
          totalMortality,
          mortalityRate,
          currentBirdCount: latestRecord?.birdCount ?? batch.chicksPlaced,
          currentAge: latestRecord?.currentAge ?? 0,
          latestWeight: latestRecord ? Number(latestRecord.averageWeight) : null,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch batch detail', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch batch detail', code: 'BATCH_DETAIL_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
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

// POST /api/batches/:id/vaccinations — add a vaccination record
router.post('/:id/vaccinations', authenticate, requirePermission('vaccinations:create'), validate(createVaccinationSchema), async (req: Request, res: Response) => {
  try {
    const batchId = Number(req.params.id as string);
    const [batch] = await db.select().from(batches).where(eq(batches.id, batchId)).limit(1);
    if (!batch) {
      res.status(404).json({ success: false, error: 'Batch not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const { vaccineType, vaccinationDate, notes } = req.body;

    const [record] = await db
      .insert(vaccinations)
      .values({
        batchId,
        vaccineType,
        vaccinationDate,
        notes: notes || null,
        recordedBy: req.user!.id,
      })
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'vaccination_recorded',
      entityType: 'vaccination',
      entityId: record.id,
      changes: { batchId, vaccineType, vaccinationDate },
    });

    res.status(201).json({ success: true, data: record, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to create vaccination record', { error });
    res.status(500).json({ success: false, error: 'Failed to create vaccination record', code: 'CREATE_VACCINATION_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

export default router;
