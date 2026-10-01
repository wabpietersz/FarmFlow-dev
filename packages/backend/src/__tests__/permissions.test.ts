import { UserRole } from '@farmflow/shared';
import { getUserPermissions, hasPermission } from '../lib/permissions';

describe('Permissions', () => {
  describe('getUserPermissions', () => {
    it('gives system admins everything, including user management', () => {
      expect(hasPermission(UserRole.SystemAdmin, 'users:create')).toBe(true);
      expect(hasPermission(UserRole.SystemAdmin, 'users:delete')).toBe(true);
      expect(getUserPermissions(UserRole.SystemAdmin)).toContain('system:*');
    });

    it('lets farm workers record daily checks but not manage users', () => {
      expect(hasPermission(UserRole.FarmWorker, 'daily_records:create')).toBe(true);
      expect(hasPermission(UserRole.FarmWorker, 'batches:create')).toBe(false);
      expect(hasPermission(UserRole.FarmWorker, 'users:create')).toBe(false);
    });

    it('limits viewers to reports by default', () => {
      expect(hasPermission(UserRole.Viewer, 'reports:read')).toBe(true);
      expect(hasPermission(UserRole.Viewer, 'reports:financial:read')).toBe(false);
      expect(hasPermission(UserRole.Viewer, 'batches:create')).toBe(false);
    });

    it('gives admin level everything user level has, plus more', () => {
      expect(hasPermission(UserRole.Supervisor, 'attendance:delete')).toBe(true);
      expect(hasPermission(UserRole.FarmManager, 'attendance:create')).toBe(true);
      expect(hasPermission(UserRole.FarmManager, 'attendance:delete')).toBe(false);
    });

    it('should return empty array for invalid role', () => {
      const perms = getUserPermissions('invalid' as UserRole);
      expect(perms).toEqual([]);
    });
  });

  describe('hasPermission', () => {
    it('should return true for exact permission match', () => {
      expect(hasPermission(UserRole.SystemAdmin, 'users:create')).toBe(true);
    });

    it('should return false for missing permission', () => {
      expect(hasPermission(UserRole.Viewer, 'users:create')).toBe(false);
    });

    it('should support wildcard permissions', () => {
      expect(hasPermission(UserRole.FarmManager, 'batches:create')).toBe(true);
      expect(hasPermission(UserRole.FarmManager, 'batches:delete')).toBe(true);
      expect(hasPermission(UserRole.FarmManager, 'batches:read')).toBe(true);
    });

    it('should not grant wildcard permissions across resources', () => {
      expect(hasPermission(UserRole.FarmManager, 'users:create')).toBe(false);
    });

    it('should handle supervisor permissions correctly', () => {
      expect(hasPermission(UserRole.Supervisor, 'batches:update')).toBe(true);
      expect(hasPermission(UserRole.Supervisor, 'daily_records:create')).toBe(true);
      expect(hasPermission(UserRole.Supervisor, 'users:create')).toBe(false);
    });

    it('should handle accountant permissions correctly', () => {
      expect(hasPermission(UserRole.Accountant, 'payroll:read')).toBe(true);
      expect(hasPermission(UserRole.Accountant, 'sales:create')).toBe(true);
      expect(hasPermission(UserRole.Accountant, 'batches:create')).toBe(false);
    });

    it('should handle feed_mill_operator permissions correctly', () => {
      expect(hasPermission(UserRole.FeedMillOperator, 'feed_inventory:create')).toBe(true);
      expect(hasPermission(UserRole.FeedMillOperator, 'reports:feed:read')).toBe(true);
      expect(hasPermission(UserRole.FeedMillOperator, 'users:create')).toBe(false);
    });
  });
});
