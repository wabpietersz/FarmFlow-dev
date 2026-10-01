import type { NextFunction, Request, Response } from 'express';
import { eq, sql, type Column, type SQL } from 'drizzle-orm';
import { qualified } from './sql-utils';
import { db } from '../db';
import { batchHealthTasks, batches, cages, employees, houseTurnarounds, payroll, sales, vetVisits } from '../db/schema';

/**
 * Farm scope: a user with a farm (users.site_id) only sees and changes that farm's data.
 * Users without a farm — and system admins — see everything.
 */
export function siteScope(req: Request): number | null {
  if (!req.user || req.user.userRole === 'system_admin') return null;
  return req.user.siteId ?? null;
}

/** `eq(column, farm)` for scoped users, nothing for everyone else — for list queries. */
export function scopeCondition(req: Request, column: Column): SQL | undefined {
  const scope = siteScope(req);
  return scope ? eq(column, scope) : undefined;
}

/** True when the user may touch data of this farm. */
export function canAccessSite(req: Request, siteId: number | null | undefined) {
  const scope = siteScope(req);
  return !scope || siteId == null || siteId === scope;
}

type SiteResolver = (req: Request) => Promise<number | null | undefined>;

/**
 * Route guard: works out which farm a record belongs to and refuses other farms (403).
 * Unknown records pass through so the handler can answer 404 as usual.
 */
export function requireSiteAccess(resolve: SiteResolver) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!siteScope(req)) return next();
      const siteId = await resolve(req);
      if (canAccessSite(req, siteId)) return next();
      res.status(403).json({ success: false, error: 'This belongs to another farm', code: 'FORBIDDEN', statusCode: 403, timestamp: new Date().toISOString() });
    } catch (error) {
      next(error);
    }
  };
}

const num = (value: unknown) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const first = async <T>(rows: Promise<T[]>) => (await rows)[0];

/** Resolvers for the common records. `param` names the route parameter (default "id"). */
export const siteOf = {
  param: (param = 'siteId'): SiteResolver => async (req) => num(req.params[param]),
  bodySite: (): SiteResolver => async (req) => num(req.body?.siteId),
  batch: (param = 'id'): SiteResolver => async (req) => {
    const id = num(req.params[param]);
    return id ? (await first(db.select({ siteId: batches.siteId }).from(batches).where(eq(batches.id, id))))?.siteId : null;
  },
  bodyBatch: (): SiteResolver => async (req) => {
    const id = num(req.body?.batchId);
    return id ? (await first(db.select({ siteId: batches.siteId }).from(batches).where(eq(batches.id, id))))?.siteId : num(req.body?.siteId);
  },
  sale: (param = 'id'): SiteResolver => async (req) => {
    const id = num(req.params[param]);
    if (!id) return null;
    // Older sales may only have a batch; its farm counts
    return (await first(db.select({ siteId: sql<number | null>`COALESCE(${qualified(sales.siteId)}, ${qualified(batches.siteId)})` })
      .from(sales).leftJoin(batches, eq(sales.batchId, batches.id)).where(eq(sales.id, id))))?.siteId;
  },
  employee: (param = 'id'): SiteResolver => async (req) => {
    const id = num(req.params[param]);
    return id ? (await first(db.select({ siteId: employees.siteId }).from(employees).where(eq(employees.id, id))))?.siteId : null;
  },
  bodyEmployee: (): SiteResolver => async (req) => {
    const id = num(req.body?.employeeId);
    return id ? (await first(db.select({ siteId: employees.siteId }).from(employees).where(eq(employees.id, id))))?.siteId : null;
  },
  payroll: (param = 'id'): SiteResolver => async (req) => {
    const id = num(req.params[param]);
    if (!id) return null;
    return (await first(db.select({ siteId: employees.siteId }).from(payroll).innerJoin(employees, eq(payroll.employeeId, employees.id)).where(eq(payroll.id, id))))?.siteId;
  },
  healthTask: (param = 'taskId'): SiteResolver => async (req) => {
    const id = num(req.params[param]);
    if (!id) return null;
    return (await first(db.select({ siteId: batches.siteId }).from(batchHealthTasks).innerJoin(batches, eq(batchHealthTasks.batchId, batches.id)).where(eq(batchHealthTasks.id, id))))?.siteId;
  },
  vetVisit: (param = 'id'): SiteResolver => async (req) => {
    const id = num(req.params[param]);
    return id ? (await first(db.select({ siteId: vetVisits.siteId }).from(vetVisits).where(eq(vetVisits.id, id))))?.siteId : null;
  },
  turnaround: (param = 'id'): SiteResolver => async (req) => {
    const id = num(req.params[param]);
    if (!id) return null;
    return (await first(db.select({ siteId: cages.siteId }).from(houseTurnarounds).innerJoin(cages, eq(houseTurnarounds.cageId, cages.id)).where(eq(houseTurnarounds.id, id))))?.siteId;
  },
};
