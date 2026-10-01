import { cn } from '@/lib/utils';

const LABELS: Record<string, { label: string; tone: string }> = {
  matched: { label: 'Matches goods', tone: 'bg-success-soft text-success' },
  over_billed: { label: 'Over-billed', tone: 'bg-danger-soft text-danger' },
  under_billed: { label: 'Under goods', tone: 'bg-warning-soft text-warning' },
  no_po: { label: 'No order', tone: 'bg-muted text-muted-foreground' },
};

/** Shows how an invoice compares with what was actually received on its order. */
export function InvoiceMatchBadge({ invoice }: { invoice: { matchStatus?: string | null; matchVariance?: number | string | null; receivedValue?: number | string | null } }) {
  const info = invoice.matchStatus ? LABELS[invoice.matchStatus] : null;
  if (!info) return <span className="text-xs text-muted-foreground">--</span>;
  const variance = Number(invoice.matchVariance ?? 0);
  const title = invoice.matchStatus === 'no_po'
    ? 'Not linked to a purchase order'
    : `Goods received: Rs ${Number(invoice.receivedValue ?? 0).toLocaleString()} · Difference: Rs ${variance.toLocaleString()}`;
  return (
    <span title={title} className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', info.tone)}>
      {info.label}
      {invoice.matchStatus === 'over_billed' || invoice.matchStatus === 'under_billed' ? ` · Rs ${Math.abs(variance).toLocaleString()}` : ''}
    </span>
  );
}
