import { Router, type Request, type Response } from 'express';
import { ensureSiteCostCentre } from '../lib/finance-tags';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate } from '../validators/auth';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  emergencyContactSchema,
  bankDetailsSchema,
  employeeQuerySchema,
  upsertCompensationSchema,
  compensationHistoryQuerySchema,
  createCompensationRevisionSchema,
  updateCompensationRevisionSchema,
} from '../validators/employee';
import { db } from '../db';
import {
  employees,
  emergencyContacts,
  bankDetails,
  employeeCompensation,
  employeeCompensationRevisions,
  employeeCompensationComponents,
  systemConfig,
  sites,
} from '../db/schema';
import { eq, and, or, ilike, sql, asc, desc, lte, gte, isNull, gt, inArray, ne, lt } from 'drizzle-orm';
import { createAuditLog } from '../lib/audit';
import logger from '../lib/logger';

const router = Router();

const COMPENSATION_TABLE_NAMES = [
  'employee_compensation',
  'employee_compensation_revisions',
  'employee_compensation_components',
] as const;
const DEFAULT_STANDARD_HOURS_PER_DAY = 8;
const DEFAULT_PERCENTAGE_COMPONENT_CAP = 50;

function isMissingCompensationTable(error: unknown): boolean {
  const maybe = error as { code?: string; message?: string };
  const message = String(maybe?.message ?? '');
  return maybe?.code === '42P01' && COMPENSATION_TABLE_NAMES.some((tableName) => message.includes(tableName));
}

function getDbErrorCode(error: unknown): string | undefined {
  const maybe = error as { code?: string };
  return maybe?.code;
}

function isConstraintError(error: unknown): boolean {
  const code = getDbErrorCode(error);
  return typeof code === 'string' && code.startsWith('23');
}

function isoToday(): string {
  return new Date().toISOString().split('T')[0] as string;
}

function minusOneDay(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().split('T')[0] as string;
}

function periodsOverlap(startA: string, endA: string | null, startB: string, endB: string | null): boolean {
  const boundedEndA = endA ?? '9999-12-31';
  const boundedEndB = endB ?? '9999-12-31';
  return startA <= boundedEndB && startB <= boundedEndA;
}

async function getPercentageComponentCap(): Promise<number> {
  try {
    const [row] = await db
      .select({ configValue: systemConfig.configValue })
      .from(systemConfig)
      .where(eq(systemConfig.configKey, 'compensation_component_percentage_cap'))
      .limit(1);

    if (!row) return DEFAULT_PERCENTAGE_COMPONENT_CAP;

    const raw = row.configValue;
    const value = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      return DEFAULT_PERCENTAGE_COMPONENT_CAP;
    }
    return value;
  } catch {
    return DEFAULT_PERCENTAGE_COMPONENT_CAP;
  }
}

function mapRevisionWithComponents(
  revision: typeof employeeCompensationRevisions.$inferSelect,
  components: Array<typeof employeeCompensationComponents.$inferSelect>,
) {
  return {
    ...revision,
    components,
  };
}

async function getCompensationProfile(employeeId: number) {
  const today = isoToday();
  await deactivateEndedCompensationRevisions({ employeeId, asOfDate: today });
  const [currentRevision] = await db
    .select()
    .from(employeeCompensationRevisions)
    .where(
      and(
        eq(employeeCompensationRevisions.employeeId, employeeId),
        eq(employeeCompensationRevisions.isActive, true),
        lte(employeeCompensationRevisions.effectiveFrom, today),
        or(
          isNull(employeeCompensationRevisions.effectiveTo),
          gte(employeeCompensationRevisions.effectiveTo, today),
        )!,
      ),
    )
    .orderBy(desc(employeeCompensationRevisions.effectiveFrom))
    .limit(1);

  const [upcomingRevision] = await db
    .select()
    .from(employeeCompensationRevisions)
    .where(
      and(
        eq(employeeCompensationRevisions.employeeId, employeeId),
        eq(employeeCompensationRevisions.isActive, true),
        gt(employeeCompensationRevisions.effectiveFrom, today),
      ),
    )
    .orderBy(asc(employeeCompensationRevisions.effectiveFrom))
    .limit(1);

  const revisionsForOverlapCheck = await db
    .select({
      id: employeeCompensationRevisions.id,
      effectiveFrom: employeeCompensationRevisions.effectiveFrom,
      effectiveTo: employeeCompensationRevisions.effectiveTo,
      isActive: employeeCompensationRevisions.isActive,
    })
    .from(employeeCompensationRevisions)
    .where(eq(employeeCompensationRevisions.employeeId, employeeId))
    .orderBy(asc(employeeCompensationRevisions.effectiveFrom));

  const revisionIds = [currentRevision?.id, upcomingRevision?.id].filter((id): id is number => Boolean(id));
  const components = revisionIds.length > 0
    ? await db
      .select()
      .from(employeeCompensationComponents)
      .where(
        and(
          inArray(employeeCompensationComponents.revisionId, revisionIds),
          eq(employeeCompensationComponents.isActive, true),
        ),
      )
    : [];

  const overlappingRevisionIds = new Set<number>();
  for (let i = 0; i < revisionsForOverlapCheck.length; i += 1) {
    for (let j = i + 1; j < revisionsForOverlapCheck.length; j += 1) {
      const first = revisionsForOverlapCheck[i]!;
      const second = revisionsForOverlapCheck[j]!;
      if (periodsOverlap(first.effectiveFrom, first.effectiveTo, second.effectiveFrom, second.effectiveTo)) {
        overlappingRevisionIds.add(first.id);
        overlappingRevisionIds.add(second.id);
      }
    }
  }

  return {
    employeeId,
    currentRevision: currentRevision
      ? mapRevisionWithComponents(
        currentRevision,
        components.filter((component) => component.revisionId === currentRevision.id),
      )
      : null,
    upcomingRevision: upcomingRevision
      ? mapRevisionWithComponents(
        upcomingRevision,
        components.filter((component) => component.revisionId === upcomingRevision.id),
      )
      : null,
    metadata: {
      revisionCount: revisionsForOverlapCheck.length,
      hasOverlaps: overlappingRevisionIds.size > 0,
      overlappingRevisionIds: Array.from(overlappingRevisionIds),
    },
  };
}

async function findOverlappingRevisions(args: {
  employeeId: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  excludeRevisionId?: number;
  database?: {
    select: typeof db.select;
  };
}) {
  const database = args.database ?? db;
  const conditions = [
    eq(employeeCompensationRevisions.employeeId, args.employeeId),
    lte(employeeCompensationRevisions.effectiveFrom, args.effectiveTo ?? '9999-12-31'),
    or(
      isNull(employeeCompensationRevisions.effectiveTo),
      gte(employeeCompensationRevisions.effectiveTo, args.effectiveFrom),
    )!,
  ];
  if (args.excludeRevisionId) {
    conditions.push(ne(employeeCompensationRevisions.id, args.excludeRevisionId));
  }

  return database
    .select({
      id: employeeCompensationRevisions.id,
      effectiveFrom: employeeCompensationRevisions.effectiveFrom,
      effectiveTo: employeeCompensationRevisions.effectiveTo,
      isActive: employeeCompensationRevisions.isActive,
    })
    .from(employeeCompensationRevisions)
    .where(and(...conditions));
}

async function syncLegacyCompensationFromRevision(
  employeeId: number,
  revision: {
    payType: string;
    baseRate: string | number;
    overtimeRate: string | number;
    effectiveFrom: string;
    notes: string | null;
  },
) {
  const [existing] = await db
    .select()
    .from(employeeCompensation)
    .where(eq(employeeCompensation.employeeId, employeeId))
    .limit(1);

  if (existing) {
    await db
      .update(employeeCompensation)
      .set({
        payType: revision.payType,
        baseRate: String(revision.baseRate),
        overtimeRate: String(revision.overtimeRate),
        effectiveFrom: revision.effectiveFrom,
        notes: revision.notes,
        updatedAt: new Date(),
      })
      .where(eq(employeeCompensation.employeeId, employeeId));
    return;
  }

  await db
    .insert(employeeCompensation)
    .values({
      employeeId,
      payType: revision.payType,
      baseRate: String(revision.baseRate),
      overtimeRate: String(revision.overtimeRate),
      effectiveFrom: revision.effectiveFrom,
      notes: revision.notes,
    });
}

async function deactivateEndedCompensationRevisions(args: {
  employeeId: number;
  asOfDate?: string;
}) {
  const asOfDate = args.asOfDate ?? isoToday();
  await db
    .update(employeeCompensationRevisions)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(employeeCompensationRevisions.employeeId, args.employeeId),
        eq(employeeCompensationRevisions.isActive, true),
        lt(employeeCompensationRevisions.effectiveTo, asOfDate),
      ),
    );
}

// GET /api/employees - paginated list
router.get(
  '/',
  authenticate,
  requirePermission('employees:read'),
  async (req: Request, res: Response) => {
    try {
      const query = employeeQuerySchema.safeParse(req.query);
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

      const { page, limit, sortBy, sortOrder, search, siteId, designation, status } = query.data;
      const offset = (page - 1) * limit;

      // Build WHERE conditions
      const conditions = [];

      // Farm manager scoping
      const userSiteId = req.user?.siteId;
      if (userSiteId) {
        conditions.push(eq(employees.siteId, userSiteId));
      } else if (siteId) {
        conditions.push(eq(employees.siteId, siteId));
      }

      if (designation) {
        conditions.push(eq(employees.designation, designation));
      }
      if (status) {
        conditions.push(eq(employees.status, status));
      }
      if (search) {
        conditions.push(
          or(
            ilike(employees.firstName, `%${search}%`),
            ilike(employees.lastName, `%${search}%`),
            ilike(employees.designation, `%${search}%`),
          )!,
        );
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      // Sort
      const sortColumn = {
        firstName: employees.firstName,
        lastName: employees.lastName,
        designation: employees.designation,
        joinDate: employees.joinDate,
        status: employees.status,
      }[sortBy] ?? employees.firstName;

      const orderFn = sortOrder === 'desc' ? desc : asc;

      // Count
      const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(employees)
        .where(where);
      const total = countResult[0]?.count ?? 0;

      let rows: Array<Record<string, unknown>> = [];
      try {
        rows = await db
          .select({
            id: employees.id,
            userId: employees.userId,
            firstName: employees.firstName,
            lastName: employees.lastName,
            designation: employees.designation,
            siteId: employees.siteId,
            siteName: sites.siteName,
            employmentType: employees.employmentType,
            joinDate: employees.joinDate,
            status: employees.status,
            phone: employees.phone,
          epfNumber: employees.epfNumber,
          epfEligible: employees.epfEligible,
            hasCompensation: sql<boolean>`${employeeCompensation.id} is not null`,
            createdAt: employees.createdAt,
            updatedAt: employees.updatedAt,
          })
          .from(employees)
          .leftJoin(sites, eq(employees.siteId, sites.id))
          .leftJoin(employeeCompensation, eq(employees.id, employeeCompensation.employeeId))
          .where(where)
          .orderBy(orderFn(sortColumn))
          .limit(limit)
          .offset(offset);
      } catch (error) {
        if (!isMissingCompensationTable(error)) {
          throw error;
        }

        logger.warn('employee_compensation table missing; falling back to employee list without compensation info');
        rows = await db
          .select({
            id: employees.id,
            userId: employees.userId,
            firstName: employees.firstName,
            lastName: employees.lastName,
            designation: employees.designation,
            siteId: employees.siteId,
            siteName: sites.siteName,
            employmentType: employees.employmentType,
            joinDate: employees.joinDate,
            status: employees.status,
            phone: employees.phone,
          epfNumber: employees.epfNumber,
          epfEligible: employees.epfEligible,
            hasCompensation: sql<boolean>`false`,
            createdAt: employees.createdAt,
            updatedAt: employees.updatedAt,
          })
          .from(employees)
          .leftJoin(sites, eq(employees.siteId, sites.id))
          .where(where)
          .orderBy(orderFn(sortColumn))
          .limit(limit)
          .offset(offset);
      }

      res.json({
        success: true,
        data: rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to fetch employees', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch employees',
        code: 'EMPLOYEES_FETCH_FAILED',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// GET /api/employees/export — CSV export
router.get(
  '/export',
  authenticate,
  requirePermission('employees:read'),
  async (req: Request, res: Response) => {
    try {
      const userSiteId = req.user?.siteId;
      const where = userSiteId ? eq(employees.siteId, userSiteId) : undefined;

      const rows = await db
        .select({
          id: employees.id,
          firstName: employees.firstName,
          lastName: employees.lastName,
          designation: employees.designation,
          siteName: sites.siteName,
          employmentType: employees.employmentType,
          joinDate: employees.joinDate,
          status: employees.status,
          phone: employees.phone,
          epfNumber: employees.epfNumber,
          epfEligible: employees.epfEligible,
        })
        .from(employees)
        .leftJoin(sites, eq(employees.siteId, sites.id))
        .where(where)
        .orderBy(asc(employees.firstName));

      const header = 'ID,First Name,Last Name,Designation,Site,Employment Type,Join Date,Status,Phone';
      const csvRows = rows.map((r) =>
        [
          r.id,
          `"${(r.firstName ?? '').replace(/"/g, '""')}"`,
          `"${(r.lastName ?? '').replace(/"/g, '""')}"`,
          `"${(r.designation ?? '').replace(/"/g, '""')}"`,
          `"${(r.siteName ?? '').replace(/"/g, '""')}"`,
          r.employmentType,
          r.joinDate,
          r.status,
          r.phone ?? '',
        ].join(','),
      );

      const csv = [header, ...csvRows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="employees-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } catch (error) {
      logger.error('Failed to export employees', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to export employees',
        code: 'EXPORT_FAILED',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// GET /api/employees/:id - detail with related data
router.get(
  '/:id',
  authenticate,
  requirePermission('employees:read'),
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, error: 'Invalid ID', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }

      const [employee] = await db
        .select({
          id: employees.id,
          userId: employees.userId,
          firstName: employees.firstName,
          lastName: employees.lastName,
          designation: employees.designation,
          siteId: employees.siteId,
          siteName: sites.siteName,
          costCentreId: employees.costCentreId,
          employmentType: employees.employmentType,
          joinDate: employees.joinDate,
          status: employees.status,
          phone: employees.phone,
          epfNumber: employees.epfNumber,
          epfEligible: employees.epfEligible,
          createdAt: employees.createdAt,
          updatedAt: employees.updatedAt,
        })
        .from(employees)
        .leftJoin(sites, eq(employees.siteId, sites.id))
        .where(eq(employees.id, id))
        .limit(1);

      if (!employee) {
        res.status(404).json({
          success: false,
          error: 'Employee not found',
          code: 'EMPLOYEE_NOT_FOUND',
          statusCode: 404,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Farm manager site check
      if (req.user?.siteId && employee.siteId !== req.user.siteId) {
        res.status(403).json({
          success: false,
          error: 'Access denied to this employee',
          code: 'FORBIDDEN',
          statusCode: 403,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const contacts = await db
        .select()
        .from(emergencyContacts)
        .where(eq(emergencyContacts.employeeId, id));

      const [bank] = await db
        .select()
        .from(bankDetails)
        .where(eq(bankDetails.employeeId, id))
        .limit(1);

      let compensation: Record<string, unknown> | null = null;
      try {
        const [row] = await db
          .select()
          .from(employeeCompensation)
          .where(eq(employeeCompensation.employeeId, id))
          .limit(1);
        compensation = row ?? null;
      } catch (error) {
        if (!isMissingCompensationTable(error)) {
          throw error;
        }
        logger.warn('employee_compensation table missing; returning employee detail without compensation');
      }

      res.json({
        success: true,
        data: {
          employee,
          emergencyContacts: contacts,
          bankDetails: bank ?? null,
          compensation: compensation ?? null,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to fetch employee', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch employee',
        code: 'EMPLOYEE_FETCH_FAILED',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// POST /api/employees - create
router.post(
  '/',
  authenticate,
  requirePermission('employees:create'),
  validate(createEmployeeSchema),
  async (req: Request, res: Response) => {
    try {
      const data = req.body;

      // Farm manager: force own siteId
      if (req.user?.siteId) {
        data.siteId = req.user.siteId;
      }

      // Verify site exists
      const [site] = await db
        .select({ id: sites.id })
        .from(sites)
        .where(eq(sites.id, data.siteId))
        .limit(1);

      if (!site) {
        res.status(400).json({
          success: false,
          error: 'Invalid site ID',
          code: 'INVALID_SITE',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const [employee] = await db
        .insert(employees)
        .values({
          firstName: data.firstName,
          lastName: data.lastName,
          designation: data.designation,
          siteId: data.siteId,
          // Labour cost follows the employee's cost centre; default is their site (mill staff → Feed Mill).
          costCentreId: data.costCentreId ?? (await ensureSiteCostCentre(data.siteId)).id,
          employmentType: data.employmentType,
          joinDate: data.joinDate,
          phone: data.phone ?? null,
          epfNumber: data.epfNumber || null,
          epfEligible: data.epfEligible ?? true,
        })
        .returning();

      // Create emergency contacts if provided
      if (data.emergencyContacts?.length) {
        await db.insert(emergencyContacts).values(
          data.emergencyContacts.map((c: { contactName: string; relationship: string; phoneNumber: string }) => ({
            employeeId: employee.id,
            contactName: c.contactName,
            relationship: c.relationship,
            phoneNumber: c.phoneNumber,
          })),
        );
      }

      // Create bank details if provided
      if (data.bankDetails) {
        await db.insert(bankDetails).values({
          employeeId: employee.id,
          accountHolderName: data.bankDetails.accountHolderName,
          bankName: data.bankDetails.bankName,
          branchCode: data.bankDetails.branchCode ?? null,
          accountNumber: data.bankDetails.accountNumber,
          ifscCode: data.bankDetails.ifscCode ?? null,
        });
      }

      await createAuditLog({
        userId: req.user?.id,
        action: 'employee.create',
        entityType: 'employee',
        entityId: employee.id,
        changes: { created: data },
        ipAddress: req.ip,
      });

      res.status(201).json({
        success: true,
        data: employee,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to create employee', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to create employee',
        code: 'EMPLOYEE_CREATE_FAILED',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// PUT /api/employees/:id - update
router.put(
  '/:id',
  authenticate,
  requirePermission('employees:update'),
  validate(updateEmployeeSchema),
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, error: 'Invalid ID', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }

      const [existing] = await db
        .select()
        .from(employees)
        .where(eq(employees.id, id))
        .limit(1);

      if (!existing) {
        res.status(404).json({
          success: false,
          error: 'Employee not found',
          code: 'EMPLOYEE_NOT_FOUND',
          statusCode: 404,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (req.user?.siteId && existing.siteId !== req.user.siteId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
          code: 'FORBIDDEN',
          statusCode: 403,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      const changes: Record<string, { from: unknown; to: unknown }> = {};

      for (const [key, value] of Object.entries(req.body)) {
        if (value !== undefined) {
          changes[key] = { from: (existing as Record<string, unknown>)[key], to: value };
          updateData[key] = value;
        }
      }

      if (req.body.costCentreId === null) {
        const siteCentreId = (await ensureSiteCostCentre(req.body.siteId ?? existing.siteId)).id;
        changes.costCentreId = { from: existing.costCentreId, to: siteCentreId };
        updateData.costCentreId = siteCentreId;
      }

      // Moving site moves the cost centre too, unless the employee was deliberately on a non-site centre.
      if (req.body.siteId && req.body.siteId !== existing.siteId && req.body.costCentreId === undefined) {
        const oldSiteCentre = await ensureSiteCostCentre(existing.siteId);
        if (!existing.costCentreId || existing.costCentreId === oldSiteCentre.id) {
          const newCentreId = (await ensureSiteCostCentre(req.body.siteId)).id;
          changes.costCentreId = { from: existing.costCentreId, to: newCentreId };
          updateData.costCentreId = newCentreId;
        }
      }

      const [updated] = await db
        .update(employees)
        .set(updateData)
        .where(eq(employees.id, id))
        .returning();

      await createAuditLog({
        userId: req.user?.id,
        action: 'employee.update',
        entityType: 'employee',
        entityId: id,
        changes,
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        data: updated,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to update employee', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to update employee',
        code: 'EMPLOYEE_UPDATE_FAILED',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// DELETE /api/employees/:id - soft delete
router.delete(
  '/:id',
  authenticate,
  requirePermission('employees:delete'),
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, error: 'Invalid ID', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }

      const [existing] = await db
        .select()
        .from(employees)
        .where(eq(employees.id, id))
        .limit(1);

      if (!existing) {
        res.status(404).json({
          success: false,
          error: 'Employee not found',
          code: 'EMPLOYEE_NOT_FOUND',
          statusCode: 404,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (req.user?.siteId && existing.siteId !== req.user.siteId) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
          code: 'FORBIDDEN',
          statusCode: 403,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      await db
        .update(employees)
        .set({ status: 'terminated', updatedAt: new Date() })
        .where(eq(employees.id, id));

      await createAuditLog({
        userId: req.user?.id,
        action: 'employee.terminate',
        entityType: 'employee',
        entityId: id,
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        data: { message: 'Employee terminated' },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to terminate employee', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to terminate employee',
        code: 'EMPLOYEE_DELETE_FAILED',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// === Emergency Contacts sub-resource ===

// POST /api/employees/:id/emergency-contacts
router.post(
  '/:id/emergency-contacts',
  authenticate,
  requirePermission('employees:update'),
  validate(emergencyContactSchema),
  async (req: Request, res: Response) => {
    try {
      const employeeId = parseInt(req.params.id as string, 10);
      const [employee] = await db.select({ id: employees.id, siteId: employees.siteId }).from(employees).where(eq(employees.id, employeeId)).limit(1);
      if (!employee) {
        res.status(404).json({ success: false, error: 'Employee not found', statusCode: 404, timestamp: new Date().toISOString() });
        return;
      }
      if (req.user?.siteId && employee.siteId !== req.user.siteId) {
        res.status(403).json({ success: false, error: 'Access denied', statusCode: 403, timestamp: new Date().toISOString() });
        return;
      }

      const [contact] = await db
        .insert(emergencyContacts)
        .values({ employeeId, ...req.body })
        .returning();

      await createAuditLog({
        userId: req.user?.id,
        action: 'emergency_contact.create',
        entityType: 'employee',
        entityId: employeeId,
        changes: { contact: req.body },
        ipAddress: req.ip,
      });

      res.status(201).json({ success: true, data: contact, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Failed to add emergency contact', { error });
      res.status(500).json({ success: false, error: 'Failed to add emergency contact', statusCode: 500, timestamp: new Date().toISOString() });
    }
  },
);

// PUT /api/employees/:id/emergency-contacts/:contactId
router.put(
  '/:id/emergency-contacts/:contactId',
  authenticate,
  requirePermission('employees:update'),
  validate(emergencyContactSchema),
  async (req: Request, res: Response) => {
    try {
      const employeeId = parseInt(req.params.id as string, 10);
      const contactId = parseInt(req.params.contactId as string, 10);

      const [contact] = await db
        .update(emergencyContacts)
        .set(req.body)
        .where(and(eq(emergencyContacts.id, contactId), eq(emergencyContacts.employeeId, employeeId)))
        .returning();

      if (!contact) {
        res.status(404).json({ success: false, error: 'Contact not found', statusCode: 404, timestamp: new Date().toISOString() });
        return;
      }

      await createAuditLog({
        userId: req.user?.id,
        action: 'emergency_contact.update',
        entityType: 'employee',
        entityId: employeeId,
        changes: { contactId, updated: req.body },
        ipAddress: req.ip,
      });

      res.json({ success: true, data: contact, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Failed to update emergency contact', { error });
      res.status(500).json({ success: false, error: 'Failed to update contact', statusCode: 500, timestamp: new Date().toISOString() });
    }
  },
);

// DELETE /api/employees/:id/emergency-contacts/:contactId
router.delete(
  '/:id/emergency-contacts/:contactId',
  authenticate,
  requirePermission('employees:update'),
  async (req: Request, res: Response) => {
    try {
      const employeeId = parseInt(req.params.id as string, 10);
      const contactId = parseInt(req.params.contactId as string, 10);

      const [deleted] = await db
        .delete(emergencyContacts)
        .where(and(eq(emergencyContacts.id, contactId), eq(emergencyContacts.employeeId, employeeId)))
        .returning();

      if (!deleted) {
        res.status(404).json({ success: false, error: 'Contact not found', statusCode: 404, timestamp: new Date().toISOString() });
        return;
      }

      await createAuditLog({
        userId: req.user?.id,
        action: 'emergency_contact.delete',
        entityType: 'employee',
        entityId: employeeId,
        changes: { contactId },
        ipAddress: req.ip,
      });

      res.json({ success: true, data: { message: 'Contact removed' }, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Failed to delete emergency contact', { error });
      res.status(500).json({ success: false, error: 'Failed to delete contact', statusCode: 500, timestamp: new Date().toISOString() });
    }
  },
);

// === Bank Details sub-resource ===

// POST /api/employees/:id/bank-details (upsert)
router.post(
  '/:id/bank-details',
  authenticate,
  requirePermission('employees:update'),
  validate(bankDetailsSchema),
  async (req: Request, res: Response) => {
    try {
      const employeeId = parseInt(req.params.id as string, 10);
      const [employee] = await db.select({ id: employees.id, siteId: employees.siteId }).from(employees).where(eq(employees.id, employeeId)).limit(1);
      if (!employee) {
        res.status(404).json({ success: false, error: 'Employee not found', statusCode: 404, timestamp: new Date().toISOString() });
        return;
      }
      if (req.user?.siteId && employee.siteId !== req.user.siteId) {
        res.status(403).json({ success: false, error: 'Access denied', statusCode: 403, timestamp: new Date().toISOString() });
        return;
      }

      // Check if bank details exist
      const [existing] = await db
        .select()
        .from(bankDetails)
        .where(eq(bankDetails.employeeId, employeeId))
        .limit(1);

      let result;
      if (existing) {
        [result] = await db
          .update(bankDetails)
          .set({ ...req.body, updatedAt: new Date() })
          .where(eq(bankDetails.employeeId, employeeId))
          .returning();
      } else {
        [result] = await db
          .insert(bankDetails)
          .values({ employeeId, ...req.body })
          .returning();
      }

      await createAuditLog({
        userId: req.user?.id,
        action: existing ? 'bank_details.update' : 'bank_details.create',
        entityType: 'employee',
        entityId: employeeId,
        changes: { bankDetails: req.body },
        ipAddress: req.ip,
      });

      res.status(existing ? 200 : 201).json({ success: true, data: result, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Failed to save bank details', { error });
      res.status(500).json({ success: false, error: 'Failed to save bank details', statusCode: 500, timestamp: new Date().toISOString() });
    }
  },
);

// DELETE /api/employees/:id/bank-details
router.delete(
  '/:id/bank-details',
  authenticate,
  requirePermission('employees:update'),
  async (req: Request, res: Response) => {
    try {
      const employeeId = parseInt(req.params.id as string, 10);

      const [deleted] = await db
        .delete(bankDetails)
        .where(eq(bankDetails.employeeId, employeeId))
        .returning();

      if (!deleted) {
        res.status(404).json({ success: false, error: 'Bank details not found', statusCode: 404, timestamp: new Date().toISOString() });
        return;
      }

      await createAuditLog({
        userId: req.user?.id,
        action: 'bank_details.delete',
        entityType: 'employee',
        entityId: employeeId,
        ipAddress: req.ip,
      });

      res.json({ success: true, data: { message: 'Bank details removed' }, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Failed to delete bank details', { error });
      res.status(500).json({ success: false, error: 'Failed to delete bank details', statusCode: 500, timestamp: new Date().toISOString() });
    }
  },
);

// GET /api/employees/:id/compensation
router.get(
  '/:id/compensation',
  authenticate,
  requirePermission('employees:read'),
  async (req: Request, res: Response) => {
    const employeeId = parseInt(req.params.id as string, 10);
    try {
      if (isNaN(employeeId)) {
        res.status(400).json({ success: false, error: 'Invalid ID', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }

      const [employee] = await db
        .select({ id: employees.id, siteId: employees.siteId })
        .from(employees)
        .where(eq(employees.id, employeeId))
        .limit(1);

      if (!employee) {
        res.status(404).json({ success: false, error: 'Employee not found', statusCode: 404, timestamp: new Date().toISOString() });
        return;
      }

      if (req.user?.siteId && employee.siteId !== req.user.siteId) {
        res.status(403).json({ success: false, error: 'Access denied', statusCode: 403, timestamp: new Date().toISOString() });
        return;
      }

      const profile = await getCompensationProfile(employeeId);
      if (!profile.currentRevision) {
        const [legacy] = await db
          .select()
          .from(employeeCompensation)
          .where(eq(employeeCompensation.employeeId, employeeId))
          .limit(1);

        if (legacy) {
          res.json({
            success: true,
            data: {
              ...profile,
              currentRevision: {
                id: legacy.id,
                employeeId: legacy.employeeId,
                payType: legacy.payType,
                baseRate: legacy.baseRate,
                overtimeRate: legacy.overtimeRate,
                effectiveFrom: legacy.effectiveFrom,
                effectiveTo: null,
                standardHoursPerDay: String(DEFAULT_STANDARD_HOURS_PER_DAY.toFixed(2)),
                notes: legacy.notes,
                isActive: true,
                createdAt: legacy.createdAt,
                updatedAt: legacy.updatedAt,
                components: [],
              },
            },
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }

      res.json({
        success: true,
        data: profile,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (isMissingCompensationTable(error)) {
        res.status(503).json({
          success: false,
          error: 'Compensation schema is not ready. Run backend migrations and retry.',
          code: 'COMPENSATION_SCHEMA_NOT_READY',
          statusCode: 503,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      logger.error('Failed to get compensation profile', { employeeId, error });
      res.status(500).json({ success: false, error: 'Failed to get compensation profile', statusCode: 500, timestamp: new Date().toISOString() });
    }
  },
);

// GET /api/employees/:id/compensation/history
router.get(
  '/:id/compensation/history',
  authenticate,
  requirePermission('employees:read'),
  async (req: Request, res: Response) => {
    const employeeId = parseInt(req.params.id as string, 10);
    try {
      const query = compensationHistoryQuerySchema.safeParse(req.query);
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

      if (isNaN(employeeId)) {
        res.status(400).json({ success: false, error: 'Invalid ID', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }

      const [employee] = await db
        .select({ id: employees.id, siteId: employees.siteId })
        .from(employees)
        .where(eq(employees.id, employeeId))
        .limit(1);

      if (!employee) {
        res.status(404).json({ success: false, error: 'Employee not found', statusCode: 404, timestamp: new Date().toISOString() });
        return;
      }

      if (req.user?.siteId && employee.siteId !== req.user.siteId) {
        res.status(403).json({ success: false, error: 'Access denied', statusCode: 403, timestamp: new Date().toISOString() });
        return;
      }

      const { page, limit } = query.data;
      await deactivateEndedCompensationRevisions({ employeeId });
      const offset = (page - 1) * limit;
      const [count] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(employeeCompensationRevisions)
        .where(eq(employeeCompensationRevisions.employeeId, employeeId));

      const revisions = await db
        .select()
        .from(employeeCompensationRevisions)
        .where(eq(employeeCompensationRevisions.employeeId, employeeId))
        .orderBy(desc(employeeCompensationRevisions.effectiveFrom), desc(employeeCompensationRevisions.id))
        .limit(limit)
        .offset(offset);

      const revisionIds = revisions.map((revision) => revision.id);
      const components = revisionIds.length > 0
        ? await db
          .select()
          .from(employeeCompensationComponents)
          .where(inArray(employeeCompensationComponents.revisionId, revisionIds))
        : [];

      const withComponents = revisions.map((revision) => mapRevisionWithComponents(
        revision,
        components.filter((component) => component.revisionId === revision.id),
      ));

      res.json({
        success: true,
        data: withComponents,
        total: count?.total ?? 0,
        page,
        limit,
        totalPages: Math.ceil((count?.total ?? 0) / limit),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (isMissingCompensationTable(error)) {
        res.status(503).json({
          success: false,
          error: 'Compensation schema is not ready. Run backend migrations and retry.',
          code: 'COMPENSATION_SCHEMA_NOT_READY',
          statusCode: 503,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      logger.error('Failed to get compensation history', { employeeId, error });
      res.status(500).json({ success: false, error: 'Failed to get compensation history', statusCode: 500, timestamp: new Date().toISOString() });
    }
  },
);

// POST /api/employees/:id/compensation/revisions
router.post(
  '/:id/compensation/revisions',
  authenticate,
  requirePermission('employees:update'),
  validate(createCompensationRevisionSchema),
  async (req: Request, res: Response) => {
    const employeeId = parseInt(req.params.id as string, 10);
    try {
      if (isNaN(employeeId)) {
        res.status(400).json({ success: false, error: 'Invalid ID', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }

      const [employee] = await db
        .select({ id: employees.id, siteId: employees.siteId })
        .from(employees)
        .where(eq(employees.id, employeeId))
        .limit(1);

      if (!employee) {
        res.status(404).json({ success: false, error: 'Employee not found', statusCode: 404, timestamp: new Date().toISOString() });
        return;
      }
      if (req.user?.siteId && employee.siteId !== req.user.siteId) {
        res.status(403).json({ success: false, error: 'Access denied', statusCode: 403, timestamp: new Date().toISOString() });
        return;
      }

      const today = isoToday();
      const {
        payType,
        baseRate,
        overtimeRate = 0,
        effectiveFrom,
        effectiveTo = null,
        standardHoursPerDay = DEFAULT_STANDARD_HOURS_PER_DAY,
        notes,
        isActive: isActiveInput,
        components = [],
      } = req.body;
      const isActive = typeof isActiveInput === 'boolean' ? isActiveInput : effectiveFrom <= today;

      const cap = await getPercentageComponentCap();
      const overCap = components.find((component: { calculationType: string; value: number }) =>
        component.calculationType === 'percentage' && component.value > cap);
      if (overCap) {
        res.status(400).json({
          success: false,
          error: `Percentage component value cannot exceed ${cap}%`,
          code: 'COMPENSATION_COMPONENT_CAP_EXCEEDED',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const createdRevision = await db.transaction(async (tx) => {
        const [openEndedPrevious] = await tx
          .select()
          .from(employeeCompensationRevisions)
          .where(
            and(
              eq(employeeCompensationRevisions.employeeId, employeeId),
              isNull(employeeCompensationRevisions.effectiveTo),
              lte(employeeCompensationRevisions.effectiveFrom, effectiveFrom),
            ),
          )
          .orderBy(desc(employeeCompensationRevisions.effectiveFrom))
          .limit(1);

        if (openEndedPrevious && openEndedPrevious.effectiveFrom < effectiveFrom) {
          await tx
            .update(employeeCompensationRevisions)
            .set({
              effectiveTo: minusOneDay(effectiveFrom),
              updatedAt: new Date(),
            })
            .where(eq(employeeCompensationRevisions.id, openEndedPrevious.id));
        }

        const overlaps = await findOverlappingRevisions({
          employeeId,
          effectiveFrom,
          effectiveTo,
          database: tx,
        });
        if (overlaps.length > 0) {
          throw new Error('COMPENSATION_PERIOD_OVERLAP');
        }

        const [revision] = await tx
          .insert(employeeCompensationRevisions)
          .values({
            employeeId,
            payType,
            baseRate: baseRate.toFixed(2),
            overtimeRate: overtimeRate.toFixed(2),
            effectiveFrom,
            effectiveTo,
            standardHoursPerDay: standardHoursPerDay.toFixed(2),
            notes: notes ?? null,
            isActive,
          })
          .returning();

        if (components.length > 0) {
          await tx.insert(employeeCompensationComponents).values(
            components.map((component: {
              componentType: string;
              name: string;
              calculationType: string;
              value: number;
              isTaxable?: boolean;
              countsForEpf?: boolean;
              isActive?: boolean;
            }) => ({
              revisionId: revision.id,
              componentType: component.componentType,
              name: component.name,
              calculationType: component.calculationType,
              value: component.value.toFixed(2),
              isTaxable: component.isTaxable ?? false,
              countsForEpf: component.countsForEpf ?? false,
              isActive: component.isActive ?? true,
            })),
          );
        }

        return revision;
      });

      await deactivateEndedCompensationRevisions({ employeeId, asOfDate: today });

      const revisionComponents = await db
        .select()
        .from(employeeCompensationComponents)
        .where(eq(employeeCompensationComponents.revisionId, createdRevision.id));

      if (createdRevision.isActive) {
        await syncLegacyCompensationFromRevision(employeeId, {
          payType: createdRevision.payType,
          baseRate: createdRevision.baseRate,
          overtimeRate: createdRevision.overtimeRate,
          effectiveFrom: createdRevision.effectiveFrom,
          notes: createdRevision.notes,
        });
      }

      await createAuditLog({
        userId: req.user?.id,
        action: 'employee_compensation_revision.create',
        entityType: 'employee',
        entityId: employeeId,
        changes: req.body,
        ipAddress: req.ip,
      });

      res.status(201).json({
        success: true,
        data: mapRevisionWithComponents(createdRevision, revisionComponents),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'COMPENSATION_PERIOD_OVERLAP') {
        res.status(400).json({
          success: false,
          error: 'Effective period overlaps with an existing compensation revision',
          code: 'COMPENSATION_PERIOD_OVERLAP',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (isMissingCompensationTable(error)) {
        res.status(503).json({
          success: false,
          error: 'Compensation schema is not ready. Run backend migrations and retry.',
          code: 'COMPENSATION_SCHEMA_NOT_READY',
          statusCode: 503,
          timestamp: new Date().toISOString(),
        });
        return;
      }
      logger.error('Failed to create compensation revision', { employeeId, error });
      res.status(500).json({ success: false, error: 'Failed to create compensation revision', statusCode: 500, timestamp: new Date().toISOString() });
    }
  },
);

// PUT /api/employees/:id/compensation/revisions/:revisionId
router.put(
  '/:id/compensation/revisions/:revisionId',
  authenticate,
  requirePermission('employees:update'),
  validate(updateCompensationRevisionSchema),
  async (req: Request, res: Response) => {
    const employeeId = parseInt(req.params.id as string, 10);
    const revisionId = parseInt(req.params.revisionId as string, 10);
    const today = isoToday();
    try {
      if (isNaN(employeeId) || isNaN(revisionId)) {
        res.status(400).json({ success: false, error: 'Invalid ID', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }

      const [employee] = await db
        .select({ id: employees.id, siteId: employees.siteId })
        .from(employees)
        .where(eq(employees.id, employeeId))
        .limit(1);
      if (!employee) {
        res.status(404).json({ success: false, error: 'Employee not found', statusCode: 404, timestamp: new Date().toISOString() });
        return;
      }
      if (req.user?.siteId && employee.siteId !== req.user.siteId) {
        res.status(403).json({ success: false, error: 'Access denied', statusCode: 403, timestamp: new Date().toISOString() });
        return;
      }

      const [existingRevision] = await db
        .select()
        .from(employeeCompensationRevisions)
        .where(
          and(
            eq(employeeCompensationRevisions.id, revisionId),
            eq(employeeCompensationRevisions.employeeId, employeeId),
          ),
        )
        .limit(1);

      if (!existingRevision) {
        res.status(404).json({ success: false, error: 'Compensation revision not found', statusCode: 404, timestamp: new Date().toISOString() });
        return;
      }

      if (existingRevision.effectiveTo && existingRevision.effectiveTo < today) {
        res.status(400).json({
          success: false,
          error: 'Only ongoing or future compensation revisions can be edited',
          code: 'COMPENSATION_REVISION_LOCKED',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const newEffectiveFrom = req.body.effectiveFrom ?? existingRevision.effectiveFrom;
      const newEffectiveTo = req.body.effectiveTo === undefined
        ? existingRevision.effectiveTo
        : req.body.effectiveTo;

      if (newEffectiveTo && newEffectiveTo < newEffectiveFrom) {
        res.status(400).json({
          success: false,
          error: 'effectiveTo must be on or after effectiveFrom',
          code: 'VALIDATION_ERROR',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (req.body.components) {
        const cap = await getPercentageComponentCap();
        const overCap = req.body.components.find((component: { calculationType: string; value: number }) =>
          component.calculationType === 'percentage' && component.value > cap);
        if (overCap) {
          res.status(400).json({
            success: false,
            error: `Percentage component value cannot exceed ${cap}%`,
            code: 'COMPENSATION_COMPONENT_CAP_EXCEEDED',
            statusCode: 400,
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }

      const overlaps = await findOverlappingRevisions({
        employeeId,
        effectiveFrom: newEffectiveFrom,
        effectiveTo: newEffectiveTo,
        excludeRevisionId: revisionId,
      });
      if (overlaps.length > 0) {
        res.status(400).json({
          success: false,
          error: 'Effective period overlaps with an existing compensation revision',
          code: 'COMPENSATION_PERIOD_OVERLAP',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (req.body.payType !== undefined) updateData.payType = req.body.payType;
      if (req.body.baseRate !== undefined) updateData.baseRate = req.body.baseRate.toFixed(2);
      if (req.body.overtimeRate !== undefined) updateData.overtimeRate = req.body.overtimeRate.toFixed(2);
      if (req.body.effectiveFrom !== undefined) updateData.effectiveFrom = req.body.effectiveFrom;
      if (req.body.effectiveTo !== undefined) updateData.effectiveTo = req.body.effectiveTo;
      if (req.body.standardHoursPerDay !== undefined) updateData.standardHoursPerDay = req.body.standardHoursPerDay.toFixed(2);
      if (req.body.notes !== undefined) updateData.notes = req.body.notes;
      if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;

      const [updatedRevision] = await db
        .update(employeeCompensationRevisions)
        .set(updateData)
        .where(eq(employeeCompensationRevisions.id, revisionId))
        .returning();

      await deactivateEndedCompensationRevisions({ employeeId, asOfDate: today });

      if (req.body.components) {
        await db.delete(employeeCompensationComponents).where(eq(employeeCompensationComponents.revisionId, revisionId));
        if (req.body.components.length > 0) {
          await db.insert(employeeCompensationComponents).values(
            req.body.components.map((component: {
              componentType: string;
              name: string;
              calculationType: string;
              value: number;
              isTaxable?: boolean;
              countsForEpf?: boolean;
              isActive?: boolean;
            }) => ({
              revisionId,
              componentType: component.componentType,
              name: component.name,
              calculationType: component.calculationType,
              value: component.value.toFixed(2),
              isTaxable: component.isTaxable ?? false,
              countsForEpf: component.countsForEpf ?? false,
              isActive: component.isActive ?? true,
            })),
          );
        }
      }

      const revisionComponents = await db
        .select()
        .from(employeeCompensationComponents)
        .where(eq(employeeCompensationComponents.revisionId, revisionId));

      if (updatedRevision.isActive) {
        await syncLegacyCompensationFromRevision(employeeId, {
          payType: updatedRevision.payType,
          baseRate: updatedRevision.baseRate,
          overtimeRate: updatedRevision.overtimeRate,
          effectiveFrom: updatedRevision.effectiveFrom,
          notes: updatedRevision.notes,
        });
      }

      await createAuditLog({
        userId: req.user?.id,
        action: 'employee_compensation_revision.update',
        entityType: 'employee',
        entityId: employeeId,
        changes: req.body,
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        data: mapRevisionWithComponents(updatedRevision, revisionComponents),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (isMissingCompensationTable(error)) {
        res.status(503).json({
          success: false,
          error: 'Compensation schema is not ready. Run backend migrations and retry.',
          code: 'COMPENSATION_SCHEMA_NOT_READY',
          statusCode: 503,
          timestamp: new Date().toISOString(),
        });
        return;
      }
      logger.error('Failed to update compensation revision', { employeeId, revisionId, error });
      res.status(500).json({ success: false, error: 'Failed to update compensation revision', statusCode: 500, timestamp: new Date().toISOString() });
    }
  },
);

// POST /api/employees/:id/compensation/revisions/:revisionId/activate
router.post(
  '/:id/compensation/revisions/:revisionId/activate',
  authenticate,
  requirePermission('employees:update'),
  async (req: Request, res: Response) => {
    const employeeId = parseInt(req.params.id as string, 10);
    const revisionId = parseInt(req.params.revisionId as string, 10);
    const today = isoToday();
    try {
      if (isNaN(employeeId) || isNaN(revisionId)) {
        res.status(400).json({ success: false, error: 'Invalid ID', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }

      const [employee] = await db
        .select({ id: employees.id, siteId: employees.siteId })
        .from(employees)
        .where(eq(employees.id, employeeId))
        .limit(1);
      if (!employee) {
        res.status(404).json({ success: false, error: 'Employee not found', statusCode: 404, timestamp: new Date().toISOString() });
        return;
      }
      if (req.user?.siteId && employee.siteId !== req.user.siteId) {
        res.status(403).json({ success: false, error: 'Access denied', statusCode: 403, timestamp: new Date().toISOString() });
        return;
      }

      const [targetRevision] = await db
        .select()
        .from(employeeCompensationRevisions)
        .where(
          and(
            eq(employeeCompensationRevisions.id, revisionId),
            eq(employeeCompensationRevisions.employeeId, employeeId),
          ),
        )
        .limit(1);
      if (!targetRevision) {
        res.status(404).json({ success: false, error: 'Compensation revision not found', statusCode: 404, timestamp: new Date().toISOString() });
        return;
      }

      const overlaps = await findOverlappingRevisions({
        employeeId,
        effectiveFrom: targetRevision.effectiveFrom,
        effectiveTo: targetRevision.effectiveTo,
        excludeRevisionId: revisionId,
      });

      const conflictingOverlaps = overlaps.filter((revision) => revision.isActive);
      for (const overlap of conflictingOverlaps) {
        if (overlap.effectiveTo === null && overlap.effectiveFrom < targetRevision.effectiveFrom) {
          const overlapEffectiveTo = minusOneDay(targetRevision.effectiveFrom);
          await db
            .update(employeeCompensationRevisions)
            .set({
              effectiveTo: overlapEffectiveTo,
              isActive: overlapEffectiveTo >= today,
              updatedAt: new Date(),
            })
            .where(eq(employeeCompensationRevisions.id, overlap.id));
          continue;
        }

        res.status(400).json({
          success: false,
          error: 'Cannot activate revision due to overlapping active compensation periods',
          code: 'COMPENSATION_ACTIVE_OVERLAP',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const [updatedRevision] = await db
        .update(employeeCompensationRevisions)
        .set({
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(employeeCompensationRevisions.id, revisionId))
        .returning();

      await deactivateEndedCompensationRevisions({ employeeId, asOfDate: today });

      const revisionComponents = await db
        .select()
        .from(employeeCompensationComponents)
        .where(eq(employeeCompensationComponents.revisionId, revisionId));

      await syncLegacyCompensationFromRevision(employeeId, {
        payType: updatedRevision.payType,
        baseRate: updatedRevision.baseRate,
        overtimeRate: updatedRevision.overtimeRate,
        effectiveFrom: updatedRevision.effectiveFrom,
        notes: updatedRevision.notes,
      });

      await createAuditLog({
        userId: req.user?.id,
        action: 'employee_compensation_revision.activate',
        entityType: 'employee',
        entityId: employeeId,
        changes: { revisionId },
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        data: mapRevisionWithComponents(updatedRevision, revisionComponents),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (isMissingCompensationTable(error)) {
        res.status(503).json({
          success: false,
          error: 'Compensation schema is not ready. Run backend migrations and retry.',
          code: 'COMPENSATION_SCHEMA_NOT_READY',
          statusCode: 503,
          timestamp: new Date().toISOString(),
        });
        return;
      }
      logger.error('Failed to activate compensation revision', { employeeId, revisionId, error });
      res.status(500).json({ success: false, error: 'Failed to activate compensation revision', statusCode: 500, timestamp: new Date().toISOString() });
    }
  },
);

// DELETE /api/employees/:id/compensation/revisions/:revisionId
router.delete(
  '/:id/compensation/revisions/:revisionId',
  authenticate,
  requirePermission('employees:update'),
  async (req: Request, res: Response) => {
    const employeeId = parseInt(req.params.id as string, 10);
    const revisionId = parseInt(req.params.revisionId as string, 10);
    const today = isoToday();
    try {
      if (isNaN(employeeId) || isNaN(revisionId)) {
        res.status(400).json({ success: false, error: 'Invalid ID', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }

      const [employee] = await db
        .select({ id: employees.id, siteId: employees.siteId })
        .from(employees)
        .where(eq(employees.id, employeeId))
        .limit(1);
      if (!employee) {
        res.status(404).json({ success: false, error: 'Employee not found', statusCode: 404, timestamp: new Date().toISOString() });
        return;
      }
      if (req.user?.siteId && employee.siteId !== req.user.siteId) {
        res.status(403).json({ success: false, error: 'Access denied', statusCode: 403, timestamp: new Date().toISOString() });
        return;
      }

      const [targetRevision] = await db
        .select()
        .from(employeeCompensationRevisions)
        .where(
          and(
            eq(employeeCompensationRevisions.id, revisionId),
            eq(employeeCompensationRevisions.employeeId, employeeId),
          ),
        )
        .limit(1);
      if (!targetRevision) {
        res.status(404).json({ success: false, error: 'Compensation revision not found', statusCode: 404, timestamp: new Date().toISOString() });
        return;
      }

      const [deletedRevision] = await db
        .delete(employeeCompensationRevisions)
        .where(
          and(
            eq(employeeCompensationRevisions.id, revisionId),
            eq(employeeCompensationRevisions.employeeId, employeeId),
          ),
        )
        .returning();

      if (!deletedRevision) {
        res.status(404).json({ success: false, error: 'Compensation revision not found', statusCode: 404, timestamp: new Date().toISOString() });
        return;
      }

      await deactivateEndedCompensationRevisions({ employeeId, asOfDate: today });

      const [currentRevision] = await db
        .select()
        .from(employeeCompensationRevisions)
        .where(
          and(
            eq(employeeCompensationRevisions.employeeId, employeeId),
            eq(employeeCompensationRevisions.isActive, true),
            lte(employeeCompensationRevisions.effectiveFrom, today),
            or(
              isNull(employeeCompensationRevisions.effectiveTo),
              gte(employeeCompensationRevisions.effectiveTo, today),
            )!,
          ),
        )
        .orderBy(desc(employeeCompensationRevisions.effectiveFrom))
        .limit(1);

      if (currentRevision) {
        await syncLegacyCompensationFromRevision(employeeId, {
          payType: currentRevision.payType,
          baseRate: currentRevision.baseRate,
          overtimeRate: currentRevision.overtimeRate,
          effectiveFrom: currentRevision.effectiveFrom,
          notes: currentRevision.notes,
        });
      } else {
        await db.delete(employeeCompensation).where(eq(employeeCompensation.employeeId, employeeId));
      }

      await createAuditLog({
        userId: req.user?.id,
        action: 'employee_compensation_revision.delete',
        entityType: 'employee',
        entityId: employeeId,
        changes: { revisionId },
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        data: { id: deletedRevision.id },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (isMissingCompensationTable(error)) {
        res.status(503).json({
          success: false,
          error: 'Compensation schema is not ready. Run backend migrations and retry.',
          code: 'COMPENSATION_SCHEMA_NOT_READY',
          statusCode: 503,
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (getDbErrorCode(error) === '23503') {
        res.status(409).json({
          success: false,
          error: 'Cannot delete compensation revision because it is referenced by payroll records',
          code: 'COMPENSATION_REVISION_IN_USE',
          statusCode: 409,
          timestamp: new Date().toISOString(),
        });
        return;
      }
      logger.error('Failed to delete compensation revision', { employeeId, revisionId, error });
      res.status(500).json({ success: false, error: 'Failed to delete compensation revision', statusCode: 500, timestamp: new Date().toISOString() });
    }
  },
);

// PUT /api/employees/:id/compensation (upsert)
router.put(
  '/:id/compensation',
  authenticate,
  requirePermission('employees:update'),
  validate(upsertCompensationSchema),
  async (req: Request, res: Response) => {
    const employeeId = parseInt(req.params.id as string, 10);
    try {
      if (isNaN(employeeId)) {
        res.status(400).json({ success: false, error: 'Invalid ID', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }

      const [employee] = await db
        .select({ id: employees.id, siteId: employees.siteId })
        .from(employees)
        .where(eq(employees.id, employeeId))
        .limit(1);

      if (!employee) {
        res.status(404).json({ success: false, error: 'Employee not found', statusCode: 404, timestamp: new Date().toISOString() });
        return;
      }

      if (req.user?.siteId && employee.siteId !== req.user.siteId) {
        res.status(403).json({ success: false, error: 'Access denied', statusCode: 403, timestamp: new Date().toISOString() });
        return;
      }

      const { payType, baseRate, overtimeRate = 0, effectiveFrom, notes } = req.body;

      const [existing] = await db
        .select()
        .from(employeeCompensation)
        .where(eq(employeeCompensation.employeeId, employeeId))
        .limit(1);

      let result;
      if (existing) {
        [result] = await db
          .update(employeeCompensation)
          .set({
            payType,
            baseRate: baseRate.toFixed(2),
            overtimeRate: overtimeRate.toFixed(2),
            effectiveFrom,
            notes: notes ?? null,
            updatedAt: new Date(),
          })
          .where(eq(employeeCompensation.employeeId, employeeId))
          .returning();
      } else {
        [result] = await db
          .insert(employeeCompensation)
          .values({
            employeeId,
            payType,
            baseRate: baseRate.toFixed(2),
            overtimeRate: overtimeRate.toFixed(2),
            effectiveFrom,
            notes: notes ?? null,
          })
          .returning();
      }

      // Backward-compatible endpoint keeps revision model in sync.
      const [latestRevision] = await db
        .select()
        .from(employeeCompensationRevisions)
        .where(eq(employeeCompensationRevisions.employeeId, employeeId))
        .orderBy(desc(employeeCompensationRevisions.effectiveFrom))
        .limit(1);

      if (latestRevision) {
        await db
          .update(employeeCompensationRevisions)
          .set({
            payType,
            baseRate: baseRate.toFixed(2),
            overtimeRate: overtimeRate.toFixed(2),
            effectiveFrom,
            notes: notes ?? null,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(employeeCompensationRevisions.id, latestRevision.id));
      } else {
        await db
          .insert(employeeCompensationRevisions)
          .values({
            employeeId,
            payType,
            baseRate: baseRate.toFixed(2),
            overtimeRate: overtimeRate.toFixed(2),
            effectiveFrom,
            standardHoursPerDay: DEFAULT_STANDARD_HOURS_PER_DAY.toFixed(2),
            notes: notes ?? null,
            isActive: true,
          });
      }

      await createAuditLog({
        userId: req.user?.id,
        action: existing ? 'employee_compensation.update' : 'employee_compensation.create',
        entityType: 'employee',
        entityId: employeeId,
        changes: req.body,
        ipAddress: req.ip,
      });

      res.status(existing ? 200 : 201).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (isMissingCompensationTable(error)) {
        logger.error('Employee compensation schema missing during upsert', {
          employeeId,
          userId: req.user?.id,
          payType: req.body?.payType,
          effectiveFrom: req.body?.effectiveFrom,
          errorCode: getDbErrorCode(error),
          error,
        });
        res.status(503).json({
          success: false,
          error: 'Compensation schema is not ready. Run backend migrations and retry.',
          code: 'COMPENSATION_SCHEMA_NOT_READY',
          statusCode: 503,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (isConstraintError(error)) {
        logger.warn('Employee compensation upsert constraint violation', {
          employeeId,
          userId: req.user?.id,
          payType: req.body?.payType,
          effectiveFrom: req.body?.effectiveFrom,
          errorCode: getDbErrorCode(error),
          error,
        });
        res.status(400).json({
          success: false,
          error: 'Invalid compensation data',
          code: 'COMPENSATION_CONSTRAINT_ERROR',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      logger.error('Failed to upsert employee compensation', { error });
      res.status(500).json({ success: false, error: 'Failed to save compensation', statusCode: 500, timestamp: new Date().toISOString() });
    }
  },
);

// DELETE /api/employees/:id/compensation
router.delete(
  '/:id/compensation',
  authenticate,
  requirePermission('employees:update'),
  async (req: Request, res: Response) => {
    const employeeId = parseInt(req.params.id as string, 10);
    try {
      if (isNaN(employeeId)) {
        res.status(400).json({ success: false, error: 'Invalid ID', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }

      const [employee] = await db
        .select({ id: employees.id, siteId: employees.siteId })
        .from(employees)
        .where(eq(employees.id, employeeId))
        .limit(1);

      if (!employee) {
        res.status(404).json({ success: false, error: 'Employee not found', statusCode: 404, timestamp: new Date().toISOString() });
        return;
      }

      if (req.user?.siteId && employee.siteId !== req.user.siteId) {
        res.status(403).json({ success: false, error: 'Access denied', statusCode: 403, timestamp: new Date().toISOString() });
        return;
      }

      const [deleted] = await db
        .delete(employeeCompensation)
        .where(eq(employeeCompensation.employeeId, employeeId))
        .returning();

      if (!deleted) {
        res.status(404).json({ success: false, error: 'Compensation not found', statusCode: 404, timestamp: new Date().toISOString() });
        return;
      }

      await db
        .update(employeeCompensationRevisions)
        .set({
          isActive: false,
          effectiveTo: isoToday(),
          updatedAt: new Date(),
        })
        .where(eq(employeeCompensationRevisions.employeeId, employeeId));

      await createAuditLog({
        userId: req.user?.id,
        action: 'employee_compensation.delete',
        entityType: 'employee',
        entityId: employeeId,
        ipAddress: req.ip,
      });

      res.json({ success: true, data: { message: 'Compensation removed' }, timestamp: new Date().toISOString() });
    } catch (error) {
      if (isMissingCompensationTable(error)) {
        logger.error('Employee compensation schema missing during delete', {
          employeeId,
          userId: req.user?.id,
          errorCode: getDbErrorCode(error),
          error,
        });
        res.status(503).json({
          success: false,
          error: 'Compensation schema is not ready. Run backend migrations and retry.',
          code: 'COMPENSATION_SCHEMA_NOT_READY',
          statusCode: 503,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      logger.error('Failed to delete employee compensation', { error });
      res.status(500).json({ success: false, error: 'Failed to delete compensation', statusCode: 500, timestamp: new Date().toISOString() });
    }
  },
);

export default router;
