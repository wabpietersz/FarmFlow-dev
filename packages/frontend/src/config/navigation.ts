import {
  LayoutDashboard,
  Users,
  Building2,
  Egg,
  ShoppingCart,
  UserPlus,
  BarChart3,
  Wheat,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  requiredPermission?: string;
}

export const navigationItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Employees', href: '/employees', icon: Users, requiredPermission: 'employees:read' },
  { label: 'Sites', href: '/sites', icon: Building2, requiredPermission: 'sites:read' },
  { label: 'Batches', href: '/batches', icon: Egg, requiredPermission: 'batches:read' },
  { label: 'Sales', href: '/sales', icon: ShoppingCart, requiredPermission: 'sales:read' },
  { label: 'Reports', href: '/reports', icon: BarChart3, requiredPermission: 'reports:read' },
  { label: 'Feed', href: '/feed', icon: Wheat, requiredPermission: 'feed_inventory:read' },
  { label: 'Users', href: '/users', icon: UserPlus, requiredPermission: 'users:create' },
  { label: 'Settings', href: '/settings', icon: Settings, requiredPermission: 'system:read' },
];
