import { UserRole } from '@farmflow/shared';
import { getUserPermissions, hasPermission } from '../lib/permissions';

describe('Permissions', () => {
  describe('getUserPermissions', () => {
    it('should return permissions for system_admin', () => {
      const perms = getUserPermissions(UserRole.SystemAdmin);
      expect(perms).toContain('users:create');
      expect(perms).toContain('users:delete');
      expect(perms).toContain('system:*');
    });

    it('should return permissions for farm_worker', () => {
      const perms = getUserPermissions(UserRole.FarmWorker);
      expect(perms).toContain('daily_records:create');
      expect(perms).toContain('daily_records:read_own');
      expect(perms).not.toContain('users:create');
    });

    it('should return permissions for viewer', () => {
      const perms = getUserPermissions(UserRole.Viewer);
      expect(perms).toContain('reports:read');
      expect(perms).toContain('batches:read');
      expect(perms).not.toContain('batches:create');
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
