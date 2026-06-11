import { Link, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import {
  filterVisibleMainNavigation,
  isHrefActive,
  isMainNavigationItemActive,
  mainNavigationItems,
  type MainNavigationItem,
  type NavItem,
} from '@/config/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, ChevronRight, LogOut, User } from 'lucide-react';
import OfflineBanner from '@/components/layout/OfflineBanner';
import InstallPrompt from '@/components/layout/InstallPrompt';
import MobileBottomNav from '@/components/layout/MobileBottomNav';

export default function AppLayout() {
  const { currentUser, logout, hasPermission } = useAuthStore();
  const location = useLocation();

  const visibleMainItems = useMemo(
    () => filterVisibleMainNavigation(mainNavigationItems, hasPermission),
    [hasPermission],
  );
  const [expandedGroupState, setExpandedGroupState] = useState<Record<string, boolean>>({});

  const groupKeys = useMemo(
    () => visibleMainItems
      .filter((item): item is Extract<MainNavigationItem, { type: 'group' }> => item.type === 'group')
      .map((item) => item.key),
    [visibleMainItems],
  );

  useEffect(() => {
    setExpandedGroupState((previous) => {
      const next: Record<string, boolean> = {};
      groupKeys.forEach((key) => {
        next[key] = previous[key] ?? true;
      });
      return next;
    });
  }, [groupKeys]);

  useEffect(() => {
    const activeGroup = visibleMainItems.find(
      (item): item is Extract<MainNavigationItem, { type: 'group' }> =>
        item.type === 'group' && isMainNavigationItemActive(location.pathname, item),
    );
    if (!activeGroup) return;
    setExpandedGroupState((previous) =>
      previous[activeGroup.key] === false
        ? { ...previous, [activeGroup.key]: true }
        : previous,
    );
  }, [location.pathname, visibleMainItems]);

  const roleName = currentUser?.userRole
    ? currentUser.userRole.replace(/_/g, ' ')
    : '';

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen bg-transparent">
      <InstallPrompt />
      <OfflineBanner />
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/95 backdrop-blur safe-area-top">
        <div className="app-shell-padding">
          <div className="flex h-14 items-center justify-between">
            <Link to="/dashboard" className="text-lg font-bold text-foreground">
              FarmFlow
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline text-sm">
                    {currentUser?.fullName || 'User'}
                  </span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="text-sm font-medium">{currentUser?.fullName}</p>
                  <p className="text-xs text-muted-foreground capitalize">{roleName}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex min-w-0">
        <aside className="hidden min-h-[calc(100vh-3.5rem)] w-64 border-r border-border/80 bg-card/80 md:flex md:flex-col">
          <nav className="flex-1 space-y-1 p-4" aria-label="Main Navigator">
            {visibleMainItems.map((item) => (
              <MainNavItemView
                key={item.key}
                item={item}
                pathname={location.pathname}
                expanded={item.type === 'group' ? expandedGroupState[item.key] !== false : undefined}
                onToggleGroup={(groupKey) => {
                  setExpandedGroupState((previous) => ({
                    ...previous,
                    [groupKey]: previous[groupKey] === false,
                  }));
                }}
              />
            ))}
          </nav>
          <div className="border-t border-border/80 px-4 pb-4 pt-3">
            <p className="text-xs text-muted-foreground truncate">{currentUser?.fullName}</p>
            <Badge variant="secondary" className="mt-1 text-xs capitalize">
              {roleName}
            </Badge>
          </div>
        </aside>

        <main className="min-w-0 w-full flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] pt-4 sm:px-6 sm:pt-6 md:pb-10 lg:px-8 lg:pt-8">
          <div className="app-content-width">
            <Outlet />
          </div>
        </main>
      </div>

      <MobileBottomNav />
    </div>
  );
}

function MainNavItemView({
  item,
  pathname,
  expanded,
  onToggleGroup,
}: {
  item: MainNavigationItem;
  pathname: string;
  expanded?: boolean;
  onToggleGroup?: (groupKey: string) => void;
}) {
  if (item.type === 'group') {
    const Icon = item.icon;
    const active = isMainNavigationItemActive(pathname, item);
    const isExpanded = expanded ?? true;
    return (
      <div className="space-y-1">
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => onToggleGroup?.(item.key)}
          className={cn(
            'flex w-full items-center gap-3 min-h-11 px-3 py-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            active ? 'bg-muted text-foreground' : 'text-muted-foreground',
          )}
        >
          <Icon className="h-4 w-4" />
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronRight className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-90')} />
        </button>
        {isExpanded && (
          <div className="ml-6 space-y-1">
            {item.children.map((child) => (
              <MainNavLink
                key={child.key}
                item={child}
                active={isHrefActive(pathname, child.href)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return <MainNavLink item={item} active={isHrefActive(pathname, item.href)} />;
}

function MainNavLink({
  item,
  active,
}: {
  item: NavItem;
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 min-h-11 px-3 py-2 rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        active
          ? 'bg-primary text-primary-foreground font-medium'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted',
      )}
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}
