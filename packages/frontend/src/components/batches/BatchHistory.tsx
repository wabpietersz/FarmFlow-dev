import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useBatchHistory } from '@/hooks/useFarmOps';
import { formatCurrency } from '@/lib/utils';

const fmt = (value: number | null, digits = 2) => (value == null ? '—' : value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }));

/** Closed batches side by side, with the farm's averages and best results. */
export function BatchHistory() {
  const { data, isLoading } = useBatchHistory();
  const history = data?.data;
  if (isLoading) return <Skeleton className="h-64 rounded-3xl" />;
  if (!history || history.batches.length === 0) {
    return <p className="rounded-3xl border border-dashed p-8 text-center text-sm text-muted-foreground">Closed batches appear here so you can compare them. Close a batch from its page once all birds are sold.</p>;
  }
  const { averages, best } = history;
  const tiles = [
    { label: 'Average FCR', value: fmt(averages.fcr, 3), best: best.fcr },
    { label: 'Average mortality', value: `${fmt(averages.mortalityPct, 1)}%` },
    { label: 'Average EPEF', value: fmt(averages.epef, 0), best: best.epef },
    { label: 'Profit per bird', value: averages.profitPerBird == null ? '—' : formatCurrency(averages.profitPerBird), best: best.profitPerBird },
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-3xl bg-panel p-4">
            <p className="text-sm text-muted-foreground">{tile.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{tile.value}</p>
            {tile.best ? <p className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-success"><Trophy className="h-3.5 w-3.5" /> Best: {tile.best}</p> : null}
          </div>
        ))}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Batch</TableHead>
            <TableHead>House</TableHead>
            <TableHead className="text-right">Age</TableHead>
            <TableHead className="text-right">Mortality</TableHead>
            <TableHead className="text-right">FCR</TableHead>
            <TableHead className="text-right">Avg weight</TableHead>
            <TableHead className="text-right">EPEF</TableHead>
            <TableHead className="text-right">Cost / kg</TableHead>
            <TableHead className="text-right">Profit</TableHead>
            <TableHead className="text-right">Per bird</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.batches.map((row) => (
            <TableRow key={row.batchId}>
              <TableCell><Link to={`/batches/${row.batchId}`} className="font-bold text-primary hover:underline">{row.batchCode}</Link></TableCell>
              <TableCell>{row.siteName} · {row.cageNumber}</TableCell>
              <TableCell className="text-right">{row.ageDays ?? '—'} d</TableCell>
              <TableCell className="text-right">{fmt(row.mortalityPct, 1)}%</TableCell>
              <TableCell className={`text-right ${row.batchCode === best.fcr ? 'font-bold text-success' : ''}`}>{fmt(row.fcr, 3)}</TableCell>
              <TableCell className="text-right">{row.averageWeightKg == null ? '—' : `${fmt(row.averageWeightKg, 2)} kg`}</TableCell>
              <TableCell className={`text-right ${row.batchCode === best.epef ? 'font-bold text-success' : ''}`}>{fmt(row.epef, 0)}</TableCell>
              <TableCell className="text-right">{row.costPerKg == null ? '—' : formatCurrency(row.costPerKg)}</TableCell>
              <TableCell className={`text-right font-semibold ${row.profit < 0 ? 'text-danger' : ''}`}>{formatCurrency(row.profit)}</TableCell>
              <TableCell className={`text-right ${row.batchCode === best.profitPerBird ? 'font-bold text-success' : ''}`}>{row.profitPerBird == null ? '—' : formatCurrency(row.profitPerBird)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
