import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutGrid, X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import {
  adminNavigationItems,
  canAccessItem,
  filterVisibleMainNavigation,
  isHrefActive,
  isMainNavigationItemActive,
  mainNavigationItems,
  mobilePrimaryKeys,
  type NavItem,
} from '@/config/navigation';
import { cn } from '@/lib/utils';

type Sheet = { title: string; links: NavItem[] } | null;

/** Phone navigation: four main places in a bottom bar; everything else in a "More" sheet. */
export default function MobileBottomNav() {
  const { hasPermission } = useAuthStore();
  const location = useLocation();
  const [sheet, setSheet] = useState<Sheet>(null);

  const visible = useMemo(() => filterVisibleMainNavigation(mainNavigationItems, hasPermission), [hasPermission]);
  const primary = visible.filter((item) => mobilePrimaryKeys.includes(item.key));
  const moreLinks = useMemo(() => {
    const rest = visible.filter((item) => !mobilePrimaryKeys.includes(item.key));
    const flattened = rest.flatMap((item) => (item.type === 'group' ? item.children : [item]));
    return [...flattened, ...adminNavigationItems.filter((item) => canAccessItem(item, hasPermission))];
  }, [visible, hasPermission]);
  const moreActive = moreLinks.some((link) => isHrefActive(location.pathname, link.href));

  useEffect(() => {
    setSheet(null);
  }, [location.pathname]);

  const tabClass = (active: boolean) =>
    cn(
      'flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-1.5 transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      active ? 'text-primary' : 'text-muted-foreground',
    );

  return (
    <>
      {sheet ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px]" onClick={() => setSheet(null)} />
          <div
            role="dialog"
            aria-label={sheet.title}
            className="absolute inset-x-2 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] rounded-3xl border border-border bg-popover p-3 shadow-xl"
          >
            <div className="flex items-center justify-between px-2 pb-2">
              <p className="text-base font-bold">{sheet.title}</p>
              <button type="button" aria-label="Close" onClick={() => setSheet(null)} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {sheet.links.map((link) => {
                const active = isHrefActive(location.pathname, link.href);
                return (
                  <Link
                    key={link.key}
                    to={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-14 items-center gap-3 rounded-2xl px-4 text-sm font-semibold transition-colors',
                      active ? 'bg-foreground text-background' : 'bg-muted text-foreground hover:bg-secondary',
                    )}
                  >
                    <link.icon className="h-5 w-5 shrink-0" />
                    <span className="truncate">{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 px-2 pt-1.5 backdrop-blur-md safe-area-bottom md:hidden"
      >
        <div className="flex items-stretch gap-1 pb-1.5">
          {primary.map((item) => {
            const active = isMainNavigationItemActive(location.pathname, item);
            const Icon = item.icon;
            if (item.type === 'group') {
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-expanded={sheet?.title === item.label}
                  onClick={() => setSheet((current) => (current?.title === item.label ? null : { title: item.label, links: item.children }))}
                  className={tabClass(active)}
                >
                  <Icon className="h-[22px] w-[22px]" />
                  <span className="text-[11px] font-semibold leading-none">{item.label}</span>
                </button>
              );
            }
            return (
              <Link key={item.key} to={item.href} aria-current={active ? 'page' : undefined} className={tabClass(active)}>
                <Icon className="h-[22px] w-[22px]" />
                <span className="text-[11px] font-semibold leading-none">{item.label}</span>
              </Link>
            );
          })}
          {moreLinks.length > 0 ? (
            <button
              type="button"
              aria-expanded={sheet?.title === 'More'}
              onClick={() => setSheet((current) => (current?.title === 'More' ? null : { title: 'More', links: moreLinks }))}
              className={tabClass(moreActive)}
            >
              <LayoutGrid className="h-[22px] w-[22px]" />
              <span className="text-[11px] font-semibold leading-none">More</span>
            </button>
          ) : null}
        </div>
      </nav>
    </>
  );
}
