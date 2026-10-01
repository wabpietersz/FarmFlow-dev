import { useMemo, useState } from 'react';
import { Lock, LockOpen, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useBatchPerformance, useCloseBatch, useReopenBatch, type BatchCostLedgerEntry } from '@/hooks/useBatches';
import { getApiErrorMessage } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

const COMPONENTS: Array<{ key: 'chickCost' | 'feedCost' | 'inventoryCost' | 'laborCost' | 'operationalExpenseCost'; label: string; color: string }> = [
  { key: 'chickCost', label: 'Chicks', color: 'bg-chart-1' },
  { key: 'feedCost', label: 'Feed', color: 'bg-chart-4' },
  { key: 'inventoryCost', label: 'Medicine & supplies', color: 'bg-chart-2' },
  { key: 'laborCost', label: 'Labour', color: 'bg-chart-3' },
  { key: 'operationalExpenseCost', label: 'Farm & overheads', color: 'bg-chart-5' },
];

const COMPONENT_LABELS: Record<BatchCostLedgerEntry['componentType'], string> = {
  chicks: 'Chicks',
  feed: 'Feed',
  inventory: 'Medicine & supplies',
  labor: 'Labour',
  operational_expense: 'Farm & overheads',
};

const ALLOCATION_LABELS: Record<BatchCostLedgerEntry['allocationType'], string> = {
  direct: 'This batch',
  site: 'Farm share',
  shared_overhead: 'Admin share',
};

function fmt(value: number | null | undefined, digits = 2, suffix = '') {
  if (value == null) return '—';
  return `${value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}${suffix}`;
}

/** Live (or frozen, once closed) performance, P&L and full cost build-up for one batch. */
export function BatchPerformancePanel({ batchId, canManage }: { batchId: string; canManage: boolean }) {
  const { data, isLoading, error } = useBatchPerformance(batchId);
  const closeBatch = useCloseBatch(batchId);
  const reopenBatch = useReopenBatch(batchId);
  const [showClose, setShowClose] = useState(false);
  const [acceptVariance, setAcceptVariance] = useState(false);
  const [notes, setNotes] = useState('');
  const [showAll, setShowAll] = useState(false);

  const performance = data?.data;
  const ledger = useMemo(() => performance?.costs.ledger ?? [], [performance]);

  if (isLoading) {
    return <Skeleton className="h-96 rounded-xl" />;
  }
  if (error || !performance) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">{getApiErrorMessage(error, 'Could not load batch performance.')}</CardContent>
      </Card>
    );
  }

  const { kpis, costs, closed } = performance;
  const totalCost = costs.totalCost || 0;
  const unaccounted = kpis.birdsPlaced - kpis.deaths - kpis.birdsSold;
  const canClose = canManage && !closed && kpis.birdsSold > 0;

  const handleClose = async () => {
    try {
      await closeBatch.mutateAsync({ notes: notes.trim() || undefined, acceptVariance });
      toast.success('Batch closed. Final figures are frozen.');
      setShowClose(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to close batch'));
    }
  };

  const handleReopen = async () => {
    if (!window.confirm('Reopen this batch? Its frozen close-out figures will be discarded and recalculated live.')) return;
    try {
      await reopenBatch.mutateAsync();
      toast.success('Batch reopened');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to reopen batch'));
    }
  };

  const kpiTiles = [
    { label: 'Birds placed', value: fmt(kpis.birdsPlaced, 0) },
    { label: closed ? 'Birds sold' : 'Live birds', value: fmt(closed ? kpis.birdsSold : kpis.liveBirds, 0) },
    { label: 'Mortality', value: fmt(kpis.mortalityPct, 2, '%') },
    { label: 'FCR', value: fmt(kpis.fcr, 3) },
    { label: 'Avg weight sold', value: kpis.averageWeightKg == null ? '—' : `${fmt(kpis.averageWeightKg, 3)} kg` },
    { label: 'EPEF', value: fmt(kpis.epef, 0) },
    { label: 'Age', value: `${kpis.ageDays} days` },
    { label: 'Feed used', value: `${fmt(kpis.feedKg, 0)} kg` },
  ];

  const pnlTiles = [
    { label: 'Revenue', value: formatCurrency(kpis.revenue) },
    { label: 'Total cost', value: formatCurrency(totalCost) },
    { label: 'Profit', value: formatCurrency(kpis.profit), tone: kpis.profit < 0 ? 'text-danger' : 'text-success' },
    { label: 'Margin', value: fmt(kpis.marginPct, 1, '%') },
    { label: 'Cost per kg', value: kpis.costPerKg == null ? '—' : formatCurrency(kpis.costPerKg) },
    { label: 'Profit per bird', value: kpis.profitPerBird == null ? '—' : formatCurrency(kpis.profitPerBird) },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            Performance & profit
            {closed ? <Badge variant="secondary" className="gap-1"><Lock className="h-3 w-3" /> Closed</Badge> : <Badge variant="outline">Live</Badge>}
          </CardTitle>
          <CardDescription>
            {closed
              ? `Final figures frozen on ${new Date(performance.closedAt ?? '').toLocaleDateString()}.`
              : 'Updates as costs and sales are recorded. Shared farm and admin costs are split by bird-days.'}
          </CardDescription>
        </div>
        <div className="flex gap-2">
          {canClose ? <Button onClick={() => setShowClose(true)} className="gap-2"><Lock className="h-4 w-4" /> Close batch</Button> : null}
          {closed && canManage ? (
            <Button variant="outline" onClick={handleReopen} disabled={reopenBatch.isPending} className="gap-2">
              <LockOpen className="h-4 w-4" /> Reopen
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {closed && performance.lateCosts !== 0 ? (
          <div className="flex gap-3 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {formatCurrency(performance.lateCosts)} of costs were recorded for this batch after it was closed and are not in the figures below.
              Reopen and close it again to include them.
            </p>
          </div>
        ) : null}

        {!closed && costs.stale ? (
          <div className="flex gap-3 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              This batch has been open for more than 90 days, which is longer than any broiler batch runs. Shared farm costs stopped being
              charged to it after day 90. Record its final sales and deaths and close it, or correct its dates.
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {pnlTiles.map((tile) => (
            <div key={tile.label} className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{tile.label}</p>
              <p className={`mt-1 text-lg font-semibold tabular-nums ${tile.tone ?? ''}`}>{tile.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kpiTiles.map((tile) => (
            <div key={tile.label} className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">{tile.label}</p>
              <p className="mt-1 font-semibold tabular-nums">{tile.value}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold">Where the cost came from</h3>
            <span className="text-xs text-muted-foreground">
              {costs.birdDays ? `${costs.birdDays.toLocaleString('en-US')} bird-days` : null}
            </span>
          </div>
          {totalCost > 0 ? (
            <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label="Cost breakdown">
              {COMPONENTS.map((component) => {
                const value = costs[component.key] ?? 0;
                return value > 0 ? <div key={component.key} className={component.color} style={{ width: `${(value / totalCost) * 100}%` }} /> : null;
              })}
            </div>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {COMPONENTS.map((component) => {
              const value = costs[component.key] ?? 0;
              return (
                <div key={component.key} className="flex items-center gap-2 text-sm">
                  <span className={`h-2.5 w-2.5 rounded-sm ${component.color}`} />
                  <span className="text-muted-foreground">{component.label}</span>
                  <span className="ml-auto font-medium tabular-nums">{formatCurrency(value)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Charged as</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-20 text-center text-sm text-muted-foreground">No costs recorded for this batch yet.</TableCell>
                </TableRow>
              ) : (showAll ? ledger : ledger.slice(0, 15)).map((entry, index) => (
                <TableRow key={`${entry.sourceType}-${entry.sourceId}-${entry.componentType}-${index}`}>
                  <TableCell className="whitespace-nowrap">{new Date(entry.eventDate).toLocaleDateString()}</TableCell>
                  <TableCell>{COMPONENT_LABELS[entry.componentType] ?? entry.componentType}</TableCell>
                  <TableCell>{ALLOCATION_LABELS[entry.allocationType] ?? entry.allocationType}</TableCell>
                  <TableCell className="max-w-md">
                    <p className="font-medium">{entry.description}</p>
                    {entry.basis ? <p className="text-xs text-muted-foreground">{entry.basis}</p> : null}
                    {entry.quantity != null && entry.unitCost != null ? (
                      <p className="text-xs text-muted-foreground">{fmt(entry.quantity, 0)} {entry.unit} × {formatCurrency(entry.unitCost)}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatCurrency(entry.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {ledger.length > 15 ? (
          <Button variant="ghost" size="sm" onClick={() => setShowAll((value) => !value)}>
            {showAll ? 'Show fewer' : `Show all ${ledger.length} cost lines`}
          </Button>
        ) : null}
      </CardContent>

      <Dialog open={showClose} onOpenChange={setShowClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Close this batch</DialogTitle>
            <DialogDescription>
              Closing freezes the final costs, revenue and KPIs. Farm costs after the last sale go to the next batch.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted/50 p-3">
              <div><p className="text-xs text-muted-foreground">Revenue</p><p className="font-semibold tabular-nums">{formatCurrency(kpis.revenue)}</p></div>
              <div><p className="text-xs text-muted-foreground">Cost</p><p className="font-semibold tabular-nums">{formatCurrency(totalCost)}</p></div>
              <div><p className="text-xs text-muted-foreground">Profit</p><p className="font-semibold tabular-nums">{formatCurrency(kpis.profit)}</p></div>
            </div>
            <p>
              Placed {kpis.birdsPlaced.toLocaleString('en-US')} · deaths {kpis.deaths.toLocaleString('en-US')} · sold {kpis.birdsSold.toLocaleString('en-US')}
            </p>
            {unaccounted !== 0 ? (
              <div className="space-y-2 rounded-lg border border-warning/30 p-3">
                <p className="font-medium">
                  {Math.abs(unaccounted).toLocaleString('en-US')} birds {unaccounted > 0 ? 'are not accounted for' : 'more were sold than placed'}.
                </p>
                <p className="text-muted-foreground">Record the missing deaths or sales first, or close with the difference noted.</p>
                <div className="flex items-center gap-2">
                  <Checkbox id="accept-variance" checked={acceptVariance} onCheckedChange={(checked) => setAcceptVariance(checked === true)} />
                  <Label htmlFor="accept-variance">Close anyway and record the difference</Label>
                </div>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="close-notes">Notes (optional)</Label>
              <Textarea id="close-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything worth remembering about this batch" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClose(false)}>Cancel</Button>
            <Button onClick={handleClose} disabled={closeBatch.isPending || (unaccounted > 0 && !acceptVariance)}>
              {closeBatch.isPending ? 'Closing…' : 'Close batch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
