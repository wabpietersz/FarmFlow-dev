import { Router, type Request, type Response } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate } from '../validators/auth';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  emergencyContactSchema,
  bankDetailsSchema,
  employeeQuerySchema,
} from '../validators/employee';
import { db } from '../db';
import { employees, emergencyContacts, bankDetails, sites } from '../db/schema';
import { eq, and, or, ilike, sql, asc, desc } from 'drizzle-orm';
import { createAuditLog } from '../lib/audit';
import logger from '../lib/logger';

const router = Router();

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

      // Fetch with site name
      const rows = await db
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
          createdAt: employees.createdAt,
          updatedAt: employees.updatedAt,
        })
        .from(employees)
        .leftJoin(sites, eq(employees.siteId, sites.id))
        .where(where)
        .orderBy(orderFn(sortColumn))
        .limit(limit)
        .offset(offset);

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
        .select()
        .from(employees)
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

      res.json({
        success: true,
        data: {
          employee,
          emergencyContacts: contacts,
          bankDetails: bank ?? null,
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
          employmentType: data.employmentType,
          joinDate: data.joinDate,
          phone: data.phone ?? null,
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

export default router;
