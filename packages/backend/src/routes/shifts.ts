import { Router, type Request, type Response } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate } from '../validators/auth';
import { createShiftSchema, updateShiftSchema } from '../validators/attendance';
import { db } from '../db';
import { shifts } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { createAuditLog } from '../lib/audit';
import logger from '../lib/logger';

const router = Router();

// GET /api/shifts — list shifts
router.get('/', authenticate, requirePermission('attendance:read'), async (req: Request, res: Response) => {
  try {
    const { status } = req.query;

    let query = db
      .select()
      .from(shifts)
      .$dynamic();

    if (!status || status === 'active') {
      query = query.where(eq(shifts.status, 'active'));
    }
    // status=all returns everything

    const results = await query.orderBy(desc(shifts.createdAt));

    res.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to list shifts', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to list shifts',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// POST /api/shifts — create shift
router.post('/', authenticate, requirePermission('attendance:create'), validate(createShiftSchema), async (req: Request, res: Response) => {
  try {
    const { shiftName, startTime, endTime } = req.body;

    // Check for duplicate name
    const [existing] = await db
      .select({ id: shifts.id })
      .from(shifts)
      .where(eq(shifts.shiftName, shiftName))
      .limit(1);

    if (existing) {
      res.status(409).json({
        success: false,
        error: 'A shift with this name already exists',
        code: 'DUPLICATE_SHIFT',
        statusCode: 409,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const [created] = await db
      .insert(shifts)
      .values({ shiftName, startTime, endTime })
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'shift.create',
      entityType: 'shift',
      entityId: created.id,
      changes: { shiftName, startTime, endTime },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      data: created,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to create shift', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to create shift',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// PUT /api/shifts/:id — update shift
router.put('/:id', authenticate, requirePermission('attendance:update'), validate(updateShiftSchema), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id as string);

    const [existing] = await db
      .select()
      .from(shifts)
      .where(eq(shifts.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'Shift not found',
        code: 'NOT_FOUND',
        statusCode: 404,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const [updated] = await db
      .update(shifts)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(shifts.id, id))
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'shift.update',
      entityType: 'shift',
      entityId: id,
      changes: req.body,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      data: updated,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to update shift', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to update shift',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// DELETE /api/shifts/:id — soft-delete (set status=inactive)
router.delete('/:id', authenticate, requirePermission('attendance:delete'), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id as string);

    const [existing] = await db
      .select()
      .from(shifts)
      .where(eq(shifts.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'Shift not found',
        code: 'NOT_FOUND',
        statusCode: 404,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    await db
      .update(shifts)
      .set({ status: 'inactive', updatedAt: new Date() })
      .where(eq(shifts.id, id));

    createAuditLog({
      userId: req.user!.id,
      action: 'shift.delete',
      entityType: 'shift',
      entityId: id,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      data: { message: 'Shift deactivated' },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to delete shift', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to delete shift',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
