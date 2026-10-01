import { Bell, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useMarkNotificationsRead, useNotifications, type AppNotification } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

const TONE_DOT: Record<AppNotification['tone'], string> = { info: 'bg-info', warning: 'bg-warning', danger: 'bg-danger' };

function timeAgo(value: string) {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(value).toLocaleDateString();
}

/** Top-bar bell: vaccinations due, stock, cheques, approvals and late payers. */
export function NotificationBell() {
  const { data } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const navigate = useNavigate();
  const items = data?.data?.items ?? [];
  const unread = data?.data?.unread ?? 0;

  const open = (n: AppNotification) => {
    if (!n.isRead) markRead.mutate(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-11 rounded-full" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
          <Bell className="h-5 w-5" />
          {unread > 0 ? (
            <span className="absolute right-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white" aria-hidden="true">
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl p-1.5">
        <div className="flex items-center justify-between px-3 py-2">
          <DropdownMenuLabel className="p-0 text-base">Notifications</DropdownMenuLabel>
          {unread > 0 ? (
            <button type="button" onClick={() => markRead.mutate(undefined)} className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-[60vh] overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nothing new. You’ll hear about vaccinations due, stock, cheques and approvals here.</p>
          ) : items.map((n) => (
            <DropdownMenuItem key={n.id} onClick={() => open(n)} className={cn('flex items-start gap-3 rounded-xl px-3 py-2.5', !n.isRead && 'bg-muted/50')}>
              <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.isRead ? 'bg-transparent' : TONE_DOT[n.tone])} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className={cn('block text-sm', !n.isRead && 'font-semibold')}>{n.title ?? n.message}</span>
                {n.title ? <span className="block truncate text-xs text-muted-foreground">{n.message}</span> : null}
                <span className="block text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
              </span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
