import { Router, type Request, type Response } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate } from '../validators/auth';
import {
  createAttendanceSchema,
  bulkAttendanceSchema,
  updateAttendanceSchema,
} from '../validators/attendance';
import { db } from '../db';
import { attendance, shifts, leaveBalances, employees } from '../db/schema';
import { eq, and, sql, desc, gte, lte, asc } from 'drizzle-orm';
import { createAuditLog } from '../lib/audit';
import { hasPermission } from '../lib/permissions';
import logger from '../lib/logger';

const router = Router();

// Helper: compute leave delta for a status (1 for full leave, 0.5 for half_day, 0 otherwise)
function leaveDelta(status: string): number {
  if (status === 'on_leave') return 1;
  if (status === 'half_day') return 0.5;
  return 0;
}

function isMissingAttendanceOptionalSchema(error: unknown): boolean {
  const maybe = error as { code?: string; message?: string };
  const message = String(maybe?.message ?? '');

  if (maybe?.code === '42703' && (message.includes('leave_type') || message.includes('shift_id'))) {
    return true;
  }
  if (maybe?.code === '42P01' && message.includes('shifts')) {
    return true;
  }
  return false;
}

// Helper: increment/decrement leave balance usedDays for a specific leave type
async function adjustLeaveBalance(
  employeeId: number,
  year: number,
  delta: number,
  leaveType: string,
  tx?: typeof db,
) {
  if (delta === 0 || !leaveType) return;
  const database = tx ?? db;
  const [balance] = await database
    .select()
    .from(leaveBalances)
    .where(
      and(
        eq(leaveBalances.employeeId, employeeId),
        eq(leaveBalances.year, year),
        eq(leaveBalances.leaveType, leaveType),
      ),
    )
    .limit(1);

  if (balance) {
    const newUsed = Math.max(0, Number(balance.usedDays) + delta);
    await database
      .update(leaveBalances)
      .set({ usedDays: newUsed.toString(), updatedAt: new Date() })
      .where(eq(leaveBalances.id, balance.id));
  }
}

// GET /api/attendance — list attendance records
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    // Check permission: attendance:read or attendance:read_own
    const canReadAll = hasPermission(req.user!.userRole, 'attendance:read');
    const canReadOwn = hasPermission(req.user!.userRole, 'attendance:read_own');

    if (!canReadAll && !canReadOwn) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        statusCode: 403,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const {
      employeeId,
      startDate,
      endDate,
      status,
      siteId,
      page = '1',
      limit = '20',
    } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];

    // Site scoping for farm managers
    if (req.user!.siteId) {
      conditions.push(eq(employees.siteId, req.user!.siteId));
    }

    // Farm worker: only own attendance
    if (!canReadAll && canReadOwn) {
      conditions.push(eq(employees.userId, req.user!.id));
    }

    if (employeeId) {
      conditions.push(eq(attendance.employeeId, Number(employeeId)));
    }
    if (startDate) {
      conditions.push(gte(attendance.attendanceDate, startDate as string));
    }
    if (endDate) {
      conditions.push(lte(attendance.attendanceDate, endDate as string));
    }
    if (status && status !== 'all') {
      conditions.push(eq(attendance.status, status as string));
    }
    if (siteId) {
      conditions.push(eq(employees.siteId, Number(siteId)));
    }

    let results: Array<Record<string, unknown>> = [];
    try {
      let query = db
        .select({
          id: attendance.id,
          employeeId: attendance.employeeId,
          employeeName: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
          attendanceDate: attendance.attendanceDate,
          status: attendance.status,
          leaveType: attendance.leaveType,
          shiftId: attendance.shiftId,
          shiftName: shifts.shiftName,
          notes: attendance.notes,
          recordedBy: attendance.recordedBy,
          createdAt: attendance.createdAt,
        })
        .from(attendance)
        .leftJoin(employees, eq(attendance.employeeId, employees.id))
        .leftJoin(shifts, eq(attendance.shiftId, shifts.id))
        .$dynamic();

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      results = await query
        .orderBy(desc(attendance.attendanceDate))
        .limit(limitNum)
        .offset(offset);
    } catch (error) {
      if (!isMissingAttendanceOptionalSchema(error)) {
        throw error;
      }

      logger.warn('attendance optional schema missing; falling back to list without leave/shift fields');
      let fallbackQuery = db
        .select({
          id: attendance.id,
          employeeId: attendance.employeeId,
          employeeName: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
          attendanceDate: attendance.attendanceDate,
          status: attendance.status,
          leaveType: sql<string | null>`null`,
          shiftId: sql<number | null>`null`,
          shiftName: sql<string | null>`null`,
          notes: attendance.notes,
          recordedBy: attendance.recordedBy,
          createdAt: attendance.createdAt,
        })
        .from(attendance)
        .leftJoin(employees, eq(attendance.employeeId, employees.id))
        .$dynamic();

      if (conditions.length > 0) {
        fallbackQuery = fallbackQuery.where(and(...conditions));
      }

      results = await fallbackQuery
        .orderBy(desc(attendance.attendanceDate))
        .limit(limitNum)
        .offset(offset);
    }

    // Count query
    let countQuery = db
      .select({ total: sql<number>`count(*)::int` })
      .from(attendance)
      .leftJoin(employees, eq(attendance.employeeId, employees.id))
      .$dynamic();

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
    logger.error('Failed to list attendance', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to list attendance',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/attendance/summary — attendance summary stats
router.get('/summary', authenticate, requirePermission('attendance:read'), async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, siteId } = req.query;

    let query = db
      .select({
        totalPresent: sql<number>`count(*) filter (where ${attendance.status} = 'present')::int`,
        totalAbsent: sql<number>`count(*) filter (where ${attendance.status} = 'absent')::int`,
        totalOnLeave: sql<number>`count(*) filter (where ${attendance.status} = 'on_leave')::int`,
        totalHalfDay: sql<number>`count(*) filter (where ${attendance.status} = 'half_day')::int`,
        totalRecords: sql<number>`count(*)::int`,
      })
      .from(attendance)
      .leftJoin(employees, eq(attendance.employeeId, employees.id))
      .$dynamic();

    const conditions = [];

    if (req.user!.siteId) {
      conditions.push(eq(employees.siteId, req.user!.siteId));
    }
    if (startDate) {
      conditions.push(gte(attendance.attendanceDate, startDate as string));
    }
    if (endDate) {
      conditions.push(lte(attendance.attendanceDate, endDate as string));
    }
    if (siteId) {
      conditions.push(eq(employees.siteId, Number(siteId)));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const [result] = await query;

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get attendance summary', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get attendance summary',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/attendance/employees — lightweight employee options for attendance actions
router.get('/employees', authenticate, async (req: Request, res: Response) => {
  try {
    const canReadAll = hasPermission(req.user!.userRole, 'attendance:read');
    const canReadOwn = hasPermission(req.user!.userRole, 'attendance:read_own');
    const canCreate = hasPermission(req.user!.userRole, 'attendance:create');

    if (!canReadAll && !canReadOwn && !canCreate) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        statusCode: 403,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { status = 'active', siteId } = req.query;
    const conditions = [];

    if (status && status !== 'all') {
      conditions.push(eq(employees.status, status as string));
    }

    if (req.user!.siteId) {
      conditions.push(eq(employees.siteId, req.user!.siteId));
    } else if (siteId) {
      conditions.push(eq(employees.siteId, Number(siteId)));
    }

    if (!canReadAll && canReadOwn && !canCreate) {
      conditions.push(eq(employees.userId, req.user!.id));
    }

    let query = db
      .select({
        id: employees.id,
        firstName: employees.firstName,
        lastName: employees.lastName,
        status: employees.status,
        siteId: employees.siteId,
      })
      .from(employees)
      .$dynamic();

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const result = await query
      .orderBy(asc(employees.firstName), asc(employees.lastName));

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to list attendance employee options', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to list attendance employee options',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// POST /api/attendance — record single attendance
router.post('/', authenticate, requirePermission('attendance:create'), validate(createAttendanceSchema), async (req: Request, res: Response) => {
  try {
    const { employeeId, attendanceDate, status, leaveType, shiftId, notes } = req.body;

    // Check for duplicate
    const [existing] = await db
      .select({ id: attendance.id })
      .from(attendance)
      .where(
        and(
          eq(attendance.employeeId, employeeId),
          eq(attendance.attendanceDate, attendanceDate),
        ),
      )
      .limit(1);

    if (existing) {
      res.status(409).json({
        success: false,
        error: 'Attendance already recorded for this employee on this date',
        code: 'DUPLICATE_ATTENDANCE',
        statusCode: 409,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    let result;
    try {
      result = await db.transaction(async (tx) => {
        const isLeave = status === 'on_leave' || status === 'half_day';

        const [created] = await tx
          .insert(attendance)
          .values({
            employeeId,
            attendanceDate,
            status,
            leaveType: isLeave ? leaveType : null,
            shiftId: shiftId ?? null,
            notes: notes ?? null,
            recordedBy: req.user!.id,
          })
          .returning();

        // Auto-sync leave balance
        if (isLeave && leaveType) {
          const year = new Date(attendanceDate).getFullYear();
          const delta = leaveDelta(status);
          await adjustLeaveBalance(employeeId, year, delta, leaveType, tx as unknown as typeof db);
        }

        return created;
      });
    } catch (error) {
      if (!isMissingAttendanceOptionalSchema(error)) {
        throw error;
      }

      logger.warn('attendance optional schema missing; recording attendance without leave/shift support');
      result = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(attendance)
          .values({
            employeeId,
            attendanceDate,
            status,
            notes: notes ?? null,
            recordedBy: req.user!.id,
          })
          .returning({ id: attendance.id });

        return {
          id: created.id,
          employeeId,
          attendanceDate,
          status,
          leaveType: null,
          shiftId: null,
          notes: notes ?? null,
          recordedBy: req.user!.id,
        };
      });
    }

    createAuditLog({
      userId: req.user!.id,
      action: 'attendance.create',
      entityType: 'attendance',
      entityId: result.id,
      changes: { employeeId, attendanceDate, status, leaveType: leaveType ?? null },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to record attendance', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to record attendance',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// POST /api/attendance/bulk — bulk record attendance
router.post('/bulk', authenticate, requirePermission('attendance:create'), validate(bulkAttendanceSchema), async (req: Request, res: Response) => {
  try {
    const { attendanceDate, shiftId, records } = req.body;

    let results;
    try {
      results = await db.transaction(async (tx) => {
        const created = [];
        for (const record of records) {
          // Skip duplicates
          const [existing] = await tx
            .select({ id: attendance.id })
            .from(attendance)
            .where(
              and(
                eq(attendance.employeeId, record.employeeId),
                eq(attendance.attendanceDate, attendanceDate),
              ),
            )
            .limit(1);

          if (existing) continue;

          const isLeave = record.status === 'on_leave' || record.status === 'half_day';

          const [inserted] = await tx
            .insert(attendance)
            .values({
              employeeId: record.employeeId,
              attendanceDate,
              status: record.status,
              leaveType: isLeave ? record.leaveType : null,
              shiftId: shiftId ?? null,
              notes: record.notes ?? null,
              recordedBy: req.user!.id,
            })
            .returning();

          if (isLeave && record.leaveType) {
            const year = new Date(attendanceDate).getFullYear();
            const delta = leaveDelta(record.status);
            await adjustLeaveBalance(record.employeeId, year, delta, record.leaveType, tx as unknown as typeof db);
          }

          created.push(inserted);
        }
        return created;
      });
    } catch (error) {
      if (!isMissingAttendanceOptionalSchema(error)) {
        throw error;
      }

      logger.warn('attendance optional schema missing; bulk recording attendance without leave/shift support');
      results = await db.transaction(async (tx) => {
        const created = [];
        for (const record of records) {
          const [existing] = await tx
            .select({ id: attendance.id })
            .from(attendance)
            .where(
              and(
                eq(attendance.employeeId, record.employeeId),
                eq(attendance.attendanceDate, attendanceDate),
              ),
            )
            .limit(1);

          if (existing) continue;

          const [inserted] = await tx
            .insert(attendance)
            .values({
              employeeId: record.employeeId,
              attendanceDate,
              status: record.status,
              notes: record.notes ?? null,
              recordedBy: req.user!.id,
            })
            .returning({ id: attendance.id });

          created.push({
            id: inserted.id,
            employeeId: record.employeeId,
            attendanceDate,
            status: record.status,
            leaveType: null,
            shiftId: null,
            notes: record.notes ?? null,
            recordedBy: req.user!.id,
          });
        }
        return created;
      });
    }

    createAuditLog({
      userId: req.user!.id,
      action: 'attendance.bulk_create',
      entityType: 'attendance',
      changes: { attendanceDate, count: results.length },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      data: results,
      total: results.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to bulk record attendance', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to bulk record attendance',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// PUT /api/attendance/:id — update attendance record
router.put('/:id', authenticate, requirePermission('attendance:update'), validate(updateAttendanceSchema), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id as string);

    let hasLeaveTypeColumn = true;
    let existing: {
      id: number;
      employeeId: number;
      attendanceDate: string;
      status: string;
      leaveType: string | null;
    } | undefined;

    try {
      [existing] = await db
        .select({
          id: attendance.id,
          employeeId: attendance.employeeId,
          attendanceDate: attendance.attendanceDate,
          status: attendance.status,
          leaveType: attendance.leaveType,
        })
        .from(attendance)
        .where(eq(attendance.id, id))
        .limit(1);
    } catch (error) {
      if (!isMissingAttendanceOptionalSchema(error)) {
        throw error;
      }

      hasLeaveTypeColumn = false;
      logger.warn('attendance optional schema missing; updating attendance without leave/shift support');
      const [fallbackExisting] = await db
        .select({
          id: attendance.id,
          employeeId: attendance.employeeId,
          attendanceDate: attendance.attendanceDate,
          status: attendance.status,
        })
        .from(attendance)
        .where(eq(attendance.id, id))
        .limit(1);
      existing = fallbackExisting ? { ...fallbackExisting, leaveType: null } : undefined;
    }

    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'Attendance record not found',
        code: 'NOT_FOUND',
        statusCode: 404,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const newStatus = req.body.status ?? existing.status;
    const newLeaveType = hasLeaveTypeColumn
      ? (req.body.leaveType !== undefined ? req.body.leaveType : existing.leaveType)
      : null;
    const oldStatus = existing.status;
    const oldLeaveType = hasLeaveTypeColumn ? existing.leaveType : null;

    // Build update payload
    const updatePayload: Record<string, unknown> = { ...req.body };
    // Clear leaveType if new status is not a leave status
    const isNewLeave = newStatus === 'on_leave' || newStatus === 'half_day';
    if (!isNewLeave && hasLeaveTypeColumn) {
      updatePayload.leaveType = null;
    }
    if (!hasLeaveTypeColumn) {
      delete updatePayload.leaveType;
      delete updatePayload.shiftId;
    }

    const result = await db.transaction(async (tx) => {
      const [updated] = hasLeaveTypeColumn
        ? await tx
          .update(attendance)
          .set(updatePayload)
          .where(eq(attendance.id, id))
          .returning()
        : await tx
          .update(attendance)
          .set(updatePayload)
          .where(eq(attendance.id, id))
          .returning({
            id: attendance.id,
            employeeId: attendance.employeeId,
            attendanceDate: attendance.attendanceDate,
            status: attendance.status,
            notes: attendance.notes,
            recordedBy: attendance.recordedBy,
            createdAt: attendance.createdAt,
          });

      if (hasLeaveTypeColumn) {
        // Sync leave balances when status or leaveType changed
        const year = new Date(existing.attendanceDate).getFullYear();
        const oldIsLeave = oldStatus === 'on_leave' || oldStatus === 'half_day';
        const oldDelta = leaveDelta(oldStatus);
        const newDelta = leaveDelta(newStatus);

        // Rollback old leave balance if applicable
        if (oldIsLeave && oldLeaveType && (oldStatus !== newStatus || oldLeaveType !== newLeaveType)) {
          await adjustLeaveBalance(existing.employeeId, year, -oldDelta, oldLeaveType, tx as unknown as typeof db);
        }

        // Apply new leave balance if applicable
        if (isNewLeave && newLeaveType && (oldStatus !== newStatus || oldLeaveType !== newLeaveType)) {
          await adjustLeaveBalance(existing.employeeId, year, newDelta, newLeaveType, tx as unknown as typeof db);
        }
      }

      if (hasLeaveTypeColumn) {
        return updated;
      }

      return {
        ...updated,
        leaveType: null,
        shiftId: null,
      };
    });

    createAuditLog({
      userId: req.user!.id,
      action: 'attendance.update',
      entityType: 'attendance',
      entityId: id,
      changes: req.body,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to update attendance', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to update attendance',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// DELETE /api/attendance/:id — delete attendance record
router.delete('/:id', authenticate, requirePermission('attendance:delete'), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id as string);

    let hasLeaveTypeColumn = true;
    let existing: {
      id: number;
      employeeId: number;
      attendanceDate: string;
      status: string;
      leaveType: string | null;
    } | undefined;

    try {
      [existing] = await db
        .select({
          id: attendance.id,
          employeeId: attendance.employeeId,
          attendanceDate: attendance.attendanceDate,
          status: attendance.status,
          leaveType: attendance.leaveType,
        })
        .from(attendance)
        .where(eq(attendance.id, id))
        .limit(1);
    } catch (error) {
      if (!isMissingAttendanceOptionalSchema(error)) {
        throw error;
      }

      hasLeaveTypeColumn = false;
      logger.warn('attendance optional schema missing; deleting attendance without leave rollback');
      const [fallbackExisting] = await db
        .select({
          id: attendance.id,
          employeeId: attendance.employeeId,
          attendanceDate: attendance.attendanceDate,
          status: attendance.status,
        })
        .from(attendance)
        .where(eq(attendance.id, id))
        .limit(1);
      existing = fallbackExisting ? { ...fallbackExisting, leaveType: null } : undefined;
    }

    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'Attendance record not found',
        code: 'NOT_FOUND',
        statusCode: 404,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    await db.transaction(async (tx) => {
      await tx.delete(attendance).where(eq(attendance.id, id));

      if (hasLeaveTypeColumn) {
        // Rollback leave balance if was on_leave or half_day
        const isLeave = existing.status === 'on_leave' || existing.status === 'half_day';
        if (isLeave && existing.leaveType) {
          const year = new Date(existing.attendanceDate).getFullYear();
          const delta = leaveDelta(existing.status);
          await adjustLeaveBalance(existing.employeeId, year, -delta, existing.leaveType, tx as unknown as typeof db);
        }
      }
    });

    createAuditLog({
      userId: req.user!.id,
      action: 'attendance.delete',
      entityType: 'attendance',
      entityId: id,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      data: { message: 'Attendance record deleted' },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to delete attendance', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to delete attendance',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
