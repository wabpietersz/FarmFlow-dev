import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { navigationItems, type NavItem } from '@/config/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Menu, ChevronDown, LogOut, User } from 'lucide-react';

export default function AppLayout() {
  const { currentUser, logout, hasPermission } = useAuthStore();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const filteredNavItems = navigationItems.filter(
    (item) => !item.requiredPermission || hasPermission(item.requiredPermission),
  );

  const isActive = (item: NavItem) => {
    if (item.href === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(item.href);
  };

  const handleLogout = async () => {
    await logout();
  };

  const roleName = currentUser?.userRole
    ? currentUser.userRole.replace(/_/g, ' ')
    : '';

  return (
    <div className="min-h-screen bg-muted">
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0">
                  <SheetHeader className="p-4 pb-0">
                    <SheetTitle className="text-lg font-bold">FarmFlow</SheetTitle>
                  </SheetHeader>
                  <Separator className="my-2" />
                  <nav className="p-4 space-y-1">
                    {filteredNavItems.map((item) => (
                      <NavLink
                        key={item.href}
                        item={item}
                        active={isActive(item)}
                        onClick={() => setMobileOpen(false)}
                      />
                    ))}
                  </nav>
                  <div className="absolute bottom-4 left-4 right-4">
                    <Separator className="mb-3" />
                    <p className="text-xs text-muted-foreground truncate">
                      {currentUser?.fullName}
                    </p>
                    <Badge variant="secondary" className="mt-1 text-xs capitalize">
                      {roleName}
                    </Badge>
                  </div>
                </SheetContent>
              </Sheet>
              <Link to="/dashboard" className="text-lg font-bold text-foreground">
                FarmFlow
              </Link>
            </div>

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
              <DropdownMenuContent align="end" className="w-48">
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

      <div className="flex">
        <aside className="hidden md:flex md:flex-col w-56 bg-card border-r border-border min-h-[calc(100vh-3.5rem)]">
          <nav className="p-4 space-y-1 flex-1">
            {filteredNavItems.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item)} />
            ))}
          </nav>
          <div className="p-4 border-t border-border">
            <p className="text-xs text-muted-foreground truncate">
              {currentUser?.fullName}
            </p>
            <Badge variant="secondary" className="mt-1 text-xs capitalize">
              {roleName}
            </Badge>
          </div>
        </aside>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavLink({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
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
