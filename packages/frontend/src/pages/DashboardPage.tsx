import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useHomeDashboard, type HomeBatchCard } from '@/hooks/useDashboard';
import { getApiErrorMessage } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

const SPEND_COLORS = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5'];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function compactRs(value: number) {
  if (Math.abs(value) >= 100_000) return `Rs ${(value / 100_000).toFixed(1)} L`;
  return formatCurrency(value);
}

function changeNote(current: number, previous: number, label: string) {
  if (previous <= 0) return label;
  const change = ((current - previous) / previous) * 100;
  return `${change >= 0 ? '+' : ''}${change.toFixed(0)}% vs last month`;
}

export default function DashboardPage() {
  const { currentUser } = useAuthStore();
  const { data, isLoading, error } = useHomeDashboard();
  const home = data?.data;
  const firstName = currentUser?.fullName?.split(/\s+/)[0] ?? '';
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const monthName = new Date().toLocaleDateString(undefined, { month: 'long' });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72 rounded-full" />
        <Skeleton className="h-48 rounded-3xl" />
        <div className="grid gap-5 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (error || !home) {
    return <p className="rounded-2xl bg-danger-soft p-4 text-sm font-medium text-danger">{getApiErrorMessage(error, 'Could not load your home screen.')}</p>;
  }

  const money = home.money;
  const spendTotal = money?.spendByGroup.reduce((sum, row) => sum + row.amount, 0) ?? 0;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-muted-foreground">{today}</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-foreground">
          {greeting()}{firstName ? `, ${firstName}` : ''}
        </h1>
      </header>

      {money ? (
        <section aria-label="Money at a glance" className="grid gap-4 rounded-3xl bg-panel p-5 sm:p-7 lg:grid-cols-[1.3fr_repeat(3,minmax(0,1fr))] lg:items-end">
          <div>
            <p className="text-[15px] font-semibold text-muted-foreground">Cash on hand today</p>
            <p className="mt-1.5 text-4xl font-extrabold tracking-tight text-foreground tabular-nums sm:text-5xl">{formatCurrency(money.cashOnHand)}</p>
            <p className="mt-1 text-sm text-muted-foreground">Across {money.accountCount} account{money.accountCount === 1 ? '' : 's'}</p>
          </div>
          <StatCard label={`Money in · ${monthName}`} value={compactRs(money.moneyInThisMonth)} note={changeNote(money.moneyInThisMonth, money.moneyInLastMonth, 'Nothing last month')} tone={money.moneyInThisMonth >= money.moneyInLastMonth ? 'success' : 'muted'} />
          <StatCard label={`Money out · ${monthName}`} value={compactRs(money.moneyOutThisMonth)} note={money.spendByGroup[0] ? `${money.spendByGroup[0].group} is ${spendTotal > 0 ? Math.round((money.spendByGroup[0].amount / spendTotal) * 100) : 0}%` : 'No spending yet'} tone="muted" />
          <StatCard label="Live birds" value={home.liveBirds == null ? '—' : home.liveBirds.toLocaleString()} note={home.batches ? `${home.batches.length} batch${home.batches.length === 1 ? '' : 'es'} growing` : ''} tone="muted" />
        </section>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,0.9fr)]">
        <section aria-labelledby="live-batches" className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 id="live-batches" className="text-lg font-bold">Growing now</h2>
            <Link to="/batches" className="text-sm font-semibold text-primary hover:underline">All batches</Link>
          </div>
          {home.batches && home.batches.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {home.batches.map((batch) => <BatchCard key={batch.id} batch={batch} />)}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-border p-8 text-center">
              <p className="font-semibold">No batches growing</p>
              <p className="mt-1 text-sm text-muted-foreground">Start a batch when chicks arrive.</p>
              <Button asChild className="mt-4"><Link to="/batches">Go to batches</Link></Button>
            </div>
          )}
        </section>

        <section aria-labelledby="todo" className="h-fit space-y-2.5 rounded-3xl bg-panel-warm p-5">
          <h2 id="todo" className="text-lg font-bold">To do today</h2>
          {home.todos.length === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl bg-card p-4">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <p className="text-sm font-semibold">All caught up</p>
            </div>
          ) : home.todos.map((todo) => (
            <Link
              key={todo.key}
              to={todo.href}
              className="group flex min-h-14 items-center gap-3 rounded-2xl bg-card p-3.5 transition-colors hover:bg-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${todo.tone === 'info' ? 'bg-info' : todo.tone === 'danger' ? 'bg-danger' : 'bg-warning'}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold leading-snug">{todo.title}</span>
                <span className="block truncate text-[13px] text-muted-foreground">{todo.detail}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </section>
      </div>

      {money && money.spendByGroup.length > 0 ? (
        <section aria-labelledby="money-went" className="space-y-4 rounded-3xl border border-border p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="money-went" className="text-lg font-bold">Where the money went · {monthName}</h2>
            <Link to="/treasury?tab=ledger" className="text-sm font-semibold text-primary hover:underline">Open ledger</Link>
          </div>
          <div className="flex h-5 overflow-hidden rounded-full bg-muted" role="img" aria-label="Spending by group this month">
            {money.spendByGroup.map((row, index) => (
              <div key={row.group} className={SPEND_COLORS[index % SPEND_COLORS.length]} style={{ width: `${(row.amount / spendTotal) * 100}%` }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {money.spendByGroup.map((row, index) => (
              <div key={row.group} className="flex items-center gap-2 text-sm">
                <span className={`h-3 w-3 rounded-[4px] ${SPEND_COLORS[index % SPEND_COLORS.length]}`} />
                <span className="font-semibold">{row.group}</span>
                <span className="text-muted-foreground tabular-nums">{compactRs(row.amount)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, note, tone }: { label: string; value: string; note: string; tone: 'success' | 'muted' }) {
  return (
    <div className="rounded-2xl bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      <p className={`mt-0.5 text-[13px] font-semibold ${tone === 'success' ? 'text-success' : 'text-muted-foreground'}`}>{note}</p>
    </div>
  );
}

function BatchCard({ batch }: { batch: HomeBatchCard }) {
  const stats = [
    { label: 'Live birds', value: batch.liveBirds.toLocaleString() },
    { label: 'Mortality', value: `${batch.mortalityPct.toFixed(1)}%`, warn: batch.mortalityPct >= 5 },
    { label: 'Avg weight', value: batch.averageWeightKg == null ? '—' : `${batch.averageWeightKg.toFixed(2)} kg` },
    { label: 'Cost per kg', value: batch.costPerKgLive == null ? '—' : formatCurrency(batch.costPerKgLive) },
  ];
  return (
    <Link
      to={`/batches/${batch.id}`}
      className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{batch.batchCode}</p>
          <p className="truncate text-sm text-muted-foreground">{batch.siteName}</p>
        </div>
        <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-sm font-bold text-secondary-foreground">Day {batch.ageDays}</span>
      </div>
      <div className="grid grid-cols-2 gap-3.5">
        {stats.map((stat) => (
          <div key={stat.label}>
            <p className="text-[13px] text-muted-foreground">{stat.label}</p>
            <p className={`mt-0.5 text-xl font-bold tabular-nums ${stat.warn ? 'text-warning' : ''}`}>{stat.value}</p>
          </div>
        ))}
      </div>
      <p className={`border-t border-border pt-3 text-sm font-semibold ${batch.tone === 'warning' ? 'text-warning' : 'text-success'}`}>{batch.note}</p>
    </Link>
  );
}
