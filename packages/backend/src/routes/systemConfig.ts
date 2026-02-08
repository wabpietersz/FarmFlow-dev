import { Router, type Request, type Response } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import { db } from '../db';
import { systemConfig } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { createAuditLog } from '../lib/audit';
import logger from '../lib/logger';

const router = Router();

// GET /api/system-config — list all config entries
router.get('/', authenticate, requirePermission('system:read'), async (req: Request, res: Response) => {
  try {
    const results = await db.select().from(systemConfig).orderBy(systemConfig.configKey);

    res.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch system config', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch system config', code: 'SYSTEM_CONFIG_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// GET /api/system-config/:key — get single config by key
router.get('/:key', authenticate, requirePermission('system:read'), async (req: Request, res: Response) => {
  try {
    const configKey = req.params.key as string;

    const [entry] = await db.select().from(systemConfig).where(eq(systemConfig.configKey, configKey)).limit(1);
    if (!entry) {
      res.status(404).json({ success: false, error: 'Config entry not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    res.json({
      success: true,
      data: entry,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch config entry', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch config entry', code: 'SYSTEM_CONFIG_DETAIL_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// PUT /api/system-config/:key — update or create config entry (upsert)
router.put('/:key', authenticate, requirePermission('system:update'), async (req: Request, res: Response) => {
  try {
    const configKey = req.params.key as string;
    const { value, description } = req.body;

    if (value === undefined) {
      res.status(400).json({ success: false, error: 'value is required', code: 'VALIDATION_ERROR', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    const [existing] = await db.select().from(systemConfig).where(eq(systemConfig.configKey, configKey)).limit(1);

    let result;
    if (existing) {
      // Update existing entry
      const updateData: Record<string, unknown> = {
        configValue: value,
        updatedBy: req.user!.id,
        updatedAt: new Date(),
      };
      if (description !== undefined) {
        updateData.description = description;
      }

      [result] = await db
        .update(systemConfig)
        .set(updateData)
        .where(eq(systemConfig.configKey, configKey))
        .returning();
    } else {
      // Insert new entry
      [result] = await db
        .insert(systemConfig)
        .values({
          configKey,
          configValue: value,
          description: description || null,
          updatedBy: req.user!.id,
          updatedAt: new Date(),
        })
        .returning();
    }

    createAuditLog({
      userId: req.user!.id,
      action: existing ? 'system_config_updated' : 'system_config_created',
      entityType: 'system_config',
      entityId: result.id,
      changes: existing
        ? { before: { configValue: existing.configValue }, after: { configValue: value } }
        : { configKey, configValue: value },
    });

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to upsert config entry', { error });
    res.status(500).json({ success: false, error: 'Failed to upsert config entry', code: 'SYSTEM_CONFIG_UPSERT_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// DELETE /api/system-config/:key — delete config entry
router.delete('/:key', authenticate, requirePermission('system:update'), async (req: Request, res: Response) => {
  try {
    const configKey = req.params.key as string;

    const [existing] = await db.select().from(systemConfig).where(eq(systemConfig.configKey, configKey)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Config entry not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    await db.delete(systemConfig).where(eq(systemConfig.configKey, configKey));

    createAuditLog({
      userId: req.user!.id,
      action: 'system_config_deleted',
      entityType: 'system_config',
      entityId: existing.id,
      changes: { configKey, configValue: existing.configValue },
    });

    res.json({
      success: true,
      data: { deleted: true, configKey },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to delete config entry', { error });
    res.status(500).json({ success: false, error: 'Failed to delete config entry', code: 'SYSTEM_CONFIG_DELETE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

export default router;
