import { requireSiteAccess, siteOf, siteScope } from '../lib/site-scope';
import { Router, type Request, type Response } from 'express';
import { and, asc, desc, eq, ne } from 'drizzle-orm';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate } from '../validators/auth';
import {
  addHealthTaskSchema,
  applyHealthTemplateSchema,
  completeHealthTaskSchema,
  growthStandardSchema,
  healthTemplateSchema,
  skipHealthTaskSchema,
  todayCheckSchema,
  turnaroundUpdateSchema,
  vetVisitSchema,
} from '../validators/farm-ops';
import { db } from '../db';
import {
  batchHealthTasks,
  batches,
  feedInventory,
  growthStandardPoints,
  growthStandards,
  healthScheduleItems,
  healthScheduleTemplates,
  sites,
  users,
  vetVisits,
} from '../db/schema';
import logger from '../lib/logger';
import { createAuditLog } from '../lib/audit';
import {
  FarmOpsError,
  applyHealthTemplate,
  completeHealthTask,
  getGrowthComparison,
  listDueHealthTasks,
  skipHealthTask,
} from '../lib/batch-health';
import { getBatchHistory, getTodayCheck, listTurnarounds, saveTodayCheck, updateTurnaround } from '../lib/farm-ops';
import { toIsoDate } from '../lib/bird-days';

const router = Router();

const now = () => new Date().toISOString();

function fail(res: Response, error: unknown, fallback: string, code: string) {
  if (error instanceof FarmOpsError) {
    res.status(error.statusCode).json({ success: false, error: error.message, code: error.code, statusCode: error.statusCode, timestamp: now() });
    return;
  }
  const message = error instanceof Error && /closed period/i.test(error.message) ? error.message : null;
  if (message) {
    res.status(400).json({ success: false, error: message, code: 'PERIOD_LOCKED', statusCode: 400, timestamp: now() });
    return;
  }
  if ((error as { code?: string })?.code === '23505') {
    res.status(409).json({ success: false, error: 'That name is already used', code: 'DUPLICATE', statusCode: 409, timestamp: now() });
    return;
  }
  logger.error(fallback, { error });
  res.status(500).json({ success: false, error: fallback, code, statusCode: 500, timestamp: now() });
}


// ─── Health programmes (templates) ───────────────────────────────────────────

router.get('/health-templates', authenticate, requirePermission('batches:read'), async (_req, res) => {
  try {
    const templates = await db.select().from(healthScheduleTemplates).orderBy(desc(healthScheduleTemplates.isDefault), asc(healthScheduleTemplates.name));
    const items = await db
      .select({
        id: healthScheduleItems.id,
        templateId: healthScheduleItems.templateId,
        dayOfAge: healthScheduleItems.dayOfAge,
        taskType: healthScheduleItems.taskType,
        name: healthScheduleItems.name,
        method: healthScheduleItems.method,
        inventoryItemId: healthScheduleItems.inventoryItemId,
        inventoryItemName: feedInventory.ingredientName,
        inventoryUnit: feedInventory.unit,
        dosePer1000Birds: healthScheduleItems.dosePer1000Birds,
        notes: healthScheduleItems.notes,
      })
      .from(healthScheduleItems)
      .leftJoin(feedInventory, eq(healthScheduleItems.inventoryItemId, feedInventory.id))
      .orderBy(asc(healthScheduleItems.dayOfAge));
    res.json({ success: true, data: templates.map((t) => ({ ...t, items: items.filter((i) => i.templateId === t.id) })), timestamp: now() });
  } catch (error) {
    fail(res, error, 'Failed to load health programmes', 'HEALTH_TEMPLATES_FAILED');
  }
});

async function saveTemplate(req: Request, templateId: number | null) {
  return db.transaction(async (tx) => {
    const body = req.body;
    if (body.isDefault) {
      await tx.update(healthScheduleTemplates).set({ isDefault: false }).where(templateId ? ne(healthScheduleTemplates.id, templateId) : undefined);
    }
    let template;
    if (templateId) {
      [template] = await tx.update(healthScheduleTemplates).set({
        name: body.name,
        description: body.description ?? null,
        isDefault: body.isDefault ?? false,
        status: body.status ?? 'active',
        updatedAt: new Date(),
      }).where(eq(healthScheduleTemplates.id, templateId)).returning();
      if (!template) throw new FarmOpsError('Programme not found', 404, 'NOT_FOUND');
      await tx.delete(healthScheduleItems).where(eq(healthScheduleItems.templateId, templateId));
    } else {
      [template] = await tx.insert(healthScheduleTemplates).values({
        name: body.name,
        description: body.description ?? null,
        isDefault: body.isDefault ?? false,
        status: body.status ?? 'active',
      }).returning();
    }
    if (body.items.length > 0) {
      await tx.insert(healthScheduleItems).values(body.items.map((item: Record<string, unknown>) => ({
        templateId: template.id,
        dayOfAge: item.dayOfAge as number,
        taskType: item.taskType as string,
        name: item.name as string,
        method: (item.method as string) ?? null,
        inventoryItemId: (item.inventoryItemId as number) ?? null,
        dosePer1000Birds: item.dosePer1000Birds != null ? String(item.dosePer1000Birds) : null,
        notes: (item.notes as string) ?? null,
      })));
    }
    return template;
  });
}

router.post('/health-templates', authenticate, requirePermission('batches:update'), validate(healthTemplateSchema), async (req, res) => {
  try {
    const template = await saveTemplate(req, null);
    createAuditLog({ userId: req.user!.id, action: 'health_template_created', entityType: 'health_template', entityId: template.id, changes: { name: template.name } });
    res.status(201).json({ success: true, data: template, timestamp: now() });
  } catch (error) {
    fail(res, error, 'Failed to save health programme', 'HEALTH_TEMPLATE_SAVE_FAILED');
  }
});

router.put('/health-templates/:id', authenticate, requirePermission('batches:update'), validate(healthTemplateSchema), async (req, res) => {
  try {
    const template = await saveTemplate(req, Number(req.params.id as string));
    createAuditLog({ userId: req.user!.id, action: 'health_template_updated', entityType: 'health_template', entityId: template.id, changes: { name: template.name, items: req.body.items.length } });
    res.json({ success: true, data: template, timestamp: now() });
  } catch (error) {
    fail(res, error, 'Failed to save health programme', 'HEALTH_TEMPLATE_SAVE_FAILED');
  }
});

// ─── Health tasks on batches ─────────────────────────────────────────────────

router.get('/health-tasks/due', authenticate, requirePermission('batches:read'), async (req, res) => {
  try {
    const asOf = typeof req.query.date === 'string' ? req.query.date : toIsoDate(new Date());
    const siteId = siteScope(req) ?? (req.query.siteId ? Number(req.query.siteId) : null);
    res.json({ success: true, data: await listDueHealthTasks({ asOf, siteId }), timestamp: now() });
  } catch (error) {
    fail(res, error, 'Failed to load due health tasks', 'HEALTH_TASKS_DUE_FAILED');
  }
});

router.get('/batches/:id/health-tasks', authenticate, requireSiteAccess(siteOf.batch()), requirePermission('batches:read'), async (req, res) => {
  try {
    const tasks = await db
      .select({
        id: batchHealthTasks.id,
        dueDate: batchHealthTasks.dueDate,
        dayOfAge: batchHealthTasks.dayOfAge,
        taskType: batchHealthTasks.taskType,
        name: batchHealthTasks.name,
        method: batchHealthTasks.method,
        inventoryItemId: batchHealthTasks.inventoryItemId,
        inventoryItemName: feedInventory.ingredientName,
        inventoryUnit: feedInventory.unit,
        plannedQuantity: batchHealthTasks.plannedQuantity,
        status: batchHealthTasks.status,
        completedDate: batchHealthTasks.completedDate,
        completedByName: users.fullName,
        vaccinationId: batchHealthTasks.vaccinationId,
        skipReason: batchHealthTasks.skipReason,
        notes: batchHealthTasks.notes,
        fromProgramme: batchHealthTasks.templateItemId,
      })
      .from(batchHealthTasks)
      .leftJoin(feedInventory, eq(batchHealthTasks.inventoryItemId, feedInventory.id))
      .leftJoin(users, eq(batchHealthTasks.completedBy, users.id))
      .where(eq(batchHealthTasks.batchId, Number(req.params.id as string)))
      .orderBy(asc(batchHealthTasks.dueDate), asc(batchHealthTasks.id));
    res.json({ success: true, data: tasks, timestamp: now() });
  } catch (error) {
    fail(res, error, 'Failed to load health tasks', 'HEALTH_TASKS_FAILED');
  }
});

router.post('/batches/:id/health-tasks/apply', authenticate, requireSiteAccess(siteOf.batch()), requirePermission('batches:update'), validate(applyHealthTemplateSchema), async (req, res) => {
  try {
    const batchId = Number(req.params.id as string);
    const created = await applyHealthTemplate({ batchId, templateId: req.body.templateId });
    createAuditLog({ userId: req.user!.id, action: 'health_template_applied', entityType: 'batch', entityId: batchId, changes: { templateId: req.body.templateId, tasks: created.length } });
    res.json({ success: true, data: created, timestamp: now() });
  } catch (error) {
    fail(res, error, 'Failed to apply health programme', 'HEALTH_TEMPLATE_APPLY_FAILED');
  }
});

router.post('/batches/:id/health-tasks', authenticate, requireSiteAccess(siteOf.batch()), requirePermission('vaccinations:create'), validate(addHealthTaskSchema), async (req, res) => {
  try {
    const batchId = Number(req.params.id as string);
    const [batch] = await db.select().from(batches).where(eq(batches.id, batchId)).limit(1);
    if (!batch) throw new FarmOpsError('Batch not found', 404, 'NOT_FOUND');
    if (batch.status === 'closed') throw new FarmOpsError('This batch is closed. Reopen it to make changes.', 400, 'BATCH_CLOSED');
    const dayOfAge = Math.round((new Date(req.body.dueDate).getTime() - new Date(toIsoDate(batch.placementDate)).getTime()) / 86_400_000);
    const [task] = await db.insert(batchHealthTasks).values({
      batchId,
      dueDate: req.body.dueDate,
      dayOfAge,
      taskType: req.body.taskType,
      name: req.body.name,
      method: req.body.method ?? null,
      inventoryItemId: req.body.inventoryItemId ?? null,
      plannedQuantity: req.body.plannedQuantity != null ? String(req.body.plannedQuantity) : null,
      notes: req.body.notes ?? null,
    }).returning();
    res.status(201).json({ success: true, data: task, timestamp: now() });
  } catch (error) {
    fail(res, error, 'Failed to add health task', 'HEALTH_TASK_ADD_FAILED');
  }
});

router.post('/health-tasks/:taskId/complete', authenticate, requireSiteAccess(siteOf.healthTask()), requirePermission('vaccinations:create'), validate(completeHealthTaskSchema), async (req, res) => {
  try {
    const result = await completeHealthTask({
      taskId: Number(req.params.taskId as string),
      completedDate: req.body.completedDate,
      inventoryItemId: req.body.inventoryItemId ?? null,
      quantityUsed: req.body.quantityUsed ?? null,
      notes: req.body.notes ?? null,
      userId: req.user!.id,
    });
    createAuditLog({ userId: req.user!.id, action: 'health_task_completed', entityType: 'batch_health_task', entityId: result.task.id, changes: { vaccinationId: result.vaccination.id } });
    res.json({ success: true, data: result, timestamp: now() });
  } catch (error) {
    fail(res, error, 'Failed to complete health task', 'HEALTH_TASK_COMPLETE_FAILED');
  }
});

router.post('/health-tasks/:taskId/skip', authenticate, requireSiteAccess(siteOf.healthTask()), requirePermission('vaccinations:create'), validate(skipHealthTaskSchema), async (req, res) => {
  try {
    const task = await skipHealthTask({ taskId: Number(req.params.taskId as string), reason: req.body.reason, userId: req.user!.id });
    createAuditLog({ userId: req.user!.id, action: 'health_task_skipped', entityType: 'batch_health_task', entityId: task.id, changes: { reason: req.body.reason } });
    res.json({ success: true, data: task, timestamp: now() });
  } catch (error) {
    fail(res, error, 'Failed to skip health task', 'HEALTH_TASK_SKIP_FAILED');
  }
});

// ─── Growth standards and comparison ─────────────────────────────────────────

router.get('/growth-standards', authenticate, requirePermission('batches:read'), async (_req, res) => {
  try {
    const standards = await db.select().from(growthStandards).orderBy(desc(growthStandards.isDefault), asc(growthStandards.name));
    const points = await db.select().from(growthStandardPoints).orderBy(asc(growthStandardPoints.dayOfAge));
    res.json({ success: true, data: standards.map((s) => ({ ...s, points: points.filter((p) => p.standardId === s.id) })), timestamp: now() });
  } catch (error) {
    fail(res, error, 'Failed to load growth standards', 'GROWTH_STANDARDS_FAILED');
  }
});

async function saveStandard(req: Request, standardId: number | null) {
  return db.transaction(async (tx) => {
    const body = req.body;
    if (body.isDefault) {
      await tx.update(growthStandards).set({ isDefault: false }).where(standardId ? ne(growthStandards.id, standardId) : undefined);
    }
    let standard;
    if (standardId) {
      [standard] = await tx.update(growthStandards).set({
        name: body.name, breed: body.breed ?? null, notes: body.notes ?? null, isDefault: body.isDefault ?? false, status: body.status ?? 'active', updatedAt: new Date(),
      }).where(eq(growthStandards.id, standardId)).returning();
      if (!standard) throw new FarmOpsError('Growth standard not found', 404, 'NOT_FOUND');
      await tx.delete(growthStandardPoints).where(eq(growthStandardPoints.standardId, standardId));
    } else {
      [standard] = await tx.insert(growthStandards).values({
        name: body.name, breed: body.breed ?? null, notes: body.notes ?? null, isDefault: body.isDefault ?? false, status: body.status ?? 'active',
      }).returning();
    }
    const days = new Set<number>();
    for (const point of body.points) {
      if (days.has(point.dayOfAge)) throw new FarmOpsError(`Day ${point.dayOfAge} is listed twice`);
      days.add(point.dayOfAge);
    }
    await tx.insert(growthStandardPoints).values(body.points.map((point: Record<string, number | null>) => ({
      standardId: standard.id,
      dayOfAge: point.dayOfAge as number,
      targetWeightG: point.targetWeightG as number,
      targetCumFeedG: point.targetCumFeedG ?? null,
      targetCumMortalityPct: point.targetCumMortalityPct != null ? String(point.targetCumMortalityPct) : null,
    })));
    return standard;
  });
}

router.post('/growth-standards', authenticate, requirePermission('batches:update'), validate(growthStandardSchema), async (req, res) => {
  try {
    res.status(201).json({ success: true, data: await saveStandard(req, null), timestamp: now() });
  } catch (error) {
    fail(res, error, 'Failed to save growth standard', 'GROWTH_STANDARD_SAVE_FAILED');
  }
});

router.put('/growth-standards/:id', authenticate, requirePermission('batches:update'), validate(growthStandardSchema), async (req, res) => {
  try {
    res.json({ success: true, data: await saveStandard(req, Number(req.params.id as string)), timestamp: now() });
  } catch (error) {
    fail(res, error, 'Failed to save growth standard', 'GROWTH_STANDARD_SAVE_FAILED');
  }
});

router.get('/batches/:id/growth', authenticate, requireSiteAccess(siteOf.batch()), requirePermission('batches:read'), async (req, res) => {
  try {
    res.json({ success: true, data: await getGrowthComparison(Number(req.params.id as string)), timestamp: now() });
  } catch (error) {
    fail(res, error, 'Failed to load growth comparison', 'GROWTH_COMPARISON_FAILED');
  }
});

// ─── Today's check ───────────────────────────────────────────────────────────

router.get('/batches/:id/today', authenticate, requireSiteAccess(siteOf.batch()), requirePermission('batches:read'), async (req, res) => {
  try {
    const date = typeof req.query.date === 'string' ? req.query.date : toIsoDate(new Date());
    res.json({ success: true, data: await getTodayCheck(Number(req.params.id as string), date), timestamp: now() });
  } catch (error) {
    fail(res, error, 'Failed to load today\'s check', 'TODAY_CHECK_FAILED');
  }
});

router.post('/batches/:id/today', authenticate, requireSiteAccess(siteOf.batch()), requirePermission('daily_records:create'), validate(todayCheckSchema), async (req, res) => {
  try {
    const record = await saveTodayCheck({ ...req.body, batchId: Number(req.params.id as string), userId: req.user!.id });
    res.json({ success: true, data: record, timestamp: now() });
  } catch (error) {
    fail(res, error, 'Failed to save today\'s check', 'TODAY_CHECK_SAVE_FAILED');
  }
});

// ─── Vet visits ──────────────────────────────────────────────────────────────

router.get('/vet-visits', authenticate, requirePermission('batches:read'), async (req, res) => {
  try {
    const siteId = siteScope(req) ?? (req.query.siteId ? Number(req.query.siteId) : null);
    const rows = await db
      .select({
        id: vetVisits.id,
        siteId: vetVisits.siteId,
        siteName: sites.siteName,
        batchId: vetVisits.batchId,
        batchCode: batches.batchCode,
        visitDate: vetVisits.visitDate,
        vetName: vetVisits.vetName,
        reason: vetVisits.reason,
        findings: vetVisits.findings,
        diagnosis: vetVisits.diagnosis,
        treatment: vetVisits.treatment,
        feeAmount: vetVisits.feeAmount,
        followUpDate: vetVisits.followUpDate,
      })
      .from(vetVisits)
      .innerJoin(sites, eq(vetVisits.siteId, sites.id))
      .leftJoin(batches, eq(vetVisits.batchId, batches.id))
      .where(and(
        siteId ? eq(vetVisits.siteId, siteId) : undefined,
        req.query.batchId ? eq(vetVisits.batchId, Number(req.query.batchId)) : undefined,
      ))
      .orderBy(desc(vetVisits.visitDate));
    res.json({ success: true, data: rows, timestamp: now() });
  } catch (error) {
    fail(res, error, 'Failed to load vet visits', 'VET_VISITS_FAILED');
  }
});

async function checkVisitBatch(body: { siteId: number; batchId?: number | null }) {
  if (!body.batchId) return;
  const [batch] = await db.select({ siteId: batches.siteId }).from(batches).where(eq(batches.id, body.batchId)).limit(1);
  if (!batch) throw new FarmOpsError('Batch not found', 404, 'NOT_FOUND');
  if (batch.siteId !== body.siteId) throw new FarmOpsError('That batch is on a different farm');
}

router.post('/vet-visits', authenticate, requireSiteAccess(siteOf.bodyBatch()), requirePermission('vaccinations:create'), validate(vetVisitSchema), async (req, res) => {
  try {
    await checkVisitBatch(req.body);
    const [visit] = await db.insert(vetVisits).values({
      ...req.body,
      batchId: req.body.batchId ?? null,
      feeAmount: req.body.feeAmount != null ? String(req.body.feeAmount) : null,
      recordedBy: req.user!.id,
    }).returning();
    createAuditLog({ userId: req.user!.id, action: 'vet_visit_recorded', entityType: 'vet_visit', entityId: visit.id, changes: { batchId: visit.batchId, vetName: visit.vetName } });
    res.status(201).json({ success: true, data: visit, timestamp: now() });
  } catch (error) {
    fail(res, error, 'Failed to record vet visit', 'VET_VISIT_CREATE_FAILED');
  }
});

router.put('/vet-visits/:id', authenticate, requireSiteAccess(siteOf.vetVisit()), requirePermission('vaccinations:create'), validate(vetVisitSchema), async (req, res) => {
  try {
    await checkVisitBatch(req.body);
    const [visit] = await db.update(vetVisits).set({
      ...req.body,
      batchId: req.body.batchId ?? null,
      feeAmount: req.body.feeAmount != null ? String(req.body.feeAmount) : null,
      updatedAt: new Date(),
    }).where(eq(vetVisits.id, Number(req.params.id as string))).returning();
    if (!visit) throw new FarmOpsError('Vet visit not found', 404, 'NOT_FOUND');
    res.json({ success: true, data: visit, timestamp: now() });
  } catch (error) {
    fail(res, error, 'Failed to update vet visit', 'VET_VISIT_UPDATE_FAILED');
  }
});

// ─── House turnaround ────────────────────────────────────────────────────────

router.get('/turnarounds', authenticate, requirePermission('sites:read'), async (req, res) => {
  try {
    const siteId = siteScope(req) ?? (req.query.siteId ? Number(req.query.siteId) : null);
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    res.json({ success: true, data: await listTurnarounds({ siteId, status }), timestamp: now() });
  } catch (error) {
    fail(res, error, 'Failed to load house turnarounds', 'TURNAROUNDS_FAILED');
  }
});

router.put('/turnarounds/:id', authenticate, requireSiteAccess(siteOf.turnaround()), requirePermission('batches:update'), validate(turnaroundUpdateSchema), async (req, res) => {
  try {
    const updated = await updateTurnaround({ id: Number(req.params.id as string), ...req.body });
    createAuditLog({ userId: req.user!.id, action: 'house_turnaround_updated', entityType: 'house_turnaround', entityId: updated.id, changes: req.body });
    res.json({ success: true, data: updated, timestamp: now() });
  } catch (error) {
    fail(res, error, 'Failed to update house turnaround', 'TURNAROUND_UPDATE_FAILED');
  }
});

// ─── Batch history ───────────────────────────────────────────────────────────

router.get('/batch-history', authenticate, requirePermission('batches:read'), async (req, res) => {
  try {
    const siteId = siteScope(req) ?? (req.query.siteId ? Number(req.query.siteId) : null);
    const cageId = req.query.cageId ? Number(req.query.cageId) : null;
    res.json({ success: true, data: await getBatchHistory({ siteId, cageId }), timestamp: now() });
  } catch (error) {
    fail(res, error, 'Failed to load batch history', 'BATCH_HISTORY_FAILED');
  }
});

export default router;
