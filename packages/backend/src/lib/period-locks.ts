import { and, desc, eq, or, sql } from 'drizzle-orm';
import { db } from '../db';
import { periodLocks } from '../db/schema';

export type PeriodLockScope = 'financial' | 'inventory' | 'costing' | 'all';

function normalizeDate(value: string | Date) {
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  return value.slice(0, 10);
}

export async function getNextPeriodLockCode(dateValue: string) {
  const dateStr = normalizeDate(dateValue).replace(/-/g, '');
  const prefix = `LOCK-${dateStr}-`;
  const [result] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(periodLocks)
    .where(sql`${periodLocks.lockCode} LIKE ${`${prefix}%`}`);
  const seq = String((result?.total ?? 0) + 1).padStart(3, '0');
  return `${prefix}${seq}`;
}

export async function getActivePeriodLocks(scope?: PeriodLockScope) {
  return db
    .select()
    .from(periodLocks)
    .where(
      and(
        eq(periodLocks.status, 'active'),
        scope
          ? or(eq(periodLocks.scope, scope), eq(periodLocks.scope, 'all'))
          : undefined,
      ),
    )
    .orderBy(desc(periodLocks.periodStart), desc(periodLocks.id));
}

export async function assertPeriodOpen(
  dateValue: string | Date,
  scope: PeriodLockScope,
  message?: string,
) {
  const dateStr = normalizeDate(dateValue);
  const [lock] = await db
    .select()
    .from(periodLocks)
    .where(
      and(
        eq(periodLocks.status, 'active'),
        or(eq(periodLocks.scope, scope), eq(periodLocks.scope, 'all')),
        sql`${periodLocks.periodStart} <= ${dateStr} AND ${periodLocks.periodEnd} >= ${dateStr}`,
      ),
    )
    .orderBy(desc(periodLocks.periodStart), desc(periodLocks.id))
    .limit(1);

  if (lock) {
    throw new Error(
      message
        ?? `This ${scope} date falls within closed period ${lock.periodStart} to ${lock.periodEnd}`,
    );
  }
}
