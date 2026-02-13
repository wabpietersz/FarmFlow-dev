import { Router, type Request, type Response } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate } from '../validators/auth';
import {
  createPayrollSchema,
  generatePayrollSchema,
  updatePayrollSchema,
  updatePayrollStatusSchema,
  createDeductionSchema,
  createAllowanceSchema,
} from '../validators/payroll';
import { db } from '../db';
import { payroll, payrollDeductions, payrollAllowances, employees, attendance } from '../db/schema';
import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { createAuditLog } from '../lib/audit';
import logger from '../lib/logger';

const router = Router();

// Helper: recalculate payroll totals (gross + net) from base, overtime, allowances, deductions
async function recalculatePayrollTotals(payrollId: number, tx?: typeof db) {
  const database = tx ?? db;

  const [record] = await database
    .select()
    .from(payroll)
    .where(eq(payroll.id, payrollId))
    .limit(1);

  if (!record) return;

  const [allowanceSum] = await database
    .select({ total: sql<string>`coalesce(sum(${payrollAllowances.amount}), 0)` })
    .from(payrollAllowances)
    .where(eq(payrollAllowances.payrollId, payrollId));

  const [deductionSum] = await database
    .select({ total: sql<string>`coalesce(sum(${payrollDeductions.amount}), 0)` })
    .from(payrollDeductions)
    .where(eq(payrollDeductions.payrollId, payrollId));

  const baseSalary = Number(record.baseSalary);
  const workingDays = record.workingDays;
  const attendedDays = record.attendedDays;
  const overtimeHours = Number(record.overtimeHours ?? 0);
  const overtimeRate = Number(record.overtimeRate ?? 0);

  const proRatedBase = workingDays > 0 ? (baseSalary / workingDays) * attendedDays : 0;
  const overtimePay = overtimeHours * overtimeRate;
  const totalAllowances = Number(allowanceSum.total);
  const totalDeductions = Number(deductionSum.total);

  const grossSalary = proRatedBase + overtimePay + totalAllowances;
  const netSalary = Math.max(0, grossSalary - totalDeductions);

  await database
    .update(payroll)
    .set({
      grossSalary: grossSalary.toFixed(2),
      netSalary: netSalary.toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(payroll.id, payrollId));
}

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string> = {
  draft: 'reviewed',
  reviewed: 'approved',
  approved: 'paid',
};

// GET /api/payroll — list payroll records
router.get('/', authenticate, requirePermission('payroll:read'), async (req: Request, res: Response) => {
  try {
    const { employeeId, payPeriod, status, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    let query = db
      .select({
        id: payroll.id,
        employeeId: payroll.employeeId,
        employeeName: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
        payPeriod: payroll.payPeriod,
        baseSalary: payroll.baseSalary,
        workingDays: payroll.workingDays,
        attendedDays: payroll.attendedDays,
        overtimeHours: payroll.overtimeHours,
        overtimeRate: payroll.overtimeRate,
        grossSalary: payroll.grossSalary,
        netSalary: payroll.netSalary,
        status: payroll.status,
        approvedBy: payroll.approvedBy,
        paidDate: payroll.paidDate,
        notes: payroll.notes,
        createdAt: payroll.createdAt,
        updatedAt: payroll.updatedAt,
      })
      .from(payroll)
      .leftJoin(employees, eq(payroll.employeeId, employees.id))
      .$dynamic();

    const conditions = [];

    // Site scoping for farm managers
    if (req.user!.siteId) {
      conditions.push(eq(employees.siteId, req.user!.siteId));
    }

    if (employeeId) {
      conditions.push(eq(payroll.employeeId, Number(employeeId)));
    }
    if (payPeriod) {
      conditions.push(eq(payroll.payPeriod, payPeriod as string));
    }
    if (status && status !== 'all') {
      conditions.push(eq(payroll.status, status as string));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query
      .orderBy(desc(payroll.createdAt))
      .limit(limitNum)
      .offset(offset);

    // Count
    let countQuery = db
      .select({ total: sql<number>`count(*)::int` })
      .from(payroll)
      .leftJoin(employees, eq(payroll.employeeId, employees.id))
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
    logger.error('Failed to list payroll', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to list payroll',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/payroll/:id — payroll detail with deductions and allowances
router.get('/:id', authenticate, requirePermission('payroll:read'), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id as string);

    const [record] = await db
      .select({
        id: payroll.id,
        employeeId: payroll.employeeId,
        employeeName: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
        designation: employees.designation,
        payPeriod: payroll.payPeriod,
        baseSalary: payroll.baseSalary,
        workingDays: payroll.workingDays,
        attendedDays: payroll.attendedDays,
        overtimeHours: payroll.overtimeHours,
        overtimeRate: payroll.overtimeRate,
        grossSalary: payroll.grossSalary,
        netSalary: payroll.netSalary,
        status: payroll.status,
        approvedBy: payroll.approvedBy,
        paidDate: payroll.paidDate,
        notes: payroll.notes,
        createdAt: payroll.createdAt,
        updatedAt: payroll.updatedAt,
      })
      .from(payroll)
      .leftJoin(employees, eq(payroll.employeeId, employees.id))
      .where(eq(payroll.id, id))
      .limit(1);

    if (!record) {
      res.status(404).json({
        success: false,
        error: 'Payroll record not found',
        code: 'NOT_FOUND',
        statusCode: 404,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const deductions = await db
      .select()
      .from(payrollDeductions)
      .where(eq(payrollDeductions.payrollId, id));

    const allowances = await db
      .select()
      .from(payrollAllowances)
      .where(eq(payrollAllowances.payrollId, id));

    const totalDeductions = deductions.reduce((sum, d) => sum + Number(d.amount), 0);
    const totalAllowances = allowances.reduce((sum, a) => sum + Number(a.amount), 0);

    res.json({
      success: true,
      data: {
        ...record,
        deductions,
        allowances,
        totalDeductions,
        totalAllowances,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get payroll detail', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get payroll detail',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// POST /api/payroll — create individual payroll (draft)
router.post('/', authenticate, requirePermission('payroll:create'), validate(createPayrollSchema), async (req: Request, res: Response) => {
  try {
    const { employeeId, payPeriod, baseSalary, workingDays, overtimeHours = 0, overtimeRate = 0, notes } = req.body;

    // Check employee exists
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

    // Calculate attended days from attendance records for the pay period month
    const periodDate = new Date(payPeriod);
    const startDate = new Date(periodDate.getFullYear(), periodDate.getMonth(), 1)
      .toISOString().split('T')[0];
    const endDate = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 0)
      .toISOString().split('T')[0];

    const [attendanceCount] = await db
      .select({
        present: sql<number>`count(*) filter (where ${attendance.status} in ('present', 'half_day'))::int`,
        halfDays: sql<number>`count(*) filter (where ${attendance.status} = 'half_day')::int`,
      })
      .from(attendance)
      .where(
        and(
          eq(attendance.employeeId, employeeId),
          gte(attendance.attendanceDate, startDate),
          lte(attendance.attendanceDate, endDate),
        ),
      );

    // Half days count as 0.5
    const attendedDays = (attendanceCount.present - attendanceCount.halfDays) + (attendanceCount.halfDays * 0.5);

    const proRatedBase = workingDays > 0 ? (baseSalary / workingDays) * attendedDays : 0;
    const overtimePay = overtimeHours * overtimeRate;
    const grossSalary = proRatedBase + overtimePay;
    const netSalary = grossSalary;

    const [created] = await db
      .insert(payroll)
      .values({
        employeeId,
        payPeriod,
        baseSalary: baseSalary.toFixed(2),
        workingDays,
        attendedDays: Math.round(attendedDays),
        overtimeHours: overtimeHours.toFixed(2),
        overtimeRate: overtimeRate ? overtimeRate.toFixed(2) : null,
        grossSalary: grossSalary.toFixed(2),
        netSalary: netSalary.toFixed(2),
        status: 'draft',
        notes: notes ?? null,
      })
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'payroll.create',
      entityType: 'payroll',
      entityId: created.id,
      changes: { employeeId, payPeriod, baseSalary, attendedDays },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      data: created,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to create payroll', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to create payroll',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// POST /api/payroll/generate — batch generate payroll for all active employees
router.post('/generate', authenticate, requirePermission('payroll:create'), validate(generatePayrollSchema), async (req: Request, res: Response) => {
  try {
    const { payPeriod, workingDays } = req.body;

    // Get all active employees
    const conditions = [eq(employees.status, 'active')];
    if (req.user!.siteId) {
      conditions.push(eq(employees.siteId, req.user!.siteId));
    }

    const activeEmployees = await db
      .select({ id: employees.id })
      .from(employees)
      .where(and(...conditions));

    if (activeEmployees.length === 0) {
      res.status(404).json({
        success: false,
        error: 'No active employees found',
        code: 'NO_EMPLOYEES',
        statusCode: 404,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const periodDate = new Date(payPeriod);
    const startDate = new Date(periodDate.getFullYear(), periodDate.getMonth(), 1)
      .toISOString().split('T')[0];
    const endDate = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 0)
      .toISOString().split('T')[0];

    const created = await db.transaction(async (tx) => {
      const results = [];

      for (const emp of activeEmployees) {
        // Skip if payroll already exists for this employee and period
        const [existing] = await tx
          .select({ id: payroll.id })
          .from(payroll)
          .where(
            and(
              eq(payroll.employeeId, emp.id),
              eq(payroll.payPeriod, payPeriod),
            ),
          )
          .limit(1);

        if (existing) continue;

        // Count attendance
        const [attendanceCount] = await tx
          .select({
            present: sql<number>`count(*) filter (where ${attendance.status} in ('present', 'half_day'))::int`,
            halfDays: sql<number>`count(*) filter (where ${attendance.status} = 'half_day')::int`,
          })
          .from(attendance)
          .where(
            and(
              eq(attendance.employeeId, emp.id),
              gte(attendance.attendanceDate, startDate),
              lte(attendance.attendanceDate, endDate),
            ),
          );

        const attendedDays = (attendanceCount.present - attendanceCount.halfDays) + (attendanceCount.halfDays * 0.5);

        // Create draft with baseSalary = 0 (to be filled in manually or via update)
        const [record] = await tx
          .insert(payroll)
          .values({
            employeeId: emp.id,
            payPeriod,
            baseSalary: '0.00',
            workingDays,
            attendedDays: Math.round(attendedDays),
            overtimeHours: '0',
            grossSalary: '0.00',
            netSalary: '0.00',
            status: 'draft',
          })
          .returning();

        results.push(record);
      }

      return results;
    });

    createAuditLog({
      userId: req.user!.id,
      action: 'payroll.generate',
      entityType: 'payroll',
      changes: { payPeriod, workingDays, count: created.length },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      data: created,
      total: created.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to generate payroll', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to generate payroll',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// PUT /api/payroll/:id — update payroll (draft only)
router.put('/:id', authenticate, requirePermission('payroll:update'), validate(updatePayrollSchema), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id as string);

    const [existing] = await db
      .select()
      .from(payroll)
      .where(eq(payroll.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'Payroll record not found',
        code: 'NOT_FOUND',
        statusCode: 404,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (existing.status !== 'draft') {
      res.status(400).json({
        success: false,
        error: 'Only draft payroll records can be edited',
        code: 'INVALID_STATUS',
        statusCode: 400,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (req.body.notes !== undefined) updateData.notes = req.body.notes;
    if (req.body.overtimeHours !== undefined) updateData.overtimeHours = req.body.overtimeHours.toFixed(2);
    if (req.body.overtimeRate !== undefined) updateData.overtimeRate = req.body.overtimeRate.toFixed(2);

    const [updated] = await db
      .update(payroll)
      .set(updateData)
      .where(eq(payroll.id, id))
      .returning();

    // Recalculate totals if overtime changed
    if (req.body.overtimeHours !== undefined || req.body.overtimeRate !== undefined) {
      await recalculatePayrollTotals(id);
    }

    const [refreshed] = await db
      .select()
      .from(payroll)
      .where(eq(payroll.id, id))
      .limit(1);

    createAuditLog({
      userId: req.user!.id,
      action: 'payroll.update',
      entityType: 'payroll',
      entityId: id,
      changes: req.body,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      data: refreshed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to update payroll', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to update payroll',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// PUT /api/payroll/:id/status — advance payroll status
router.put('/:id/status', authenticate, requirePermission('payroll:update'), validate(updatePayrollStatusSchema), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id as string);
    const { status: newStatus } = req.body;

    const [existing] = await db
      .select()
      .from(payroll)
      .where(eq(payroll.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'Payroll record not found',
        code: 'NOT_FOUND',
        statusCode: 404,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Validate transition
    const expectedNext = VALID_TRANSITIONS[existing.status];
    if (!expectedNext || expectedNext !== newStatus) {
      res.status(400).json({
        success: false,
        error: `Cannot transition from '${existing.status}' to '${newStatus}'. Expected next: '${expectedNext || 'none'}'`,
        code: 'INVALID_TRANSITION',
        statusCode: 400,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const updateData: Record<string, unknown> = {
      status: newStatus,
      updatedAt: new Date(),
    };

    if (newStatus === 'approved') {
      updateData.approvedBy = req.user!.id;
    }
    if (newStatus === 'paid') {
      updateData.paidDate = new Date().toISOString().split('T')[0];
    }

    const [updated] = await db
      .update(payroll)
      .set(updateData)
      .where(eq(payroll.id, id))
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: `payroll.status.${newStatus}`,
      entityType: 'payroll',
      entityId: id,
      changes: { from: existing.status, to: newStatus },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      data: updated,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to update payroll status', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to update payroll status',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// POST /api/payroll/:id/deductions — add deduction
router.post('/:id/deductions', authenticate, requirePermission('payroll:update'), validate(createDeductionSchema), async (req: Request, res: Response) => {
  try {
    const payrollId = Number(req.params.id as string);

    const [existing] = await db
      .select()
      .from(payroll)
      .where(eq(payroll.id, payrollId))
      .limit(1);

    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'Payroll record not found',
        code: 'NOT_FOUND',
        statusCode: 404,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (existing.status !== 'draft' && existing.status !== 'reviewed') {
      res.status(400).json({
        success: false,
        error: 'Deductions can only be added to draft or reviewed payrolls',
        code: 'INVALID_STATUS',
        statusCode: 400,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { deductionType, amount, remarks } = req.body;

    const [created] = await db
      .insert(payrollDeductions)
      .values({
        payrollId,
        deductionType,
        amount: amount.toFixed(2),
        remarks: remarks ?? null,
      })
      .returning();

    // Recalculate totals
    await recalculatePayrollTotals(payrollId);

    createAuditLog({
      userId: req.user!.id,
      action: 'payroll.deduction.add',
      entityType: 'payroll_deduction',
      entityId: created.id,
      changes: { payrollId, deductionType, amount },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      data: created,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to add deduction', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to add deduction',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// DELETE /api/payroll/:id/deductions/:deductionId — remove deduction
router.delete('/:id/deductions/:deductionId', authenticate, requirePermission('payroll:update'), async (req: Request, res: Response) => {
  try {
    const payrollId = Number(req.params.id as string);
    const deductionId = Number(req.params.deductionId as string);

    const [existing] = await db
      .select()
      .from(payroll)
      .where(eq(payroll.id, payrollId))
      .limit(1);

    if (!existing || (existing.status !== 'draft' && existing.status !== 'reviewed')) {
      res.status(400).json({
        success: false,
        error: 'Cannot remove deduction from this payroll',
        code: 'INVALID_STATUS',
        statusCode: 400,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    await db.delete(payrollDeductions).where(
      and(
        eq(payrollDeductions.id, deductionId),
        eq(payrollDeductions.payrollId, payrollId),
      ),
    );

    await recalculatePayrollTotals(payrollId);

    createAuditLog({
      userId: req.user!.id,
      action: 'payroll.deduction.remove',
      entityType: 'payroll_deduction',
      entityId: deductionId,
      changes: { payrollId },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      data: { message: 'Deduction removed' },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to remove deduction', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to remove deduction',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// POST /api/payroll/:id/allowances — add allowance
router.post('/:id/allowances', authenticate, requirePermission('payroll:update'), validate(createAllowanceSchema), async (req: Request, res: Response) => {
  try {
    const payrollId = Number(req.params.id as string);

    const [existing] = await db
      .select()
      .from(payroll)
      .where(eq(payroll.id, payrollId))
      .limit(1);

    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'Payroll record not found',
        code: 'NOT_FOUND',
        statusCode: 404,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (existing.status !== 'draft' && existing.status !== 'reviewed') {
      res.status(400).json({
        success: false,
        error: 'Allowances can only be added to draft or reviewed payrolls',
        code: 'INVALID_STATUS',
        statusCode: 400,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { allowanceType, amount, remarks } = req.body;

    const [created] = await db
      .insert(payrollAllowances)
      .values({
        payrollId,
        allowanceType,
        amount: amount.toFixed(2),
        remarks: remarks ?? null,
      })
      .returning();

    // Recalculate totals
    await recalculatePayrollTotals(payrollId);

    createAuditLog({
      userId: req.user!.id,
      action: 'payroll.allowance.add',
      entityType: 'payroll_allowance',
      entityId: created.id,
      changes: { payrollId, allowanceType, amount },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      data: created,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to add allowance', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to add allowance',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// DELETE /api/payroll/:id/allowances/:allowanceId — remove allowance
router.delete('/:id/allowances/:allowanceId', authenticate, requirePermission('payroll:update'), async (req: Request, res: Response) => {
  try {
    const payrollId = Number(req.params.id as string);
    const allowanceId = Number(req.params.allowanceId as string);

    const [existing] = await db
      .select()
      .from(payroll)
      .where(eq(payroll.id, payrollId))
      .limit(1);

    if (!existing || (existing.status !== 'draft' && existing.status !== 'reviewed')) {
      res.status(400).json({
        success: false,
        error: 'Cannot remove allowance from this payroll',
        code: 'INVALID_STATUS',
        statusCode: 400,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    await db.delete(payrollAllowances).where(
      and(
        eq(payrollAllowances.id, allowanceId),
        eq(payrollAllowances.payrollId, payrollId),
      ),
    );

    await recalculatePayrollTotals(payrollId);

    createAuditLog({
      userId: req.user!.id,
      action: 'payroll.allowance.remove',
      entityType: 'payroll_allowance',
      entityId: allowanceId,
      changes: { payrollId },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      data: { message: 'Allowance removed' },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to remove allowance', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to remove allowance',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
