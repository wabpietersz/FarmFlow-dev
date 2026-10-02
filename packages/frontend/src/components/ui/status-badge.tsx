import { Badge } from '@/components/ui/badge';

export type StatusTone = 'success' | 'warning' | 'info' | 'danger' | 'neutral' | 'strong';

/** One meaning per colour, app-wide. Add new statuses here rather than colouring them on a page. */
const STATUS_TONES: Record<string, StatusTone> = {
  // good / done
  active: 'success', growing: 'success', completed: 'success', paid: 'success', present: 'success',
  approved: 'success', cleared: 'success', received: 'success', matched: 'success', repaid: 'success',
  released: 'success', ok: 'success', passed: 'success', done: 'success', occupied: 'success', converted: 'success',
  // needs attention soon
  pending: 'warning', pending_approval: 'warning', ready_for_sale: 'warning', partially_paid: 'warning',
  partially_received: 'warning', on_leave: 'warning', in_progress: 'warning', due: 'warning', low: 'warning',
  maintenance: 'warning', cleaning: 'warning',
  // in motion, nothing to do yet
  placement: 'info', reviewed: 'info', submitted: 'info', planned: 'info', half_day: 'info',
  scheduled: 'info', open: 'info', booked: 'info',
  // wrong / stopped
  unpaid: 'danger', overdue: 'danger', bounced: 'danger', cancelled: 'danger', rejected: 'danger',
  absent: 'danger', culled: 'danger', terminated: 'danger', failed: 'danger', expired: 'danger',
  // finished for good
  closed: 'strong',
  // quiet
  draft: 'neutral', inactive: 'neutral', sold: 'neutral', archived: 'neutral', empty: 'neutral',
};

const TONE_VARIANT = {
  success: 'success',
  warning: 'warning',
  info: 'info',
  danger: 'danger',
  neutral: 'neutral',
  strong: 'strong',
} as const;

interface StatusBadgeProps {
  status: string | null | undefined;
  /** Text to show instead of the status itself */
  label?: string;
  /** Force a tone when a module uses a status differently */
  tone?: StatusTone;
  className?: string;
}

/** The status pill used in every table and page header. */
export function StatusBadge({ status, label, tone, className }: StatusBadgeProps) {
  const key = (status ?? '').toLowerCase();
  const text = label ?? (key ? key.replace(/_/g, ' ') : '--');
  return (
    <Badge variant={TONE_VARIANT[tone ?? STATUS_TONES[key] ?? 'neutral']} className={className}>
      <span className="first-letter:uppercase">{text}</span>
    </Badge>
  );
}
