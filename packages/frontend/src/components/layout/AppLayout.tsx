import { Link, Outlet, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { Check, ChevronDown, LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import {
  adminNavigationItems,
  canAccessItem,
  filterVisibleMainNavigation,
  isHrefActive,
  isMainNavigationItemActive,
  mainNavigationItems,
  type MainNavigationItem,
} from '@/config/navigation';
import { cn } from '@/lib/utils';
import { useTheme, type ThemePreference } from '@/lib/theme';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import OfflineBanner from '@/components/layout/OfflineBanner';
import InstallPrompt from '@/components/layout/InstallPrompt';
import MobileBottomNav from '@/components/layout/MobileBottomNav';

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'Match device', icon: Monitor },
];

const pillClass = (active: boolean) =>
  cn(
    'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[15px] font-semibold transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
  );

export default function AppLayout() {
  const { currentUser, logout, hasPermission } = useAuthStore();
  const location = useLocation();
  const { preference, setPreference } = useTheme();

  const visibleMainItems = useMemo(
    () => filterVisibleMainNavigation(mainNavigationItems, hasPermission),
    [hasPermission],
  );
  const visibleAdminItems = useMemo(
    () => adminNavigationItems.filter((item) => canAccessItem(item, hasPermission)),
    [hasPermission],
  );

  const roleName = currentUser?.userRole ? currentUser.userRole.replace(/_/g, ' ') : '';
  const initials = (currentUser?.fullName || 'U')
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const isDark = preference === 'dark'
    || (preference === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <div className="min-h-screen bg-transparent">
      <InstallPrompt />
      <OfflineBanner />
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-md safe-area-top">
        <div className="app-shell-padding mx-auto max-w-[88rem]">
          <div className="flex h-16 items-center gap-4 lg:gap-6">
            <Link to="/dashboard" className="shrink-0 text-xl font-extrabold tracking-tight text-primary">
              farmflow
            </Link>

            <nav aria-label="Main" className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto scrollbar-none md:flex">
              {visibleMainItems.map((item) => (
                <TopNavItem key={item.key} item={item} pathname={location.pathname} />
              ))}
            </nav>

            <div className="ml-auto flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-11 rounded-full"
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                onClick={() => setPreference(isDark ? 'light' : 'dark')}
              >
                {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-11 items-center gap-2 rounded-full pl-1 pr-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Account menu"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">
                      {initials}
                    </span>
                    <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 rounded-2xl p-1.5">
                  <DropdownMenuLabel className="px-3 py-2">
                    <p className="text-sm font-bold">{currentUser?.fullName}</p>
                    <p className="text-xs capitalize text-muted-foreground">{roleName}</p>
                  </DropdownMenuLabel>
                  {visibleAdminItems.length > 0 ? (
                    <>
                      <DropdownMenuSeparator />
                      {visibleAdminItems.map((item) => (
                        <DropdownMenuItem key={item.key} asChild className="rounded-xl">
                          <Link to={item.href}>
                            <item.icon className="mr-2 h-4 w-4" />
                            {item.label}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="px-3 text-xs font-medium text-muted-foreground">Appearance</DropdownMenuLabel>
                  {THEME_OPTIONS.map((option) => (
                    <DropdownMenuItem key={option.value} onClick={() => setPreference(option.value)} className="rounded-xl">
                      <option.icon className="mr-2 h-4 w-4" />
                      <span className="flex-1">{option.label}</span>
                      {preference === option.value ? <Check className="h-4 w-4 text-primary" /> : null}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => logout()} className="rounded-xl text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="app-shell-padding mx-auto max-w-[88rem] pb-[calc(6rem+env(safe-area-inset-bottom,0px))] pt-5 sm:pt-7 md:pb-12">
        <Outlet />
      </main>

      <MobileBottomNav />
    </div>
  );
}

function TopNavItem({ item, pathname }: { item: MainNavigationItem; pathname: string }) {
  const active = isMainNavigationItemActive(pathname, item);

  if (item.type === 'link') {
    return (
      <Link to={item.href} aria-current={active ? 'page' : undefined} className={pillClass(active)}>
        {item.label}
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={pillClass(active)}>
          {item.label}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 rounded-2xl p-1.5">
        {item.children.map((child) => {
          const childActive = isHrefActive(pathname, child.href);
          return (
            <DropdownMenuItem key={child.key} asChild className={cn('rounded-xl py-2.5', childActive && 'bg-secondary text-secondary-foreground')}>
              <Link to={child.href} aria-current={childActive ? 'page' : undefined}>
                <child.icon className="mr-2 h-4 w-4" />
                {child.label}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
