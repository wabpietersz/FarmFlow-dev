/**
 * Mobile bottom navigation bar.
 * Shows the 5 most important nav items as bottom tabs on mobile devices.
 * Hidden on desktop (md breakpoint and above).
 */
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Egg,
  ShoppingCart,
  BarChart3,
  Menu,
  type LucideIcon,
} from 'lucide-react';

interface BottomNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  requiredPermission?: string;
}

const bottomNavItems: BottomNavItem[] = [
  { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Batches', href: '/batches', icon: Egg, requiredPermission: 'batches:read' },
  { label: 'Sales', href: '/sales', icon: ShoppingCart, requiredPermission: 'sales:read' },
  { label: 'Reports', href: '/reports', icon: BarChart3, requiredPermission: 'reports:read' },
];

interface MobileBottomNavProps {
  onMoreClick: () => void;
}

export default function MobileBottomNav({ onMoreClick }: MobileBottomNavProps) {
  const { hasPermission } = useAuthStore();
  const location = useLocation();

  const visibleItems = bottomNavItems.filter(
    (item) => !item.requiredPermission || hasPermission(item.requiredPermission),
  );

  const isActive = (href: string) => {
    if (href === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(href);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-w-0 transition-colors active:bg-muted',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium truncate">{item.label}</span>
            </Link>
          );
        })}
        {/* More button to open sidebar sheet */}
        <button
          onClick={onMoreClick}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-w-0 text-muted-foreground transition-colors active:bg-muted"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </div>
    </nav>
  );
}
