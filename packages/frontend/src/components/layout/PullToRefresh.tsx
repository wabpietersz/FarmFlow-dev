/**
 * Pull-to-refresh container component for mobile.
 * Wraps page content and shows a loading spinner when pulled down.
 */
import { type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { cn } from '@/lib/utils';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

export default function PullToRefresh({
  onRefresh,
  children,
  className,
  disabled = false,
}: PullToRefreshProps) {
  const { containerRef, isRefreshing, pullDistance, progress } = usePullToRefresh({
    onRefresh,
    disabled,
  });

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-auto', className)}
    >
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-all duration-200"
        style={{
          height: pullDistance > 0 || isRefreshing ? Math.max(pullDistance, isRefreshing ? 48 : 0) : 0,
        }}
      >
        <RefreshCw
          className={cn(
            'h-5 w-5 text-primary transition-all',
            isRefreshing && 'animate-spin',
          )}
          style={{
            opacity: isRefreshing ? 1 : progress,
            transform: `rotate(${progress * 360}deg)`,
          }}
        />
      </div>
      {children}
    </div>
  );
}
