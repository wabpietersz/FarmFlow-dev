import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCostingOverview } from '@/hooks/useBatches';
import { getApiErrorMessage } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

function monthLabel(month: string) {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m - 1, 1)).toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function defaultFrom() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 7);
}

/**
 * Shows how each month's shared costs reached batches: farm costs split by bird-days, admin costs
 * across all farms, mill costs absorbed into feed. Anything unallocated had no birds (or no feed made) to carry it.
 */
export default function CostAllocationTab() {
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState('');
  const { data, isLoading, error } = useCostingOverview({ from, to: to || undefined });
  const pools = useMemo(() => data?.data?.pools ?? [], [data]);
  const mill = data?.data?.mill ?? [];

  const totals = pools.reduce(
    (acc, pool) => ({ total: acc.total + pool.total, allocated: acc.allocated + pool.allocated, unallocated: acc.unallocated + pool.unallocated }),
    { total: 0, allocated: 0, unallocated: 0 },
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="grid gap-2">
          <Label htmlFor="alloc-from">From month</Label>
          <Input id="alloc-from" type="month" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="alloc-to">To month</Label>
          <Input id="alloc-to" type="month" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Shared costs</p><p className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(totals.total)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Charged to batches / feed</p><p className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(totals.allocated)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Not yet charged</p><p className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(totals.unallocated)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Shared cost allocation</CardTitle>
          <CardDescription>
            Farm costs are split between that farm's batches by bird-days; admin costs across all farms; feed mill costs go into the cost of feed.
            Unallocated amounts fell in a month with no birds on the farm (or no feed produced).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : error ? (
            <p className="p-6 text-sm text-destructive">{getApiErrorMessage(error, 'Failed to load cost allocation')}</p>
          ) : pools.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No shared costs in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Cost pool</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Charged</TableHead>
                    <TableHead className="text-right">Not charged</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pools.map((pool) => (
                    <TableRow key={`${pool.kind}-${pool.siteId}-${pool.month}`}>
                      <TableCell>{monthLabel(pool.month)}</TableCell>
                      <TableCell>{pool.label}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(pool.total)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(pool.allocated)}</TableCell>
                      <TableCell className={`text-right tabular-nums ${pool.unallocated !== 0 ? 'font-semibold text-warning' : ''}`}>
                        {formatCurrency(pool.unallocated)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Feed mill overhead per kg</CardTitle>
          <CardDescription>Mill running costs (power, wages, repairs) spread over the feed made that month and added to its cost.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {mill.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No feed mill activity in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Mill overhead</TableHead>
                    <TableHead className="text-right">Feed produced</TableHead>
                    <TableHead className="text-right">Overhead per kg</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mill.map((month) => (
                    <TableRow key={month.month}>
                      <TableCell>{monthLabel(month.month)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(month.overhead)}</TableCell>
                      <TableCell className="text-right tabular-nums">{month.kgProduced.toLocaleString('en-US')} kg</TableCell>
                      <TableCell className="text-right tabular-nums">{month.kgProduced > 0 ? formatCurrency(month.overheadPerKg) : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
