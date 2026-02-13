import { useState, useEffect } from 'react';
import { WifiOff, Wifi, CloudOff, RefreshCw, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useOfflineMutationQueue, useOnlineStatus } from '@/hooks/useOffline';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const { mutations, count, retry, discard, hasFailed } = useOfflineMutationQueue();
  const [showQueue, setShowQueue] = useState(false);
  const [justCameOnline, setJustCameOnline] = useState(false);

  // Show "back online" notification briefly
  useEffect(() => {
    if (isOnline) {
      setJustCameOnline(true);
      const timer = setTimeout(() => setJustCameOnline(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  // Hide queue panel when all mutations are synced
  useEffect(() => {
    if (count === 0) {
      setShowQueue(false);
    }
  }, [count]);

  const showBanner = !isOnline || justCameOnline || count > 0;
  if (!showBanner) return null;

  return (
    <div className="relative z-50">
      {/* Main banner */}
      <div
        className={cn(
          'px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 transition-colors',
          !isOnline
            ? 'bg-yellow-500 text-yellow-950'
            : justCameOnline
              ? 'bg-green-500 text-white'
              : hasFailed
                ? 'bg-red-500 text-white'
                : 'bg-blue-500 text-white',
        )}
      >
        {!isOnline ? (
          <>
            <WifiOff className="h-4 w-4" />
            <span>You are offline. Changes will be saved and synced later.</span>
          </>
        ) : justCameOnline && count === 0 ? (
          <>
            <Wifi className="h-4 w-4" />
            <span>Back online!</span>
          </>
        ) : count > 0 ? (
          <>
            <CloudOff className="h-4 w-4" />
            <span>
              {count} offline change{count > 1 ? 's' : ''} pending
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-current hover:text-current hover:bg-white/20"
              onClick={() => setShowQueue(!showQueue)}
            >
              {showQueue ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          </>
        ) : null}
      </div>

      {/* Queue detail panel */}
      {showQueue && count > 0 && (
        <div className="absolute top-full left-0 right-0 bg-card border-b border-border shadow-lg max-h-60 overflow-y-auto">
          <div className="divide-y divide-border">
            {mutations.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="truncate text-foreground">{m.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.status === 'failed' && m.error
                      ? `Failed: ${m.error}`
                      : m.status === 'syncing'
                        ? 'Syncing...'
                        : 'Pending'}
                  </p>
                </div>
                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                  {m.status === 'failed' && isOnline && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => retry(m.id)}
                      title="Retry"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive"
                    onClick={() => discard(m.id)}
                    title="Discard"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
