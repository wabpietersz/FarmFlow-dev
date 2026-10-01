import { requireSiteAccess, siteOf } from '../lib/site-scope';
import { qualified } from '../lib/sql-utils';
import { Router, type Request, type Response } from 'express';
import { isFinanceTagError, sendFinanceTagError } from '../lib/finance-tags';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate } from '../validators/auth';
import {
  createPayrollSchema,
  generatePayrollSchema,
  generatePayrollPrecheckSchema,
  payrollPreviewSchema,
  updatePayrollSchema,
  updatePayrollStatusSchema,
  createDeductionSchema,
  createAllowanceSchema,
} from '../validators/payroll';
import { db } from '../db';
import {
  payroll,
  payrollDeductions,
  payrollAllowances,
  employees,
  attendance,
  employeeCompensationRevisions,
  employeeCompensationComponents,
  financeAccounts,
  chequeLeaves,
  staffLoanRecoveries,
} from '../db/schema';
import { eq, and, sql, desc, gte, lte, or, isNull, asc, inArray } from 'drizzle-orm';
import { createAuditLog } from '../lib/audit';
import logger from '../lib/logger';
import { postPayrollToTreasury } from '../lib/treasury';
import { computePay, getStatutoryRates, loansDueForPeriod, recomputePayroll } from '../lib/payroll-calc';
import { refreshLoanStatuses } from '../lib/staff-payroll';
import { isMissingTreasuryColumn, isMissingTreasuryTable, sendTreasurySchemaNotReady } from '../lib/treasury-errors';

const router = Router();
const DEFAULT_STANDARD_HOURS_PER_DAY = 8;
const OVERTIME_OUTLIER_MULTIPLIER = 3;

type GenerationWarningCode =
  | 'MISSING_COMPENSATION'
  | 'OVERLAPPING_REVISIONS'
  | 'NEGATIVE_BASE_RATE'
  | 'OUTLIER_OVERTIME_RATE'
  | 'INVALID_COMPONENT_CONFIG'
  | 'PAYROLL_ALREADY_EXISTS';

interface GenerationWarning {
  employeeId: number;
  employeeName: string;
  code: GenerationWarningCode;
  message: string;
  severity: 'warning' | 'error';
}

interface PayrollAllowanceInput {
  allowanceType: string;
  amount: number;
  countsForEpf?: boolean;
  remarks?: string;
  included?: boolean;
}

interface PayrollDeductionInput {
  deductionType: string;
  amount: number;
  remarks?: string;
  included?: boolean;
}

function getWarningMessage(code: GenerationWarningCode): string {
  if (code === 'MISSING_COMPENSATION') return 'No active compensation revision found for pay period';
  if (code === 'OVERLAPPING_REVISIONS') return 'Multiple active compensation revisions overlap this pay period';
  if (code === 'NEGATIVE_BASE_RATE') return 'Compensation base rate is negative';
  if (code === 'OUTLIER_OVERTIME_RATE') return 'Overtime rate appears significantly higher than base hourly rate';
  if (code === 'INVALID_COMPONENT_CONFIG') return 'Recurring component configuration is invalid';
  return 'Payroll already exists for this employee and pay period';
}

function normalizePayPeriod(payPeriod: string) {
  const periodDate = new Date(payPeriod);
  if (Number.isNaN(periodDate.getTime())) {
    return payPeriod;
  }

  const monthStart = new Date(Date.UTC(periodDate.getUTCFullYear(), periodDate.getUTCMonth(), 1));
  return monthStart.toISOString().split('T')[0] as string;
}

function getPeriodBounds(payPeriod: string) {
  const normalizedPayPeriod = normalizePayPeriod(payPeriod);
  const periodDate = new Date(normalizedPayPeriod);
  return {
    startDate: new Date(Date.UTC(periodDate.getUTCFullYear(), periodDate.getUTCMonth(), 1)).toISOString().split('T')[0] as string,
    endDate: new Date(Date.UTC(periodDate.getUTCFullYear(), periodDate.getUTCMonth() + 1, 0)).toISOString().split('T')[0] as string,
  };
}

function getEmployeeName(employee: { firstName?: string | null; lastName?: string | null; id: number }) {
  const first = employee.firstName ?? '';
  const last = employee.lastName ?? '';
  const fullName = `${first} ${last}`.trim();
  return fullName || `Employee ${employee.id}`;
}

function calculateComponentAmount(
  component: { calculationType: string; value: string | number },
  proRatedBase: number,
): number {
  const componentValue = Number(component.value);
  if (component.calculationType === 'percentage') {
    return (proRatedBase * componentValue) / 100;
  }
  return componentValue;
}

function computePayrollTotals(args: {
  baseSalary: number;
  workingDays: number;
  attendedDays: number;
  overtimeHours: number;
  overtimeRate: number;
  allowances: PayrollAllowanceInput[];
  deductions: PayrollDeductionInput[];
}) {
  const allowanceTotal = args.allowances
    .filter((allowance) => allowance.included !== false)
    .reduce((sum, allowance) => sum + Number(allowance.amount), 0);
  const deductionTotal = args.deductions
    .filter((deduction) => deduction.included !== false)
    .reduce((sum, deduction) => sum + Number(deduction.amount), 0);

  const proRatedBase = args.workingDays > 0 ? (args.baseSalary / args.workingDays) * args.attendedDays : 0;
  const overtimePay = args.overtimeHours * args.overtimeRate;
  const grossSalary = proRatedBase + overtimePay + allowanceTotal;
  const netSalary = Math.max(0, grossSalary - deductionTotal);

  return {
    proRatedBase,
    overtimePay,
    allowanceTotal,
    deductionTotal,
    grossSalary,
    netSalary,
  };
}

function buildCompensationSnapshot(args: {
  revision: typeof employeeCompensationRevisions.$inferSelect;
  components: Array<typeof employeeCompensationComponents.$inferSelect & { calculatedAmount: number }>;
  payPeriodStart: string;
  payPeriodEnd: string;
}) {
  return {
    revisionId: args.revision.id,
    payType: args.revision.payType,
    baseRate: Number(args.revision.baseRate),
    overtimeRate: Number(args.revision.overtimeRate),
    standardHoursPerDay: Number(args.revision.standardHoursPerDay ?? DEFAULT_STANDARD_HOURS_PER_DAY),
    effectiveFrom: args.revision.effectiveFrom,
    effectiveTo: args.revision.effectiveTo,
    payPeriodStart: args.payPeriodStart,
    payPeriodEnd: args.payPeriodEnd,
    components: args.components.map((component) => ({
      id: component.id,
      componentType: component.componentType,
      name: component.name,
      calculationType: component.calculationType,
      value: Number(component.value),
      calculatedAmount: Number(component.calculatedAmount.toFixed(2)),
      isTaxable: component.isTaxable,
    })),
  };
}

async function loadCompensationContext(args: {
  employeeId: number;
  periodStart: string;
  periodEnd: string;
}) {
  const overlappingRevisions = await db
    .select()
    .from(employeeCompensationRevisions)
    .where(
      and(
        eq(employeeCompensationRevisions.employeeId, args.employeeId),
        eq(employeeCompensationRevisions.isActive, true),
        lte(employeeCompensationRevisions.effectiveFrom, args.periodEnd),
        or(
          isNull(employeeCompensationRevisions.effectiveTo),
          gte(employeeCompensationRevisions.effectiveTo, args.periodStart),
        )!,
      ),
    )
    .orderBy(desc(employeeCompensationRevisions.effectiveFrom), desc(employeeCompensationRevisions.id));

  const selectedRevision = overlappingRevisions[0] ?? null;
  if (!selectedRevision) {
    return {
      revision: null,
      components: [],
      warnings: ['MISSING_COMPENSATION'] as GenerationWarningCode[],
    };
  }

  const components = await db
    .select()
    .from(employeeCompensationComponents)
    .where(
      and(
        eq(employeeCompensationComponents.revisionId, selectedRevision.id),
        eq(employeeCompensationComponents.isActive, true),
      ),
    );

  const warnings: GenerationWarningCode[] = [];
  if (overlappingRevisions.length > 1) warnings.push('OVERLAPPING_REVISIONS');
  if (Number(selectedRevision.baseRate) < 0) warnings.push('NEGATIVE_BASE_RATE');
  if (components.some((component) => component.calculationType === 'percentage' && Number(component.value) > 100)) {
    warnings.push('INVALID_COMPONENT_CONFIG');
  }

  const baseRate = Number(selectedRevision.baseRate);
  const overtimeRate = Number(selectedRevision.overtimeRate);
  const standardHoursPerDay = Number(selectedRevision.standardHoursPerDay ?? DEFAULT_STANDARD_HOURS_PER_DAY);
  const hourlyBaseRate = selectedRevision.payType === 'monthly'
    ? baseRate / (22 * standardHoursPerDay)
    : selectedRevision.payType === 'daily'
      ? baseRate / standardHoursPerDay
      : baseRate;
  if (hourlyBaseRate > 0 && overtimeRate > hourlyBaseRate * OVERTIME_OUTLIER_MULTIPLIER) {
    warnings.push('OUTLIER_OVERTIME_RATE');
  }

  return {
    revision: selectedRevision,
    components,
    warnings,
  };
}

async function calculateAttendedDays(args: {
  employeeId: number;
  startDate: string;
  endDate: string;
  database?: {
    select: typeof db.select;
  };
}) {
  const database = args.database ?? db;
  const [attendanceCount] = await database
    .select({
      present: sql<number>`count(*) filter (where ${attendance.status} in ('present', 'half_day'))::int`,
      halfDays: sql<number>`count(*) filter (where ${attendance.status} = 'half_day')::int`,
    })
    .from(attendance)
    .where(
      and(
        eq(attendance.employeeId, args.employeeId),
        gte(attendance.attendanceDate, args.startDate),
        lte(attendance.attendanceDate, args.endDate),
      ),
    );

  return (attendanceCount.present - attendanceCount.halfDays) + (attendanceCount.halfDays * 0.5);
}

function mapCompensationWarnings(args: {
  warnings: GenerationWarningCode[];
  employeeId: number;
  employeeName: string;
}): GenerationWarning[] {
  return args.warnings.map((code) => ({
    employeeId: args.employeeId,
    employeeName: args.employeeName,
    code,
    message: getWarningMessage(code),
    severity: 'warning',
  }));
}

function buildDefaultComponents(args: {
  components: Array<typeof employeeCompensationComponents.$inferSelect & { calculatedAmount: number }>;
}) {
  const allowances: PayrollAllowanceInput[] = args.components
    .filter((component) => component.componentType === 'earning')
    .map((component) => ({
      allowanceType: component.name,
      amount: Number(component.calculatedAmount.toFixed(2)),
      countsForEpf: component.countsForEpf,
      remarks: `Recurring compensation component (${component.calculationType})`,
      included: true,
    }));

  const deductions: PayrollDeductionInput[] = args.components
    .filter((component) => component.componentType === 'deduction')
    .map((component) => ({
      deductionType: component.name,
      amount: Number(component.calculatedAmount.toFixed(2)),
      remarks: `Recurring compensation component (${component.calculationType})`,
      included: true,
    }));

  return { allowances, deductions };
}

// Helper: recalculate every payroll total (EPF/ETF, loan recovery, net). Drafts re-check loans due.
async function recalculatePayrollTotals(payrollId: number, tx?: typeof db) {
  const database = tx ?? db;
  const [record] = await database.select({ status: payroll.status }).from(payroll).where(eq(payroll.id, payrollId)).limit(1);
  if (!record) return;
  await recomputePayroll(payrollId, database, { refreshLoans: record.status === 'draft' });
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
    const { employeeId, payPeriod, payPeriodMonth, status, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    const normalizedPayPeriod = typeof payPeriodMonth === 'string' && /^\d{4}-\d{2}$/.test(payPeriodMonth)
      ? `${payPeriodMonth}-01`
      : typeof payPeriod === 'string'
        ? normalizePayPeriod(payPeriod)
        : undefined;

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
        financeAccountId: payroll.financeAccountId,
        financeAccountName: financeAccounts.accountName,
        paymentMethod: payroll.paymentMethod,
        chequeLeafId: payroll.chequeLeafId,
        chequeNumber: chequeLeaves.chequeNumber,
        treasuryTransactionId: payroll.treasuryTransactionId,
        compensationRevisionId: payroll.compensationRevisionId,
        totalAllowances: sql<string>`coalesce((select sum(${qualified(payrollAllowances.amount)}) from ${payrollAllowances} where ${qualified(payrollAllowances.payrollId)} = ${qualified(payroll.id)}), 0)`,
        totalDeductions: sql<string>`coalesce((select sum(${qualified(payrollDeductions.amount)}) from ${payrollDeductions} where ${qualified(payrollDeductions.payrollId)} = ${qualified(payroll.id)}), 0)`,
        notes: payroll.notes,
        createdAt: payroll.createdAt,
        updatedAt: payroll.updatedAt,
      })
      .from(payroll)
      .leftJoin(employees, eq(payroll.employeeId, employees.id))
      .leftJoin(financeAccounts, eq(payroll.financeAccountId, financeAccounts.id))
      .leftJoin(chequeLeaves, eq(payroll.chequeLeafId, chequeLeaves.id))
      .$dynamic();

    const conditions = [];

    // Site scoping for farm managers
    if (req.user!.siteId) {
      conditions.push(eq(employees.siteId, req.user!.siteId));
    }

    if (employeeId) {
      conditions.push(eq(payroll.employeeId, Number(employeeId)));
    }
    if (normalizedPayPeriod) {
      conditions.push(eq(payroll.payPeriod, normalizedPayPeriod));
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
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
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

// POST /api/payroll/preview — month-based defaults for payroll creation/generation
router.post('/preview', authenticate, requirePermission('payroll:create'), validate(payrollPreviewSchema), async (req: Request, res: Response) => {
  try {
    const { payPeriod, employeeId } = req.body as { payPeriod: string; employeeId?: number };
    const normalizedPayPeriod = normalizePayPeriod(payPeriod);
    const { startDate, endDate } = getPeriodBounds(normalizedPayPeriod);

    const conditions = [eq(employees.status, 'active')];
    if (req.user!.siteId) {
      conditions.push(eq(employees.siteId, req.user!.siteId));
    }
    if (employeeId) {
      conditions.push(eq(employees.id, employeeId));
    }

    const rates = await getStatutoryRates();
    const employeeRows = await db
      .select({
        id: employees.id,
        firstName: employees.firstName,
        lastName: employees.lastName,
        epfEligible: employees.epfEligible,
      })
      .from(employees)
      .where(and(...conditions))
      .orderBy(asc(employees.firstName), asc(employees.lastName));

    const rows = [];
    const warnings: GenerationWarning[] = [];

    for (const employee of employeeRows) {
      const employeeName = getEmployeeName(employee);
      const rowWarnings: GenerationWarning[] = [];

      const [existingPayroll] = await db
        .select({ id: payroll.id })
        .from(payroll)
        .where(and(eq(payroll.employeeId, employee.id), eq(payroll.payPeriod, normalizedPayPeriod)))
        .limit(1);
      if (existingPayroll) {
        rowWarnings.push({
          employeeId: employee.id,
          employeeName,
          code: 'PAYROLL_ALREADY_EXISTS',
          message: getWarningMessage('PAYROLL_ALREADY_EXISTS'),
          severity: 'error',
        });
      }

      const compensationContext = await loadCompensationContext({
        employeeId: employee.id,
        periodStart: startDate,
        periodEnd: endDate,
      });
      const attendedDays = await calculateAttendedDays({
        employeeId: employee.id,
        startDate,
        endDate,
      });
      const workingDays = Number(attendedDays.toFixed(1));

      rowWarnings.push(...mapCompensationWarnings({
        warnings: compensationContext.warnings,
        employeeId: employee.id,
        employeeName,
      }));
      warnings.push(...rowWarnings);

      let baseSalary = 0;
      let overtimeRate = 0;
      let compensationRevisionId: number | null = null;
      let compensationSnapshot: ReturnType<typeof buildCompensationSnapshot> | null = null;
      let evaluatedComponents: Array<typeof employeeCompensationComponents.$inferSelect & { calculatedAmount: number }> = [];

      if (compensationContext.revision) {
        const baseRate = Number(compensationContext.revision.baseRate);
        const standardHoursPerDay = Number(compensationContext.revision.standardHoursPerDay ?? DEFAULT_STANDARD_HOURS_PER_DAY);
        if (compensationContext.revision.payType === 'monthly') baseSalary = baseRate;
        if (compensationContext.revision.payType === 'daily') baseSalary = baseRate * workingDays;
        if (compensationContext.revision.payType === 'hourly') baseSalary = baseRate * workingDays * standardHoursPerDay;

        overtimeRate = Number(compensationContext.revision.overtimeRate ?? 0);
        const proRatedBase = workingDays > 0 ? (baseSalary / workingDays) * attendedDays : 0;
        evaluatedComponents = compensationContext.components.map((component) => ({
          ...component,
          calculatedAmount: calculateComponentAmount(component, proRatedBase),
        }));
        compensationRevisionId = compensationContext.revision.id;
        compensationSnapshot = buildCompensationSnapshot({
          revision: compensationContext.revision,
          components: evaluatedComponents,
          payPeriodStart: startDate,
          payPeriodEnd: endDate,
        });
      }

      const defaults = buildDefaultComponents({ components: evaluatedComponents });
      const dueLoans = await loansDueForPeriod(employee.id, normalizedPayPeriod);
      const pay = computePay({
        baseSalary,
        workingDays,
        attendedDays,
        overtimeHours: 0,
        overtimeRate,
        allowances: defaults.allowances,
        otherDeductions: defaults.deductions.reduce((sum, d) => sum + Number(d.amount), 0),
        loanInstallments: dueLoans.map((loan) => loan.due),
        epfEligible: employee.epfEligible,
        rates,
      });

      rows.push({
        employeeId: employee.id,
        employeeName,
        payPeriod: normalizedPayPeriod,
        workingDays,
        attendedDays,
        baseSalary: Number(baseSalary.toFixed(2)),
        overtimeHours: 0,
        overtimeRate: Number(overtimeRate.toFixed(2)),
        allowances: defaults.allowances,
        deductions: defaults.deductions,
        hasCompensation: Boolean(compensationContext.revision),
        compensationRevisionId,
        compensationSnapshot,
        warnings: rowWarnings,
        grossSalaryPreview: pay.gross,
        epfEmployeePreview: pay.epfEmployee,
        epfEmployerPreview: pay.epfEmployer,
        etfEmployerPreview: pay.etfEmployer,
        loanRecoveryPreview: pay.loanRecovery,
        netSalaryPreview: pay.net,
        notes: '',
      });
    }

    res.json({
      success: true,
      data: {
        payPeriod: normalizedPayPeriod,
        startDate,
        endDate,
        rows,
        summary: {
          totalEmployees: rows.length,
          employeesWithCompensation: rows.filter((row) => row.hasCompensation).length,
          employeesWithoutCompensation: rows.filter((row) => !row.hasCompensation).length,
          warningCount: warnings.length,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to build payroll preview', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to build payroll preview',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/payroll/:id — payroll detail with deductions and allowances
router.get('/:id', authenticate, requireSiteAccess(siteOf.payroll()), requirePermission('payroll:read'), async (req: Request, res: Response) => {
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
        financeAccountId: payroll.financeAccountId,
        financeAccountName: financeAccounts.accountName,
        paymentMethod: payroll.paymentMethod,
        chequeLeafId: payroll.chequeLeafId,
        chequeNumber: chequeLeaves.chequeNumber,
        treasuryTransactionId: payroll.treasuryTransactionId,
        compensationRevisionId: payroll.compensationRevisionId,
        compensationSnapshot: payroll.compensationSnapshot,
        notes: payroll.notes,
        createdAt: payroll.createdAt,
        updatedAt: payroll.updatedAt,
      })
      .from(payroll)
      .leftJoin(employees, eq(payroll.employeeId, employees.id))
      .leftJoin(financeAccounts, eq(payroll.financeAccountId, financeAccounts.id))
      .leftJoin(chequeLeaves, eq(payroll.chequeLeafId, chequeLeaves.id))
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
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
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
router.post('/', authenticate, requireSiteAccess(siteOf.bodyEmployee()), requirePermission('payroll:create'), validate(createPayrollSchema), async (req: Request, res: Response) => {
  try {
    const {
      employeeId,
      payPeriod,
      baseSalary,
      workingDays,
      attendedDays,
      overtimeHours = 0,
      overtimeRate = 0,
      notes,
      allowances = [],
      deductions = [],
      compensationRevisionId,
    } = req.body as {
      employeeId: number;
      payPeriod: string;
      baseSalary: number;
      workingDays: number;
      attendedDays?: number;
      overtimeHours?: number;
      overtimeRate?: number;
      notes?: string;
      allowances?: PayrollAllowanceInput[];
      deductions?: PayrollDeductionInput[];
      compensationRevisionId?: number | null;
    };
    const normalizedPayPeriod = normalizePayPeriod(payPeriod);
    const { startDate, endDate } = getPeriodBounds(normalizedPayPeriod);

    // Check employee exists
    const employeeConditions = [eq(employees.id, employeeId)];
    if (req.user!.siteId) {
      employeeConditions.push(eq(employees.siteId, req.user!.siteId));
    }
    const [emp] = await db
      .select({ id: employees.id, firstName: employees.firstName, lastName: employees.lastName })
      .from(employees)
      .where(and(...employeeConditions))
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

    const [existingPayroll] = await db
      .select({ id: payroll.id })
      .from(payroll)
      .where(and(eq(payroll.employeeId, employeeId), eq(payroll.payPeriod, normalizedPayPeriod)))
      .limit(1);

    if (existingPayroll) {
      res.status(409).json({
        success: false,
        error: 'Payroll already exists for this employee and pay period',
        code: 'PAYROLL_ALREADY_EXISTS',
        statusCode: 409,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const computedAttendanceDays = await calculateAttendedDays({
      employeeId,
      startDate,
      endDate,
    });
    const normalizedWorkingDays = Number(workingDays);
    const storedWorkingDays = Math.max(0, Math.round(normalizedWorkingDays));
    const normalizedAttendedDays = Number((attendedDays ?? computedAttendanceDays).toFixed(1));

    const compensationContext = await loadCompensationContext({
      employeeId,
      periodStart: startDate,
      periodEnd: endDate,
    });

    let resolvedCompensationSnapshot: ReturnType<typeof buildCompensationSnapshot> | null = null;
    let resolvedCompensationRevisionId = compensationRevisionId ?? null;

    const proRatedBaseForComponents = storedWorkingDays > 0
      ? (baseSalary / storedWorkingDays) * normalizedAttendedDays
      : 0;
    let evaluatedComponents: Array<typeof employeeCompensationComponents.$inferSelect & { calculatedAmount: number }> = [];
    if (compensationContext.revision) {
      evaluatedComponents = compensationContext.components.map((component) => ({
        ...component,
        calculatedAmount: calculateComponentAmount(component, proRatedBaseForComponents),
      }));
      resolvedCompensationSnapshot = buildCompensationSnapshot({
        revision: compensationContext.revision,
        components: evaluatedComponents,
        payPeriodStart: startDate,
        payPeriodEnd: endDate,
      });
      if (!resolvedCompensationRevisionId) {
        resolvedCompensationRevisionId = compensationContext.revision.id;
      }
    }

    const defaultComponents = buildDefaultComponents({ components: evaluatedComponents });
    const finalAllowances = allowances.length > 0 ? allowances : defaultComponents.allowances;
    const finalDeductions = deductions.length > 0 ? deductions : defaultComponents.deductions;

    const totals = computePayrollTotals({
      baseSalary,
      workingDays: storedWorkingDays,
      attendedDays: normalizedAttendedDays,
      overtimeHours: Number(overtimeHours),
      overtimeRate: Number(overtimeRate),
      allowances: finalAllowances,
      deductions: finalDeductions,
    });

    const created = await db.transaction(async (tx) => {
      const [record] = await tx
        .insert(payroll)
        .values({
          employeeId,
          payPeriod: normalizedPayPeriod,
          baseSalary: baseSalary.toFixed(2),
          workingDays: storedWorkingDays,
          attendedDays: normalizedAttendedDays.toFixed(1),
          overtimeHours: Number(overtimeHours).toFixed(2),
          overtimeRate: Number(overtimeRate).toFixed(2),
          grossSalary: totals.grossSalary.toFixed(2),
          netSalary: totals.netSalary.toFixed(2),
          status: 'draft',
          notes: notes ?? null,
          compensationRevisionId: resolvedCompensationRevisionId,
          compensationSnapshot: resolvedCompensationSnapshot,
        })
        .returning();

      const allowanceRows = finalAllowances
        .filter((allowance) => allowance.included !== false)
        .map((allowance) => ({
          payrollId: record.id,
          allowanceType: allowance.allowanceType,
          amount: Number(allowance.amount).toFixed(2),
          countsForEpf: allowance.countsForEpf ?? false,
          remarks: allowance.remarks ?? null,
        }));
      if (allowanceRows.length > 0) {
        await tx.insert(payrollAllowances).values(allowanceRows);
      }

      const deductionRows = finalDeductions
        .filter((deduction) => deduction.included !== false)
        .map((deduction) => ({
          payrollId: record.id,
          deductionType: deduction.deductionType,
          amount: Number(deduction.amount).toFixed(2),
          remarks: deduction.remarks ?? null,
        }));
      if (deductionRows.length > 0) {
        await tx.insert(payrollDeductions).values(deductionRows);
      }

      // EPF/ETF and loan recoveries
      const recomputed = await recomputePayroll(record.id, tx, { refreshLoans: true });
      return recomputed?.record ?? record;
    });

    createAuditLog({
      userId: req.user!.id,
      action: 'payroll.create',
      entityType: 'payroll',
      entityId: created.id,
      changes: {
        employeeId,
        payPeriod: normalizedPayPeriod,
        baseSalary,
        workingDays: storedWorkingDays,
        attendedDays: normalizedAttendedDays,
        allowanceCount: finalAllowances.filter((allowance) => allowance.included !== false).length,
        deductionCount: finalDeductions.filter((deduction) => deduction.included !== false).length,
      },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      data: created,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
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

// POST /api/payroll/generate/precheck — validation preview before payroll generation
router.post('/generate/precheck', authenticate, requirePermission('payroll:create'), validate(generatePayrollPrecheckSchema), async (req: Request, res: Response) => {
  try {
    const { payPeriod } = req.body;
    const normalizedPayPeriod = normalizePayPeriod(payPeriod);
    const { startDate, endDate } = getPeriodBounds(normalizedPayPeriod);

    const conditions = [eq(employees.status, 'active')];
    if (req.user!.siteId) {
      conditions.push(eq(employees.siteId, req.user!.siteId));
    }

    const activeEmployees = await db
      .select({
        id: employees.id,
        firstName: employees.firstName,
        lastName: employees.lastName,
      })
      .from(employees)
      .where(and(...conditions))
      .orderBy(asc(employees.firstName), asc(employees.lastName));

    const checks: Array<{
      employeeId: number;
      employeeName: string;
      status: 'ok' | 'warning' | 'error';
      warnings: GenerationWarning[];
    }> = [];

    for (const employee of activeEmployees) {
      const employeeName = getEmployeeName(employee);
      const warnings: GenerationWarning[] = [];

      const [existingPayroll] = await db
        .select({ id: payroll.id })
        .from(payroll)
        .where(and(eq(payroll.employeeId, employee.id), eq(payroll.payPeriod, normalizedPayPeriod)))
        .limit(1);
      if (existingPayroll) {
        warnings.push({
          employeeId: employee.id,
          employeeName,
          code: 'PAYROLL_ALREADY_EXISTS',
          message: getWarningMessage('PAYROLL_ALREADY_EXISTS'),
          severity: 'error',
        });
      }

      const compensationContext = await loadCompensationContext({
        employeeId: employee.id,
        periodStart: startDate,
        periodEnd: endDate,
      });
      for (const code of compensationContext.warnings) {
        warnings.push({
          employeeId: employee.id,
          employeeName,
          code,
          message: getWarningMessage(code),
          severity: 'warning',
        });
      }

      const hasError = warnings.some((warning) => warning.severity === 'error');
      checks.push({
        employeeId: employee.id,
        employeeName,
        status: hasError ? 'error' : warnings.length > 0 ? 'warning' : 'ok',
        warnings,
      });
    }

    const summary = {
      totalEmployees: checks.length,
      okEmployees: checks.filter((check) => check.status === 'ok').length,
      warningEmployees: checks.filter((check) => check.status === 'warning').length,
      errorEmployees: checks.filter((check) => check.status === 'error').length,
      warningCount: checks.reduce((sum, check) => sum + check.warnings.length, 0),
    };

    res.json({
      success: true,
      data: {
        payPeriod: normalizedPayPeriod,
        summary,
        checks,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to run payroll precheck', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to run payroll precheck',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// POST /api/payroll/generate — batch generate payroll drafts
router.post('/generate', authenticate, requirePermission('payroll:create'), validate(generatePayrollSchema), async (req: Request, res: Response) => {
  try {
    const {
      payPeriod,
      workingDays,
      entries = [],
    } = req.body as {
      payPeriod: string;
      workingDays?: number;
      entries?: Array<{
        employeeId: number;
        baseSalary: number;
        workingDays: number;
        attendedDays?: number;
        overtimeHours?: number;
        overtimeRate?: number;
        notes?: string;
        allowances?: PayrollAllowanceInput[];
        deductions?: PayrollDeductionInput[];
        compensationRevisionId?: number | null;
      }>;
    };
    const normalizedPayPeriod = normalizePayPeriod(payPeriod);
    const { startDate, endDate } = getPeriodBounds(normalizedPayPeriod);
    const hasEntryPayload = Array.isArray(entries) && entries.length > 0;

    const conditions = [eq(employees.status, 'active')];
    if (req.user!.siteId) {
      conditions.push(eq(employees.siteId, req.user!.siteId));
    }
    if (hasEntryPayload) {
      conditions.push(inArray(employees.id, entries.map((entry) => entry.employeeId)));
    }

    const targetEmployees = await db
      .select({
        id: employees.id,
        firstName: employees.firstName,
        lastName: employees.lastName,
      })
      .from(employees)
      .where(and(...conditions));

    if (targetEmployees.length === 0) {
      res.status(404).json({
        success: false,
        error: 'No active employees found',
        code: 'NO_EMPLOYEES',
        statusCode: 404,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (hasEntryPayload) {
      const scopedEmployeeIds = new Set(targetEmployees.map((employee) => employee.id));
      const outOfScopeEmployeeIds = entries
        .map((entry) => entry.employeeId)
        .filter((employeeIdValue) => !scopedEmployeeIds.has(employeeIdValue));

      if (outOfScopeEmployeeIds.length > 0) {
        res.status(400).json({
          success: false,
          error: `Some selected employees are not active or outside your site scope: ${outOfScopeEmployeeIds.join(', ')}`,
          code: 'EMPLOYEE_SCOPE_MISMATCH',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
        return;
      }
    }

    const entryByEmployeeId = new Map(entries.map((entry) => [entry.employeeId, entry]));
    const warnings: GenerationWarning[] = [];
    const created = await db.transaction(async (tx) => {
      const results = [];
      let employeesWithoutCompensation = 0;
      let skipped = 0;

      for (const employee of targetEmployees) {
        const employeeName = getEmployeeName(employee);
        const entry = entryByEmployeeId.get(employee.id);

        const [existingPayroll] = await tx
          .select({ id: payroll.id })
          .from(payroll)
          .where(and(eq(payroll.employeeId, employee.id), eq(payroll.payPeriod, normalizedPayPeriod)))
          .limit(1);
        if (existingPayroll) {
          warnings.push({
            employeeId: employee.id,
            employeeName,
            code: 'PAYROLL_ALREADY_EXISTS',
            message: getWarningMessage('PAYROLL_ALREADY_EXISTS'),
            severity: 'error',
          });
          skipped += 1;
          continue;
        }

        const compensationContext = await loadCompensationContext({
          employeeId: employee.id,
          periodStart: startDate,
          periodEnd: endDate,
        });
        warnings.push(...mapCompensationWarnings({
          warnings: compensationContext.warnings,
          employeeId: employee.id,
          employeeName,
        }));
        if (!compensationContext.revision) {
          employeesWithoutCompensation += 1;
        }

        const attendanceDays = await calculateAttendedDays({
          employeeId: employee.id,
          startDate,
          endDate,
          database: tx,
        });

        const rawWorkingDays = entry
          ? Number(entry.workingDays)
          : typeof workingDays === 'number'
            ? Number(workingDays)
            : attendanceDays;
        const storedWorkingDays = Math.max(0, Math.round(rawWorkingDays));
        const normalizedAttendedDays = Number((entry?.attendedDays ?? attendanceDays).toFixed(1));

        let baseSalary = entry ? Number(entry.baseSalary) : 0;
        let overtimeRate = entry ? Number(entry.overtimeRate ?? 0) : 0;
        const overtimeHours = Number(entry?.overtimeHours ?? 0);
        let resolvedCompensationRevisionId = entry?.compensationRevisionId ?? null;

        if (!entry && compensationContext.revision) {
          const baseRate = Number(compensationContext.revision.baseRate);
          const standardHoursPerDay = Number(compensationContext.revision.standardHoursPerDay ?? DEFAULT_STANDARD_HOURS_PER_DAY);
          if (compensationContext.revision.payType === 'monthly') baseSalary = baseRate;
          if (compensationContext.revision.payType === 'daily') baseSalary = baseRate * storedWorkingDays;
          if (compensationContext.revision.payType === 'hourly') baseSalary = baseRate * storedWorkingDays * standardHoursPerDay;
          overtimeRate = Number(compensationContext.revision.overtimeRate ?? 0);
        }

        let compensationSnapshot: ReturnType<typeof buildCompensationSnapshot> | null = null;
        let evaluatedComponents: Array<typeof employeeCompensationComponents.$inferSelect & { calculatedAmount: number }> = [];
        if (compensationContext.revision) {
          const proRatedBase = storedWorkingDays > 0
            ? (baseSalary / storedWorkingDays) * normalizedAttendedDays
            : 0;
          evaluatedComponents = compensationContext.components.map((component) => ({
            ...component,
            calculatedAmount: calculateComponentAmount(component, proRatedBase),
          }));
          compensationSnapshot = buildCompensationSnapshot({
            revision: compensationContext.revision,
            components: evaluatedComponents,
            payPeriodStart: startDate,
            payPeriodEnd: endDate,
          });
          if (!resolvedCompensationRevisionId) {
            resolvedCompensationRevisionId = compensationContext.revision.id;
          }
        }

        const defaultComponents = buildDefaultComponents({ components: evaluatedComponents });
        const allowances = entry?.allowances?.length ? entry.allowances : defaultComponents.allowances;
        const deductions = entry?.deductions?.length ? entry.deductions : defaultComponents.deductions;
        const totals = computePayrollTotals({
          baseSalary,
          workingDays: storedWorkingDays,
          attendedDays: normalizedAttendedDays,
          overtimeHours,
          overtimeRate,
          allowances,
          deductions,
        });

        const [record] = await tx
          .insert(payroll)
          .values({
            employeeId: employee.id,
            payPeriod: normalizedPayPeriod,
            baseSalary: baseSalary.toFixed(2),
            workingDays: storedWorkingDays,
            attendedDays: normalizedAttendedDays.toFixed(1),
            overtimeHours: overtimeHours.toFixed(2),
            overtimeRate: overtimeRate.toFixed(2),
            grossSalary: totals.grossSalary.toFixed(2),
            netSalary: totals.netSalary.toFixed(2),
            status: 'draft',
            notes: entry?.notes ?? null,
            compensationRevisionId: resolvedCompensationRevisionId,
            compensationSnapshot,
          })
          .returning();

        const allowanceRows = allowances
          .filter((allowance) => allowance.included !== false)
          .map((allowance) => ({
            payrollId: record.id,
            allowanceType: allowance.allowanceType,
            amount: Number(allowance.amount).toFixed(2),
            countsForEpf: allowance.countsForEpf ?? false,
            remarks: allowance.remarks ?? null,
          }));
        if (allowanceRows.length > 0) {
          await tx.insert(payrollAllowances).values(allowanceRows);
        }

        const deductionRows = deductions
          .filter((deduction) => deduction.included !== false)
          .map((deduction) => ({
            payrollId: record.id,
            deductionType: deduction.deductionType,
            amount: Number(deduction.amount).toFixed(2),
            remarks: deduction.remarks ?? null,
          }));
        if (deductionRows.length > 0) {
          await tx.insert(payrollDeductions).values(deductionRows);
        }

        const recomputed = await recomputePayroll(record.id, tx, { refreshLoans: true });
        results.push(recomputed?.record ?? record);
      }

      return { results, employeesWithoutCompensation, skipped };
    });

    createAuditLog({
      userId: req.user!.id,
      action: 'payroll.generate',
      entityType: 'payroll',
      changes: {
        payPeriod: normalizedPayPeriod,
        mode: hasEntryPayload ? 'selection' : 'legacy',
        selectedEmployees: hasEntryPayload ? entries.length : targetEmployees.length,
        workingDays: workingDays ?? null,
        count: created.results.length,
        missingCompensation: created.employeesWithoutCompensation,
        skipped: created.skipped,
        warningCount: warnings.length,
      },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      data: created.results,
      total: created.results.length,
      meta: {
        employeesWithoutCompensation: created.employeesWithoutCompensation,
        skipped: created.skipped,
        warningCount: warnings.length,
        warnings,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
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
router.put('/:id', authenticate, requireSiteAccess(siteOf.payroll()), requirePermission('payroll:update'), validate(updatePayrollSchema), async (req: Request, res: Response) => {
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

    await db
      .update(payroll)
      .set(updateData)
      .where(eq(payroll.id, id));

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
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
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
router.put('/:id/status', authenticate, requireSiteAccess(siteOf.payroll()), requirePermission('payroll:update'), validate(updatePayrollStatusSchema), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id as string);
    const { status: newStatus, financeAccountId, paymentMethod, chequeLeafId } = req.body as {
      status: string;
      financeAccountId?: number;
      paymentMethod?: 'cash' | 'cheque' | 'bank_transfer';
      chequeLeafId?: number;
    };

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
      if (!financeAccountId) {
        res.status(400).json({
          success: false,
          error: 'Treasury account is required when marking payroll as paid',
          code: 'TREASURY_ACCOUNT_REQUIRED',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
        return;
      }
    }

    let updated;
    if (newStatus === 'paid') {
      // Posting and the status change happen in one transaction
      await postPayrollToTreasury({
        payrollId: id,
        financeAccountId: financeAccountId!,
        postedBy: req.user!.id,
        paymentMethod,
        chequeLeafId: chequeLeafId ?? null,
      });
      const [paidRecord] = await db.select().from(payroll).where(eq(payroll.id, id)).limit(1);
      updated = paidRecord;
      const recoveredLoans = await db.select({ loanId: staffLoanRecoveries.loanId }).from(staffLoanRecoveries).where(eq(staffLoanRecoveries.payrollId, id));
      await refreshLoanStatuses(recoveredLoans.map((row) => row.loanId));
    } else {
      const [record] = await db
        .update(payroll)
        .set(updateData)
        .where(eq(payroll.id, id))
        .returning();
      updated = record;
    }

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
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    if (isMissingTreasuryTable(error) || isMissingTreasuryColumn(error)) {
      sendTreasurySchemaNotReady(res);
      return;
    }
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

// DELETE /api/payroll/:id — delete payroll (draft only)
router.delete('/:id', authenticate, requireSiteAccess(siteOf.payroll()), requirePermission('payroll:delete'), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id as string);
    const conditions = [eq(payroll.id, id)];

    if (req.user!.siteId) {
      conditions.push(eq(employees.siteId, req.user!.siteId));
    }

    const [existing] = await db
      .select({
        id: payroll.id,
        status: payroll.status,
        employeeId: payroll.employeeId,
      })
      .from(payroll)
      .leftJoin(employees, eq(payroll.employeeId, employees.id))
      .where(and(...conditions))
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
        error: 'Only draft payroll records can be deleted',
        code: 'INVALID_STATUS',
        statusCode: 400,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    await db.delete(payroll).where(eq(payroll.id, id));

    createAuditLog({
      userId: req.user!.id,
      action: 'payroll.delete',
      entityType: 'payroll',
      entityId: id,
      changes: { employeeId: existing.employeeId, status: existing.status },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      data: { message: 'Payroll deleted' },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to delete payroll', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to delete payroll',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// POST /api/payroll/:id/deductions — add deduction
router.post('/:id/deductions', authenticate, requireSiteAccess(siteOf.payroll()), requirePermission('payroll:update'), validate(createDeductionSchema), async (req: Request, res: Response) => {
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
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
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
router.delete('/:id/deductions/:deductionId', authenticate, requireSiteAccess(siteOf.payroll()), requirePermission('payroll:update'), async (req: Request, res: Response) => {
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
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
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
router.post('/:id/allowances', authenticate, requireSiteAccess(siteOf.payroll()), requirePermission('payroll:update'), validate(createAllowanceSchema), async (req: Request, res: Response) => {
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

    const { allowanceType, amount, remarks, countsForEpf } = req.body;

    const [created] = await db
      .insert(payrollAllowances)
      .values({
        payrollId,
        allowanceType,
        amount: amount.toFixed(2),
        countsForEpf: countsForEpf ?? false,
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
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
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
router.delete('/:id/allowances/:allowanceId', authenticate, requireSiteAccess(siteOf.payroll()), requirePermission('payroll:update'), async (req: Request, res: Response) => {
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
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
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
