import { Router, type Request, type Response } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate } from '../validators/auth';
import { setLeaveBalanceSchema, updateLeaveBalanceSchema, bulkSetLeaveBalanceSchema } from '../validators/attendance';
import { db } from '../db';
import { leaveBalances, employees } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { createAuditLog } from '../lib/audit';
import logger from '../lib/logger';

const router = Router();

// GET /api/leave-balances — list leave balances
router.get('/', authenticate, requirePermission('attendance:read'), async (req: Request, res: Response) => {
  try {
    const { employeeId, year } = req.query;
    const currentYear = year ? Number(year) : new Date().getFullYear();

    let query = db
      .select({
        id: leaveBalances.id,
        employeeId: leaveBalances.employeeId,
        employeeName: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
        leaveType: leaveBalances.leaveType,
        year: leaveBalances.year,
        totalDays: leaveBalances.totalDays,
        usedDays: leaveBalances.usedDays,
        balanceDays: sql<number>`${leaveBalances.totalDays} - ${leaveBalances.usedDays}`,
        createdAt: leaveBalances.createdAt,
        updatedAt: leaveBalances.updatedAt,
      })
      .from(leaveBalances)
      .leftJoin(employees, eq(leaveBalances.employeeId, employees.id))
      .$dynamic();

    const conditions = [];

    conditions.push(eq(leaveBalances.year, currentYear));

    // Site scoping for farm managers
    if (req.user!.siteId) {
      conditions.push(eq(employees.siteId, req.user!.siteId));
    }

    if (employeeId) {
      conditions.push(eq(leaveBalances.employeeId, Number(employeeId)));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query.orderBy(
      sql`${employees.firstName} ASC, ${employees.lastName} ASC, ${leaveBalances.leaveType} ASC`
    );

    res.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to list leave balances', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to list leave balances',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/leave-balances/:employeeId — get employee's leave balances for current year
router.get('/:employeeId', authenticate, requirePermission('attendance:read'), async (req: Request, res: Response) => {
  try {
    const empId = Number(req.params.employeeId as string);
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();

    const results = await db
      .select({
        id: leaveBalances.id,
        employeeId: leaveBalances.employeeId,
        leaveType: leaveBalances.leaveType,
        year: leaveBalances.year,
        totalDays: leaveBalances.totalDays,
        usedDays: leaveBalances.usedDays,
        balanceDays: sql<number>`${leaveBalances.totalDays} - ${leaveBalances.usedDays}`,
        createdAt: leaveBalances.createdAt,
        updatedAt: leaveBalances.updatedAt,
      })
      .from(leaveBalances)
      .where(and(eq(leaveBalances.employeeId, empId), eq(leaveBalances.year, year)));

    res.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get employee leave balances', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get employee leave balances',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// POST /api/leave-balances/bulk — bulk create/set leave balances
router.post('/bulk', authenticate, requirePermission('attendance:create'), validate(bulkSetLeaveBalanceSchema), async (req: Request, res: Response) => {
  try {
    const { year, balances } = req.body;

    const results = await db.transaction(async (tx) => {
      const changed = [];
      let createdCount = 0;
      let updatedCount = 0;
      for (const balance of balances) {
        // Upsert: update if exists, insert if not
        const [existing] = await tx
          .select()
          .from(leaveBalances)
          .where(
            and(
              eq(leaveBalances.employeeId, balance.employeeId),
              eq(leaveBalances.leaveType, balance.leaveType),
              eq(leaveBalances.year, year),
            ),
          )
          .limit(1);

        let result;
        if (existing) {
          [result] = await tx
            .update(leaveBalances)
            .set({ totalDays: balance.totalDays.toString(), updatedAt: new Date() })
            .where(eq(leaveBalances.id, existing.id))
            .returning();
          updatedCount += 1;
        } else {
          [result] = await tx
            .insert(leaveBalances)
            .values({
              employeeId: balance.employeeId,
              leaveType: balance.leaveType,
              year,
              totalDays: balance.totalDays.toString(),
            })
            .returning();
          createdCount += 1;
        }
        changed.push(result);
      }
      return { changed, createdCount, updatedCount };
    });

    createAuditLog({
      userId: req.user!.id,
      action: 'leave_balance.bulk_update',
      entityType: 'leave_balance',
      changes: { year, count: results.changed.length, createdCount: results.createdCount, updatedCount: results.updatedCount },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      data: results.changed,
      total: results.changed.length,
      meta: { createdCount: results.createdCount, updatedCount: results.updatedCount },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to bulk set leave balances', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to bulk set leave balances',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// POST /api/leave-balances — create/set leave balance (upsert)
router.post('/', authenticate, requirePermission('attendance:create'), validate(setLeaveBalanceSchema), async (req: Request, res: Response) => {
  try {
    const { employeeId, leaveType, year, totalDays } = req.body;

    // Check if employee exists
    const [emp] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.id, employeeId))
      .limit(1);

    if (!emp) {
      res.status(404).json({
        success: false,
        error: 'Employee not found',
        code: 'NOT_FOUND',
        statusCode: 404,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Upsert: update if exists, insert if not
    const [existing] = await db
      .select()
      .from(leaveBalances)
      .where(
        and(
          eq(leaveBalances.employeeId, employeeId),
          eq(leaveBalances.leaveType, leaveType),
          eq(leaveBalances.year, year),
        ),
      )
      .limit(1);

    let result;
    if (existing) {
      [result] = await db
        .update(leaveBalances)
        .set({ totalDays: totalDays.toString(), updatedAt: new Date() }) // string for decimal
        .where(eq(leaveBalances.id, existing.id))
        .returning();
    } else {
      [result] = await db
        .insert(leaveBalances)
        .values({ employeeId, leaveType, year, totalDays: totalDays.toString() }) // string for decimal
        .returning();
    }

    createAuditLog({
      userId: req.user!.id,
      action: existing ? 'leave_balance.update' : 'leave_balance.create',
      entityType: 'leave_balance',
      entityId: result.id,
      changes: { employeeId, leaveType, year, totalDays },
      ipAddress: req.ip,
    });

    res.status(existing ? 200 : 201).json({
      success: true,
      data: {
        ...result,
        balanceDays: Number(result.totalDays) - Number(result.usedDays),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to set leave balance', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to set leave balance',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// PUT /api/leave-balances/:id — update leave balance
router.put('/:id', authenticate, requirePermission('attendance:update'), validate(updateLeaveBalanceSchema), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id as string);

    const [existing] = await db
      .select()
      .from(leaveBalances)
      .where(eq(leaveBalances.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'Leave balance not found',
        code: 'NOT_FOUND',
        statusCode: 404,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const [updated] = await db
      .update(leaveBalances)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(leaveBalances.id, id))
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'leave_balance.update',
      entityType: 'leave_balance',
      entityId: id,
      changes: req.body,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      data: {
        ...updated,
        balanceDays: Number(updated.totalDays) - Number(updated.usedDays),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to update leave balance', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to update leave balance',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
