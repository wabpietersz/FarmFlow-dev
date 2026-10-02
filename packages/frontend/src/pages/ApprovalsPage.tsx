import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ClipboardCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/store/authStore';
import { useApprovalInbox, useApprovalRequests, useDecideApproval, type ApprovalRequest } from '@/hooks/useApprovals';
import { getApiErrorMessage } from '@/lib/api';
import { cn, formatCurrency } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';

const KIND_LABEL: Record<ApprovalRequest['entityType'], string> = { purchase_order: 'Purchase order', money_out: 'Money out' };

/** Everything waiting for a decision: over-limit requests here, other reviews linked to their page. */
export default function ApprovalsPage() {
  const { currentUser } = useAuthStore();
  const inbox = useApprovalInbox();
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const requests = useApprovalRequests(filter);
  const decide = useDecideApproval();
  const canDecide = inbox.data?.data?.canDecide ?? false;
  const others = (inbox.data?.data?.items ?? []).filter((item) => item.key !== 'over-limit');

  const act = async (request: ApprovalRequest, decision: 'approved' | 'rejected') => {
    const note = decision === 'rejected' ? window.prompt(`Why not approve "${request.summary}"?`) : null;
    if (decision === 'rejected' && !note?.trim()) return;
    try {
      await decide.mutateAsync({ id: request.id, decision, note });
      toast.success(decision === 'approved' ? 'Approved' : 'Rejected and sent back');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not record the decision'));
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Approvals</h1>
        <p className="mt-1 text-muted-foreground">Spending over your limits, and everything else waiting for a decision.</p>
      </header>

      <section className="space-y-3" aria-labelledby="over-limit">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="over-limit" className="text-lg font-bold">Over the approval limit</h2>
          <div className="flex gap-1.5" role="group" aria-label="Show">
            {(['pending', 'approved', 'rejected'] as const).map((value) => (
              <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}
                className={cn('min-h-9 rounded-full px-3.5 text-sm font-semibold capitalize', filter === value ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground')}>
                {value === 'pending' ? 'Waiting' : value}
              </button>
            ))}
          </div>
        </div>
        {requests.isLoading ? <Skeleton className="h-28 rounded-3xl" /> : (requests.data?.data ?? []).length === 0 ? (
          <div className="rounded-3xl border border-dashed p-8 text-center">
            <ClipboardCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{filter === 'pending' ? 'Nothing waiting. Limits are set in Settings → Approvals.' : `No ${filter} requests yet.`}</p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {(requests.data?.data ?? []).map((request) => {
              const own = request.requestedBy === currentUser?.id;
              return (
                <div key={request.id} className="space-y-3 rounded-3xl border border-border p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{KIND_LABEL[request.entityType]}</p>
                      <p className="font-bold">{request.summary}</p>
                      <p className="text-sm text-muted-foreground">Asked by {request.requestedByName} · {new Date(request.createdAt).toLocaleDateString()}</p>
                    </div>
                    <p className="shrink-0 text-xl font-extrabold tabular-nums">{formatCurrency(Number(request.amount))}</p>
                  </div>
                  {request.decisionNote ? <p className="text-sm"><span className="font-semibold">Note:</span> {request.decisionNote}</p> : null}
                  {request.status === 'pending' ? (
                    canDecide && !own ? (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => act(request, 'approved')} disabled={decide.isPending}><Check className="h-4 w-4" /> Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => act(request, 'rejected')} disabled={decide.isPending}><X className="h-4 w-4" /> Reject</Button>
                      </div>
                    ) : <p className="text-sm text-muted-foreground">{own ? 'Waiting for someone else to approve.' : 'Waiting for a manager.'}</p>
                  ) : (
                    <StatusBadge status={request.status} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="other-reviews">
        <h2 id="other-reviews" className="text-lg font-bold">Other reviews</h2>
        {inbox.isLoading ? <Skeleton className="h-28 rounded-3xl" /> : others.length === 0 ? (
          <p className="rounded-3xl border border-dashed p-6 text-center text-sm text-muted-foreground">All caught up.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((item) => (
              <Link key={item.key} to={item.href} className="group flex flex-col gap-1 rounded-3xl bg-panel p-5 transition-colors hover:bg-panel/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="flex items-center justify-between font-bold">{item.count} · {item.title}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
                <span className="text-sm text-muted-foreground">{item.detail}</span>
                {item.amount ? <span className="text-sm font-semibold tabular-nums">{formatCurrency(item.amount)}</span> : null}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
