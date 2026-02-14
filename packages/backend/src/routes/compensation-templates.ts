import { Router, type Request, type Response } from 'express';
import { and, asc, eq } from 'drizzle-orm';
import { authenticate, requirePermission } from '../middleware/auth';
import { db } from '../db';
import { compensationTemplates } from '../db/schema';
import { createAuditLog } from '../lib/audit';
import logger from '../lib/logger';
import { validate } from '../validators/auth';
import {
  compensationTemplateQuerySchema,
  createCompensationTemplateSchema,
  updateCompensationTemplateSchema,
} from '../validators/compensation-template';

const router = Router();

// GET /api/compensation-templates
router.get('/', authenticate, requirePermission('payroll:read'), async (req: Request, res: Response) => {
  try {
    const query = compensationTemplateQuerySchema.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        code: 'VALIDATION_ERROR',
        details: query.error.flatten().fieldErrors,
        statusCode: 400,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const conditions = [];

    if (query.data.category) {
      conditions.push(eq(compensationTemplates.category, query.data.category));
    }

    if (query.data.active !== undefined) {
      conditions.push(eq(compensationTemplates.isActive, query.data.active));
    } else {
      conditions.push(eq(compensationTemplates.isActive, true));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const records = await db
      .select()
      .from(compensationTemplates)
      .where(where)
      .orderBy(asc(compensationTemplates.name));

    res.json({
      success: true,
      data: records,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to list compensation templates', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to list compensation templates',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// POST /api/compensation-templates
router.post(
  '/',
  authenticate,
  requirePermission('payroll:create'),
  validate(createCompensationTemplateSchema),
  async (req: Request, res: Response) => {
    try {
      const { name, category, defaultAmount, description, isActive = true } = req.body;

      const [created] = await db
        .insert(compensationTemplates)
        .values({
          name,
          category,
          defaultAmount: defaultAmount !== undefined ? defaultAmount.toFixed(2) : null,
          description: description ?? null,
          isActive,
        })
        .returning();

      createAuditLog({
        userId: req.user!.id,
        action: 'compensation_template.create',
        entityType: 'compensation_template',
        entityId: created.id,
        changes: req.body,
        ipAddress: req.ip,
      });

      res.status(201).json({
        success: true,
        data: created,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to create compensation template', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to create compensation template',
        code: 'INTERNAL_ERROR',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// PUT /api/compensation-templates/:id
router.put(
  '/:id',
  authenticate,
  requirePermission('payroll:update'),
  validate(updateCompensationTemplateSchema),
  async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id as string);

      const [existing] = await db
        .select({ id: compensationTemplates.id })
        .from(compensationTemplates)
        .where(eq(compensationTemplates.id, id))
        .limit(1);

      if (!existing) {
        res.status(404).json({
          success: false,
          error: 'Compensation template not found',
          code: 'NOT_FOUND',
          statusCode: 404,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (req.body.name !== undefined) updateData.name = req.body.name;
      if (req.body.category !== undefined) updateData.category = req.body.category;
      if (req.body.defaultAmount !== undefined) {
        updateData.defaultAmount = req.body.defaultAmount === null ? null : req.body.defaultAmount.toFixed(2);
      }
      if (req.body.description !== undefined) {
        updateData.description = req.body.description;
      }
      if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;

      const [updated] = await db
        .update(compensationTemplates)
        .set(updateData)
        .where(eq(compensationTemplates.id, id))
        .returning();

      createAuditLog({
        userId: req.user!.id,
        action: 'compensation_template.update',
        entityType: 'compensation_template',
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
      logger.error('Failed to update compensation template', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to update compensation template',
        code: 'INTERNAL_ERROR',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// DELETE /api/compensation-templates/:id (soft delete)
router.delete('/:id', authenticate, requirePermission('payroll:update'), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id as string);

    const [existing] = await db
      .select({ id: compensationTemplates.id })
      .from(compensationTemplates)
      .where(eq(compensationTemplates.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'Compensation template not found',
        code: 'NOT_FOUND',
        statusCode: 404,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const [updated] = await db
      .update(compensationTemplates)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(compensationTemplates.id, id))
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'compensation_template.delete',
      entityType: 'compensation_template',
      entityId: id,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      data: updated,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to delete compensation template', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to delete compensation template',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
