import {
  LayoutDashboard,
  Users,
  Building2,
  Egg,
  Package,
  ShoppingCart,
  CalendarDays,
  Banknote,
  Landmark,
  ShieldEllipsis,
  UserPlus,
  BarChart3,
  Wheat,
  HeartPulse,
  Settings,
  ClipboardCheck,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  type: 'link';
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  requiredPermission?: string;
}

export interface NavGroup {
  type: 'group';
  key: string;
  label: string;
  icon: LucideIcon;
  children: NavItem[];
}

export type MainNavigationItem = NavItem | NavGroup;

export const mainNavigationItems: MainNavigationItem[] = [
  {
    type: 'link',
    key: 'dashboard',
    label: 'Home',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    type: 'group',
    key: 'farms',
    label: 'Farms',
    icon: Egg,
    children: [
      // Place first, then the flock in it, then its care, then the controls around it.
      { type: 'link', key: 'sites', label: 'Sites & houses', href: '/sites', icon: Building2, requiredPermission: 'sites:read' },
      { type: 'link', key: 'batches', label: 'Batches', href: '/batches', icon: Egg, requiredPermission: 'batches:read' },
      { type: 'link', key: 'farm-care', label: 'Health & care', href: '/farm-care', icon: HeartPulse, requiredPermission: 'batches:read' },
      { type: 'link', key: 'farm-control', label: 'Farm control', href: '/farm-control', icon: ShieldEllipsis, requiredPermission: 'inventory:read' },
    ],
  },
  {
    type: 'link',
    key: 'feed',
    label: 'Feed mill',
    href: '/feed',
    icon: Wheat,
    requiredPermission: 'feed_inventory:read',
  },
  {
    type: 'link',
    key: 'inventory',
    label: 'Stock',
    href: '/inventory',
    icon: Package,
    requiredPermission: 'feed_inventory:read',
  },
  {
    type: 'link',
    key: 'sales',
    label: 'Sales',
    href: '/sales',
    icon: ShoppingCart,
    requiredPermission: 'sales:read',
  },
  {
    type: 'link',
    key: 'treasury',
    label: 'Money',
    href: '/treasury',
    icon: Landmark,
    requiredPermission: 'treasury:read',
  },
  {
    type: 'group',
    key: 'people',
    label: 'People',
    icon: Users,
    children: [
      { type: 'link', key: 'employees', label: 'Employees', href: '/employees', icon: Users, requiredPermission: 'employees:read' },
      { type: 'link', key: 'attendance', label: 'Attendance', href: '/attendance', icon: CalendarDays, requiredPermission: 'attendance:read' },
      { type: 'link', key: 'payroll', label: 'Payroll', href: '/payroll', icon: Banknote, requiredPermission: 'payroll:read' },
    ],
  },
  {
    type: 'link',
    key: 'reports',
    label: 'Reports',
    href: '/reports',
    icon: BarChart3,
    requiredPermission: 'reports:read',
  },
];

/** Administration lives in the profile menu, not the main bar. */
export const adminNavigationItems: NavItem[] = [
  { type: 'link', key: 'approvals', label: 'Approvals', href: '/approvals', icon: ClipboardCheck },
  { type: 'link', key: 'users', label: 'Users & access', href: '/settings?section=users', icon: UserPlus, requiredPermission: 'users:read' },
  { type: 'link', key: 'settings', label: 'Settings', href: '/settings', icon: Settings, requiredPermission: 'system:read' },
];

/** Phone bottom bar: the four places people go most; everything else sits under "More". */
export const mobilePrimaryKeys = ['dashboard', 'farms', 'sales', 'treasury'];

type PermissionChecker = (permission: string) => boolean;

export function canAccessItem(item: NavItem, hasPermission: PermissionChecker): boolean {
  return !item.requiredPermission || hasPermission(item.requiredPermission);
}

export function filterVisibleMainNavigation(
  items: MainNavigationItem[],
  hasPermission: PermissionChecker,
): MainNavigationItem[] {
  return items
    .map((item) => {
      if (item.type === 'group') {
        const children = item.children.filter((child) => canAccessItem(child, hasPermission));
        if (children.length === 0) {
          return null;
        }
        return { ...item, children };
      }
      return canAccessItem(item, hasPermission) ? item : null;
    })
    .filter((item): item is MainNavigationItem => item !== null);
}

export function isHrefActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') {
    return pathname === '/dashboard';
  }
  return pathname.startsWith(href);
}

export function isMainNavigationItemActive(pathname: string, item: MainNavigationItem): boolean {
  if (item.type === 'group') {
    return item.children.some((child) => isHrefActive(pathname, child.href));
  }
  return isHrefActive(pathname, item.href);
}
