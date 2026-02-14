import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import {
  filterVisibleMainNavigation,
  isHrefActive,
  isMainNavigationItemActive,
  mainNavigationItems,
} from '@/config/navigation';
import { cn } from '@/lib/utils';

export default function MobileBottomNav() {
  const { hasPermission } = useAuthStore();
  const location = useLocation();
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);

  const visibleMainItems = useMemo(
    () => filterVisibleMainNavigation(mainNavigationItems, hasPermission),
    [hasPermission],
  );

  const effectiveExpandedGroupKey =
    expandedGroupKey &&
    visibleMainItems.some(
      (item) => item.type === 'group' && item.key === expandedGroupKey,
    )
      ? expandedGroupKey
      : null;

  const expandedGroup = visibleMainItems.find(
    (item) => item.type === 'group' && item.key === effectiveExpandedGroupKey,
  );

  const expandedIndex = effectiveExpandedGroupKey
    ? visibleMainItems.findIndex((item) => item.key === effectiveExpandedGroupKey)
    : -1;

  const panelOrigin =
    expandedIndex >= 0
      ? `${((expandedIndex + 0.5) / Math.max(visibleMainItems.length, 1)) * 100}% bottom`
      : '50% bottom';

  return (
    <>
      {expandedGroup && (
        <button
          type="button"
          aria-label="Close expanded navigation"
          className="md:hidden fixed inset-0 z-40 bg-transparent"
          onClick={() => setExpandedGroupKey(null)}
        />
      )}

      <div
        className={cn(
          'md:hidden fixed left-2 right-2 z-50 bottom-16 rounded-xl border border-border bg-card shadow-lg p-2 transition-all duration-200 ease-out',
          expandedGroup
            ? 'opacity-100 translate-y-0 scale-y-100 pointer-events-auto'
            : 'opacity-0 translate-y-2 scale-y-95 pointer-events-none',
        )}
        style={{ transformOrigin: panelOrigin }}
        aria-hidden={!expandedGroup}
      >
        {expandedGroup?.type === 'group' && (
          <div className="grid grid-cols-1 gap-1">
            {expandedGroup.children.map((child) => {
              const Icon = child.icon;
              const active = isHrefActive(location.pathname, child.href);
              return (
                <Link
                  key={child.key}
                  to={child.href}
                  onClick={() => setExpandedGroupKey(null)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 min-h-11 px-3 py-2 rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    active
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {child.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-bottom"
        aria-label="Main Navigator"
      >
        <div className="flex items-center justify-around h-14">
          {visibleMainItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.type === 'group'
                ? item.key === effectiveExpandedGroupKey || isMainNavigationItemActive(location.pathname, item)
                : isHrefActive(location.pathname, item.href);

            if (item.type === 'group') {
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-expanded={item.key === effectiveExpandedGroupKey}
                  onClick={() =>
                    setExpandedGroupKey((current) =>
                      current === item.key ? null : item.key,
                    )
                  }
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-w-0 min-h-11 transition-colors active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    active ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[9px] leading-none font-medium truncate">{item.label}</span>
                </button>
              );
            }

            return (
              <Link
                key={item.key}
                to={item.href}
                onClick={() => setExpandedGroupKey(null)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-w-0 min-h-11 transition-colors active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[9px] leading-none font-medium truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
