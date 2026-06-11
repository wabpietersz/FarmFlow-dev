import { useState, useEffect } from 'react';
import { WifiOff, Wifi, CloudOff, RefreshCw, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useOfflineMutationQueue, useOnlineStatus } from '@/hooks/useOffline';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

  const state = !isOnline
    ? {
        title: 'Offline mode',
        description: 'Changes are queued locally and will sync when connectivity returns.',
        icon: WifiOff,
        badge: 'Offline',
        badgeVariant: 'destructive' as const,
        iconClass: 'border-amber-200 bg-amber-50 text-amber-700',
      }
    : hasFailed
      ? {
          title: 'Sync attention needed',
          description: `${count} queued change${count > 1 ? 's' : ''} need review before they can finish syncing.`,
          icon: CloudOff,
          badge: 'Action needed',
          badgeVariant: 'destructive' as const,
          iconClass: 'border-red-200 bg-red-50 text-red-700',
        }
      : count > 0
        ? {
            title: 'Queued sync',
            description: `${count} offline change${count > 1 ? 's' : ''} waiting to sync.`,
            icon: CloudOff,
            badge: 'Pending',
            badgeVariant: 'secondary' as const,
            iconClass: 'border-border bg-muted text-foreground',
          }
        : {
            title: 'Back online',
            description: 'Live connectivity restored.',
            icon: Wifi,
            badge: 'Connected',
            badgeVariant: 'outline' as const,
            iconClass: 'border-border bg-muted text-foreground',
          };
  const StateIcon = state.icon;

  return (
    <div className="relative z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="app-shell-padding py-2.5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className={cn('mt-0.5 flex size-8 items-center justify-center rounded-full border', state.iconClass)}>
              <StateIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-foreground">{state.title}</p>
                <Badge variant={state.badgeVariant}>{state.badge}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{state.description}</p>
            </div>
          </div>

          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 justify-between sm:justify-center"
              onClick={() => setShowQueue(!showQueue)}
            >
              {showQueue ? 'Hide queue' : 'Review queue'}
              {showQueue ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>
      </div>

      {showQueue && count > 0 && (
        <div className="border-t border-border bg-muted/20">
          <div className="app-shell-padding py-3">
            <div className="max-h-60 overflow-y-auto rounded-xl border border-border bg-card">
              <div className="divide-y divide-border">
                {mutations.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{m.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.status === 'failed' && m.error
                          ? `Failed: ${m.error}`
                          : m.status === 'syncing'
                            ? 'Syncing now'
                            : 'Waiting to sync'}
                      </p>
                    </div>
                    <div className="ml-2 flex flex-shrink-0 items-center gap-1">
                      {m.status === 'failed' && isOnline && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => retry(m.id)}
                          title="Retry"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => discard(m.id)}
                        title="Discard"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
