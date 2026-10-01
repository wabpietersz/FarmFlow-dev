import { eq } from 'drizzle-orm';
import { UserRole, type AccessLevel, type AccessMatrix, type AccessModule, type AccessModuleKey } from '@farmflow/shared';
import { db } from '../db';
import { roleModuleAccess } from '../db/schema';
import logger from './logger';

/**
 * Access is set per module with two levels. "User" covers day-to-day work; "Admin" adds managing,
 * approving, deleting and configuring. Every check in the app is a permission string; each module maps its
 * levels to the permission strings it grants, so the grid in Settings controls everything.
 */
interface ModuleDefinition extends AccessModule {
  userPermissions: string[];
  adminPermissions: string[];
}

export const ACCESS_MODULES: ModuleDefinition[] = [
  {
    key: 'farms',
    label: 'Farms & batches',
    description: 'Batches, daily checks, health plans, sites and houses',
    userCan: 'See batches and sites; record daily checks, deaths and vaccinations',
    adminCan: 'Create, close and reopen batches; manage sites, houses and health programmes',
    userPermissions: ['batches:read', 'batches:update', 'daily_records:*', 'vaccinations:*', 'sites:read'],
    adminPermissions: ['batches:*', 'sites:*'],
  },
  {
    key: 'feed_mill',
    label: 'Feed mill',
    description: 'Raw materials, recipes, production and dispatch to farms',
    userCan: 'See feed stock and recipes; run production and dispatch feed',
    adminCan: 'Manage feed stock and recipes; delete production runs',
    userPermissions: ['feed_inventory:read', 'feed_production:read', 'feed_production:create', 'feed_production:update'],
    adminPermissions: ['feed_inventory:*', 'feed_production:*'],
  },
  {
    key: 'stock',
    label: 'Stock & purchasing',
    description: 'Stores, purchase orders, suppliers, invoices',
    userCan: 'See stock; receive goods, use stock on batches, move stock, raise requisitions',
    adminCan: 'Manage suppliers, purchase orders, invoices, stores and item types',
    userPermissions: ['inventory:read', 'inventory:update', 'feed_inventory:read'],
    adminPermissions: ['inventory:*'],
  },
  {
    key: 'sales',
    label: 'Sales',
    description: 'Buyers, bird sales and receipts',
    userCan: 'See sales and buyers; record sales and receipts',
    adminCan: 'Edit and cancel sales; change payments and cheque status',
    userPermissions: ['sales:read', 'sales:create', 'payments:read', 'payments:create'],
    adminPermissions: ['sales:*', 'payments:*'],
  },
  {
    key: 'money',
    label: 'Money',
    description: 'Accounts, ledger, payments, cheques, petty cash',
    userCan: 'See accounts and the ledger; submit petty cash spending',
    adminCan: 'Record money movements, pay expenses, manage accounts, cheques and finance setup',
    userPermissions: ['treasury:read', 'treasury:petty_cash:submit'],
    adminPermissions: ['treasury:*'],
  },
  {
    key: 'people',
    label: 'People',
    description: 'Employee records',
    userCan: 'See staff details',
    adminCan: 'Add, edit and remove employees',
    userPermissions: ['employees:read'],
    adminPermissions: ['employees:create', 'employees:update', 'employees:delete'],
  },
  {
    key: 'attendance',
    label: 'Attendance & leave',
    description: 'Daily attendance, shifts and leave balances',
    userCan: 'See and record attendance and leave',
    adminCan: 'Delete attendance, manage shifts and leave balances',
    userPermissions: ['attendance:read', 'attendance:create', 'attendance:update', 'employees:read'],
    adminPermissions: ['attendance:*'],
  },
  {
    key: 'payroll',
    label: 'Payroll',
    description: 'Pay runs, salaries, EPF/ETF',
    userCan: 'See payroll',
    adminCan: 'Run, approve and pay payroll; see and change salaries',
    userPermissions: ['payroll:read'],
    adminPermissions: ['payroll:*', 'employees:salary'],
  },
  {
    key: 'reports',
    label: 'Reports',
    description: 'Performance, sales and financial reports',
    userCan: 'See batch, feed and operational reports',
    adminCan: 'See financial and profitability reports and the audit log; schedule reports',
    userPermissions: ['reports:read', 'reports:batch:read', 'reports:feed:read'],
    adminPermissions: ['reports:*', 'audit_logs:read'],
  },
  {
    key: 'administration',
    label: 'Administration',
    description: 'Users, access, lists and system settings',
    userCan: 'See settings',
    adminCan: 'Manage users, access levels and all settings',
    userPermissions: ['system:read'],
    adminPermissions: ['system:*', 'users:*'],
  },
];

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.SystemAdmin]: 'System admin',
  [UserRole.FarmManager]: 'Farm manager',
  [UserRole.Accountant]: 'Accountant',
  [UserRole.Supervisor]: 'Supervisor',
  [UserRole.FeedMillOperator]: 'Feed mill operator',
  [UserRole.FarmWorker]: 'Farm worker',
  [UserRole.Viewer]: 'Viewer',
};

type Levels = Record<AccessModuleKey, AccessLevel>;
const none = (): Levels => Object.fromEntries(ACCESS_MODULES.map((m) => [m.key, 'none'])) as Levels;

/** Starting point for each role (matches what each role could do before access became editable). */
export const DEFAULT_ACCESS: Record<UserRole, Levels> = {
  [UserRole.SystemAdmin]: Object.fromEntries(ACCESS_MODULES.map((m) => [m.key, 'admin'])) as Levels,
  [UserRole.FarmManager]: { ...none(), farms: 'admin', feed_mill: 'admin', stock: 'admin', sales: 'user', money: 'user', people: 'admin', attendance: 'user', reports: 'admin' },
  [UserRole.Accountant]: { ...none(), stock: 'user', sales: 'admin', money: 'admin', people: 'user', attendance: 'user', payroll: 'admin', reports: 'admin' },
  [UserRole.Supervisor]: { ...none(), farms: 'user', stock: 'user', attendance: 'admin', reports: 'user' },
  [UserRole.FeedMillOperator]: { ...none(), feed_mill: 'admin', stock: 'user', reports: 'user' },
  [UserRole.FarmWorker]: { ...none(), farms: 'user' },
  [UserRole.Viewer]: { ...none(), reports: 'user' },
};

// ─── The live grid (cached; refreshed from the database) ─────────────────────

let cache: Partial<Record<string, Levels>> = {};
let loadedAt = 0;
const REFRESH_MS = 60_000;

function levelsFor(role: string): Levels {
  if (role === UserRole.SystemAdmin) return DEFAULT_ACCESS[UserRole.SystemAdmin];
  return cache[role] ?? DEFAULT_ACCESS[role as UserRole] ?? none();
}

/** Load the grid from the database, creating the default rows on first run. */
export async function loadAccessMatrix() {
  try {
    let rows = await db.select().from(roleModuleAccess);
    if (rows.length === 0) {
      const seed = Object.entries(DEFAULT_ACCESS).flatMap(([role, levels]) =>
        Object.entries(levels).map(([moduleKey, level]) => ({ role, moduleKey, level })));
      await db.insert(roleModuleAccess).values(seed).onConflictDoNothing();
      rows = await db.select().from(roleModuleAccess);
    }
    const next: Partial<Record<string, Levels>> = {};
    for (const row of rows) {
      next[row.role] ??= { ...(DEFAULT_ACCESS[row.role as UserRole] ?? none()) };
      next[row.role]![row.moduleKey as AccessModuleKey] = row.level as AccessLevel;
    }
    cache = next;
    loadedAt = Date.now();
  } catch (error) {
    // Database not ready (e.g. before migrations): keep using defaults rather than locking everyone out.
    logger.warn('Could not load access matrix; using defaults', { error: (error as Error).message });
  }
}

function refreshIfStale() {
  if (Date.now() - loadedAt > REFRESH_MS) {
    loadedAt = Date.now();
    void loadAccessMatrix();
  }
}

export function getUserPermissions(role: UserRole | string): string[] {
  refreshIfStale();
  const levels = levelsFor(role);
  const permissions = new Set<string>();
  for (const module of ACCESS_MODULES) {
    const level = levels[module.key];
    if (level === 'user' || level === 'admin') module.userPermissions.forEach((p) => permissions.add(p));
    if (level === 'admin') module.adminPermissions.forEach((p) => permissions.add(p));
  }
  return [...permissions];
}

export function hasPermission(role: UserRole | string, permission: string): boolean {
  return getUserPermissions(role).some((p) => {
    if (p === permission) return true;
    if (p.endsWith(':*')) return permission.startsWith(p.slice(0, -1));
    return false;
  });
}

export function getAccessMatrix(): AccessMatrix {
  return {
    modules: ACCESS_MODULES.map(({ key, label, description, userCan, adminCan }) => ({ key, label, description, userCan, adminCan })),
    roles: (Object.values(UserRole) as UserRole[]).map((role) => ({
      role,
      roleLabel: ROLE_LABELS[role],
      locked: role === UserRole.SystemAdmin,
      levels: levelsFor(role),
    })),
  };
}

export async function setAccessLevel(params: { role: string; moduleKey: AccessModuleKey; level: AccessLevel; userId: number }) {
  if (params.role === UserRole.SystemAdmin) throw new Error('System admins always have full access');
  if (!Object.values(UserRole).includes(params.role as UserRole)) throw new Error('Unknown role');
  if (!ACCESS_MODULES.some((m) => m.key === params.moduleKey)) throw new Error('Unknown module');
  const [existing] = await db.select().from(roleModuleAccess)
    .where(eq(roleModuleAccess.role, params.role))
    .then((rows) => rows.filter((r) => r.moduleKey === params.moduleKey));
  if (existing) {
    await db.update(roleModuleAccess).set({ level: params.level, updatedBy: params.userId, updatedAt: new Date() }).where(eq(roleModuleAccess.id, existing.id));
  } else {
    await db.insert(roleModuleAccess).values({ role: params.role, moduleKey: params.moduleKey, level: params.level, updatedBy: params.userId });
  }
  await loadAccessMatrix();
  return getAccessMatrix();
}
