import { UserRole } from '@farmflow/shared';

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.SystemAdmin]: [
    'users:create', 'users:read', 'users:update', 'users:delete',
    'system:*',
    'reports:*',
    'audit_logs:read',
    'employees:*',
    'batches:*',
    'daily_records:*',
    'vaccinations:*',
    'sales:*',
    'payments:*',
    'sites:*',
    'feed_inventory:*',
    'feed_production:*',
    'attendance:*',
    'payroll:*',
  ],
  [UserRole.FarmManager]: [
    'batches:*',
    'daily_records:*',
    'vaccinations:*',
    'employees:read', 'employees:create', 'employees:update',
    'sites:read',
    'attendance:read',
    'sales:read',
    'reports:*',
  ],
  [UserRole.Accountant]: [
    'employees:read',
    'employees:salary',
    'payroll:*',
    'sales:*',
    'payments:*',
    'reports:financial:read',
    'audit_logs:read',
  ],
  [UserRole.Supervisor]: [
    'batches:*',
    'daily_records:*',
    'attendance:*',
    'vaccinations:*',
    'reports:batch:read',
  ],
  [UserRole.FeedMillOperator]: [
    'feed_inventory:*',
    'feed_production:*',
    'reports:feed:read',
  ],
  [UserRole.FarmWorker]: [
    'daily_records:create',
    'daily_records:read_own',
    'attendance:read_own',
  ],
  [UserRole.Viewer]: [
    'reports:read',
    'employees:read',
    'batches:read',
    'sales:read',
  ],
};

export function getUserPermissions(role: UserRole): string[] {
  return ROLE_PERMISSIONS[role] || [];
}

export function hasPermission(role: UserRole, permission: string): boolean {
  const permissions = getUserPermissions(role);
  return permissions.some((p) => {
    if (p === permission) return true;
    if (p.endsWith(':*')) {
      const prefix = p.slice(0, -1); // e.g. "batches:"
      return permission.startsWith(prefix);
    }
    return false;
  });
}
