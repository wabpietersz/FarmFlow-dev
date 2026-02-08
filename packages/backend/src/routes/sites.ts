import { Router, type Request, type Response } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate } from '../validators/auth';
import { createSiteSchema, updateSiteSchema, createCageSchema, updateCageSchema } from '../validators/site';
import { db } from '../db';
import { sites, cages, batches } from '../db/schema';
import { eq, sql, and, count } from 'drizzle-orm';
import { createAuditLog } from '../lib/audit';
import logger from '../lib/logger';

const router = Router();

// GET /api/sites/list — dropdown list (lightweight, all authenticated users)
router.get('/list', authenticate, async (_req: Request, res: Response) => {
  try {
    const allSites = await db
      .select({
        id: sites.id,
        siteName: sites.siteName,
        location: sites.location,
      })
      .from(sites)
      .where(eq(sites.status, 'active'));

    res.json({
      success: true,
      data: allSites,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch sites list', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sites list',
      code: 'SITES_LIST_FAILED',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/sites — full list with stats
router.get('/', authenticate, requirePermission('sites:read'), async (_req: Request, res: Response) => {
  try {
    const allSites = await db
      .select({
        id: sites.id,
        siteName: sites.siteName,
        location: sites.location,
        capacity: sites.capacity,
        status: sites.status,
        createdAt: sites.createdAt,
        updatedAt: sites.updatedAt,
      })
      .from(sites)
      .orderBy(sites.siteName);

    // Get cage counts and active batch counts per site
    const cageCounts = await db
      .select({
        siteId: cages.siteId,
        totalCages: count(cages.id),
      })
      .from(cages)
      .groupBy(cages.siteId);

    const activeBatchCounts = await db
      .select({
        siteId: batches.siteId,
        activeBatches: count(batches.id),
      })
      .from(batches)
      .where(sql`${batches.status} IN ('placement', 'growing', 'ready_for_sale')`)
      .groupBy(batches.siteId);

    const cageMap = new Map(cageCounts.map((c) => [c.siteId, Number(c.totalCages)]));
    const batchMap = new Map(activeBatchCounts.map((b) => [b.siteId, Number(b.activeBatches)]));

    const sitesWithStats = allSites.map((site) => ({
      ...site,
      totalCages: cageMap.get(site.id) ?? 0,
      activeBatches: batchMap.get(site.id) ?? 0,
    }));

    res.json({
      success: true,
      data: sitesWithStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch sites', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sites',
      code: 'SITES_FETCH_FAILED',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/sites/:id — site detail with cages
router.get('/:id', authenticate, requirePermission('sites:read'), async (req: Request, res: Response) => {
  try {
    const siteId = Number(req.params.id as string);
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);

    if (!site) {
      res.status(404).json({ success: false, error: 'Site not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const siteCages = await db
      .select()
      .from(cages)
      .where(eq(cages.siteId, siteId))
      .orderBy(cages.cageNumber);

    // Get batch info for occupied cages
    const activeBatches = await db
      .select({
        id: batches.id,
        batchCode: batches.batchCode,
        cageId: batches.cageId,
        chicksPlaced: batches.chicksPlaced,
        status: batches.status,
        placementDate: batches.placementDate,
      })
      .from(batches)
      .where(and(
        eq(batches.siteId, siteId),
        sql`${batches.status} IN ('placement', 'growing', 'ready_for_sale')`,
      ));

    const batchByCage = new Map(activeBatches.map((b) => [b.cageId, b]));

    const cagesWithBatch = siteCages.map((cage) => ({
      ...cage,
      currentBatch: batchByCage.get(cage.id) ?? null,
    }));

    res.json({
      success: true,
      data: { site, cages: cagesWithBatch },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch site detail', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch site detail', code: 'SITE_DETAIL_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// POST /api/sites — create a new site
router.post('/', authenticate, requirePermission('sites:read'), validate(createSiteSchema), async (req: Request, res: Response) => {
  try {
    const { siteName, location, capacity } = req.body;

    const [existing] = await db.select().from(sites).where(eq(sites.siteName, siteName)).limit(1);
    if (existing) {
      res.status(409).json({ success: false, error: 'Site with this name already exists', code: 'SITE_EXISTS', statusCode: 409, timestamp: new Date().toISOString() });
      return;
    }

    const [newSite] = await db.insert(sites).values({ siteName, location, capacity }).returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'site_created',
      entityType: 'site',
      entityId: newSite.id,
      changes: { siteName, location, capacity },
    });

    res.status(201).json({
      success: true,
      data: newSite,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to create site', { error });
    res.status(500).json({ success: false, error: 'Failed to create site', code: 'CREATE_SITE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// PUT /api/sites/:id — update a site
router.put('/:id', authenticate, requirePermission('sites:read'), validate(updateSiteSchema), async (req: Request, res: Response) => {
  try {
    const siteId = Number(req.params.id as string);
    const [existing] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Site not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const [updated] = await db
      .update(sites)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(sites.id, siteId))
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'site_updated',
      entityType: 'site',
      entityId: siteId,
      changes: { before: existing, after: updated },
    });

    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to update site', { error });
    res.status(500).json({ success: false, error: 'Failed to update site', code: 'UPDATE_SITE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// --- Cage endpoints ---

// POST /api/sites/:siteId/cages — create a cage
router.post('/:siteId/cages', authenticate, requirePermission('sites:read'), validate(createCageSchema), async (req: Request, res: Response) => {
  try {
    const siteId = Number(req.params.siteId as string);
    const [site] = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) {
      res.status(404).json({ success: false, error: 'Site not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const { cageNumber, capacity } = req.body;

    const [existingCage] = await db
      .select()
      .from(cages)
      .where(and(eq(cages.siteId, siteId), eq(cages.cageNumber, cageNumber)))
      .limit(1);

    if (existingCage) {
      res.status(409).json({ success: false, error: 'Cage number already exists at this site', code: 'CAGE_EXISTS', statusCode: 409, timestamp: new Date().toISOString() });
      return;
    }

    const [newCage] = await db
      .insert(cages)
      .values({ siteId, cageNumber, capacity })
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'cage_created',
      entityType: 'cage',
      entityId: newCage.id,
      changes: { siteId, cageNumber, capacity },
    });

    res.status(201).json({ success: true, data: newCage, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to create cage', { error });
    res.status(500).json({ success: false, error: 'Failed to create cage', code: 'CREATE_CAGE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// PUT /api/sites/:siteId/cages/:cageId — update a cage
router.put('/:siteId/cages/:cageId', authenticate, requirePermission('sites:read'), validate(updateCageSchema), async (req: Request, res: Response) => {
  try {
    const cageId = Number(req.params.cageId as string);

    const [existing] = await db.select().from(cages).where(eq(cages.id, cageId)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Cage not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const [updated] = await db
      .update(cages)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(cages.id, cageId))
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'cage_updated',
      entityType: 'cage',
      entityId: cageId,
      changes: { before: existing, after: updated },
    });

    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to update cage', { error });
    res.status(500).json({ success: false, error: 'Failed to update cage', code: 'UPDATE_CAGE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// GET /api/sites/:siteId/cages — list cages for a site (for dropdowns)
router.get('/:siteId/cages', authenticate, async (req: Request, res: Response) => {
  try {
    const siteId = Number(req.params.siteId as string);
    const siteCages = await db
      .select({
        id: cages.id,
        cageNumber: cages.cageNumber,
        capacity: cages.capacity,
        status: cages.status,
      })
      .from(cages)
      .where(eq(cages.siteId, siteId))
      .orderBy(cages.cageNumber);

    res.json({ success: true, data: siteCages, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to fetch cages', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch cages', code: 'CAGES_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

export default router;
