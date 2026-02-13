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
import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { createAuditLog } from '../lib/audit';
import { hasPermission } from '../lib/permissions';
import logger from '../lib/logger';

const router = Router();

// Helper: increment/decrement leave balance usedDays
async function adjustLeaveBalance(
  employeeId: number,
  year: number,
  delta: number,
  tx?: typeof db,
) {
  const database = tx ?? db;
  // Find a casual leave balance for the employee/year. If none exists, skip.
  const [balance] = await database
    .select()
    .from(leaveBalances)
    .where(
      and(
        eq(leaveBalances.employeeId, employeeId),
        eq(leaveBalances.year, year),
        eq(leaveBalances.leaveType, 'casual'),
      ),
    )
    .limit(1);

  if (balance) {
    const newUsed = Math.max(0, balance.usedDays + delta);
    await database
      .update(leaveBalances)
      .set({ usedDays: newUsed, updatedAt: new Date() })
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

    let query = db
      .select({
        id: attendance.id,
        employeeId: attendance.employeeId,
        employeeName: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
        attendanceDate: attendance.attendanceDate,
        status: attendance.status,
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

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query
      .orderBy(desc(attendance.attendanceDate))
      .limit(limitNum)
      .offset(offset);

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

// POST /api/attendance — record single attendance
router.post('/', authenticate, requirePermission('attendance:create'), validate(createAttendanceSchema), async (req: Request, res: Response) => {
  try {
    const { employeeId, attendanceDate, status, shiftId, notes } = req.body;

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

    const result = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(attendance)
        .values({
          employeeId,
          attendanceDate,
          status,
          shiftId: shiftId ?? null,
          notes: notes ?? null,
          recordedBy: req.user!.id,
        })
        .returning();

      // Auto-sync leave balance
      if (status === 'on_leave') {
        const year = new Date(attendanceDate).getFullYear();
        await adjustLeaveBalance(employeeId, year, 1, tx as unknown as typeof db);
      }

      return created;
    });

    createAuditLog({
      userId: req.user!.id,
      action: 'attendance.create',
      entityType: 'attendance',
      entityId: result.id,
      changes: { employeeId, attendanceDate, status },
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

    const results = await db.transaction(async (tx) => {
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

        const [inserted] = await tx
          .insert(attendance)
          .values({
            employeeId: record.employeeId,
            attendanceDate,
            status: record.status,
            shiftId: shiftId ?? null,
            notes: record.notes ?? null,
            recordedBy: req.user!.id,
          })
          .returning();

        if (record.status === 'on_leave') {
          const year = new Date(attendanceDate).getFullYear();
          await adjustLeaveBalance(record.employeeId, year, 1, tx as unknown as typeof db);
        }

        created.push(inserted);
      }
      return created;
    });

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

    const [existing] = await db
      .select()
      .from(attendance)
      .where(eq(attendance.id, id))
      .limit(1);

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

    const newStatus = req.body.status;
    const oldStatus = existing.status;

    const result = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(attendance)
        .set(req.body)
        .where(eq(attendance.id, id))
        .returning();

      // Sync leave balance if status changed to/from on_leave
      if (newStatus && newStatus !== oldStatus) {
        const year = new Date(existing.attendanceDate).getFullYear();
        if (oldStatus === 'on_leave' && newStatus !== 'on_leave') {
          await adjustLeaveBalance(existing.employeeId, year, -1, tx as unknown as typeof db);
        } else if (oldStatus !== 'on_leave' && newStatus === 'on_leave') {
          await adjustLeaveBalance(existing.employeeId, year, 1, tx as unknown as typeof db);
        }
      }

      return updated;
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

    const [existing] = await db
      .select()
      .from(attendance)
      .where(eq(attendance.id, id))
      .limit(1);

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

      // Rollback leave balance if was on_leave
      if (existing.status === 'on_leave') {
        const year = new Date(existing.attendanceDate).getFullYear();
        await adjustLeaveBalance(existing.employeeId, year, -1, tx as unknown as typeof db);
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
