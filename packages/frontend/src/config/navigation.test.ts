import { describe, expect, it } from 'vitest';
import { adminNavigationItems, canAccessItem, filterVisibleMainNavigation, mainNavigationItems } from './navigation';

const can = (allowed: string[]) => (permission: string) => allowed.includes(permission);
const keys = (items: Array<{ key: string; type: string; children?: Array<{ key: string }> }>) =>
  items.flatMap((item) => (item.type === 'group' ? [item.key, ...(item.children ?? []).map((c) => c.key)] : [item.key]));

describe('navigation follows permissions', () => {
  it('shows a farm worker only what their role allows', () => {
    const visible = keys(filterVisibleMainNavigation(mainNavigationItems, can(['batches:read', 'dashboard:read'])));
    expect(visible).toContain('dashboard');
    expect(visible).not.toContain('treasury');
    expect(visible).not.toContain('sales');
  });

  it('drops a group whose children are all hidden', () => {
    const visible = filterVisibleMainNavigation(mainNavigationItems, can([]));
    expect(visible.every((item) => item.type !== 'group' || item.children.length > 0)).toBe(true);
  });

  it('keeps Settings for people who can read system settings', () => {
    const settings = adminNavigationItems.find((item) => item.key === 'settings')!;
    expect(canAccessItem(settings, can(['system:read']))).toBe(true);
    expect(canAccessItem(settings, can([]))).toBe(false);
  });
});
