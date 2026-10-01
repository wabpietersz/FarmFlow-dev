import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCostCentres, usePnlByCostCentre, useProfitAndLoss, type ProfitAndLoss } from '@/hooks/useFinance';
import { downloadCsv } from '@/lib/generatePayslips';
import { cn, formatCurrency } from '@/lib/utils';
import { MonthlyTable, RangePicker, StatCard, presetRanges, type Range } from './ReportBits';

/** Management profit & loss from the money ledger, for the business or one farm/mill/admin. */
export function ProfitLossTab() {
  const [range, setRange] = useState<Range>(presetRanges().find((p) => p.key === 'year')!.range);
  const [view, setView] = useState<'statement' | 'centres'>('statement');
  const [centreId, setCentreId] = useState<number | null>(null);
  const centres = useCostCentres({ status: 'active' }).data?.data ?? [];
  const pnl = useProfitAndLoss({ ...range, costCentreId: centreId });
  const byCentre = usePnlByCostCentre(range);

  return (
    <div className="space-y-4">
      <RangePicker value={range} onChange={setRange} />
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="View">
        <Pill active={view === 'statement' && centreId === null} onClick={() => { setView('statement'); setCentreId(null); }}>Whole business</Pill>
        {centres.map((centre) => (
          <Pill key={centre.id} active={view === 'statement' && centreId === centre.id} onClick={() => { setView('statement'); setCentreId(centre.id); }}>{centre.name}</Pill>
        ))}
        <Pill active={view === 'centres'} onClick={() => setView('centres')}>Compare</Pill>
      </div>

      {view === 'centres' ? <CentreComparison data={byCentre.data?.data} loading={byCentre.isLoading} /> : (
        pnl.isLoading ? <Skeleton className="h-72 rounded-3xl" /> : pnl.data?.data ? <Statement pnl={pnl.data.data} /> : <p className="text-sm text-danger">Could not load profit & loss.</p>
      )}
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
      className={cn('min-h-9 rounded-full border px-3.5 text-sm font-semibold', active ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:text-foreground')}>
      {children}
    </button>
  );
}

function Statement({ pnl }: { pnl: ProfitAndLoss }) {
  const net = pnl.netProfit.total;
  const exportCsv = () => downloadCsv(`Profit-and-loss-${pnl.from}-to-${pnl.to}.csv`, ['Section', 'Category', ...pnl.months, 'Total'], [
    ...pnl.income.map((l) => ['Income', l.categoryName, ...pnl.months.map((m) => l.byMonth[m] ?? 0), l.total]),
    ['Income', 'Total income', ...pnl.months.map((m) => pnl.totalIncome.byMonth[m]), pnl.totalIncome.total],
    ...pnl.expenses.map((l) => ['Expenses', l.categoryName, ...pnl.months.map((m) => l.byMonth[m] ?? 0), l.total]),
    ['Expenses', 'Total expenses', ...pnl.months.map((m) => pnl.totalExpenses.byMonth[m]), pnl.totalExpenses.total],
    ['', 'Net profit', ...pnl.months.map((m) => pnl.netProfit.byMonth[m]), net],
  ]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Income" value={formatCurrency(pnl.totalIncome.total)} hint={pnl.advancesRecognised ? `incl. ${formatCurrency(pnl.advancesRecognised)} buyer credit used` : undefined} />
        <StatCard label="Expenses" value={formatCurrency(pnl.totalExpenses.total)} />
        <StatCard label={net >= 0 ? 'Profit' : 'Loss'} value={formatCurrency(net)} tone={net >= 0 ? 'success' : 'danger'} />
        <StatCard label="Margin" value={pnl.margin != null ? `${pnl.margin}%` : '—'} hint="profit ÷ income" />
      </div>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4" /> CSV</Button>
      </div>
      <MonthlyTable
        months={pnl.months}
        sections={[
          { title: 'Income', lines: pnl.income, total: pnl.totalIncome, totalLabel: 'Total income' },
          { title: 'Expenses', lines: pnl.expenses, total: pnl.totalExpenses, totalLabel: 'Total expenses' },
        ]}
        footer={[{ label: 'Net profit', total: pnl.netProfit, emphasise: true }]}
      />
      <p className="text-xs text-muted-foreground">
        Cash basis, from the money ledger. Owner money, loans and staff advances are not profit or loss — see Cash flow.
        Stock is counted as a cost when it is paid for; batch costs (Farms → batch) charge it when it is used.
      </p>
    </div>
  );
}

function CentreComparison({ data, loading }: { data?: { columns: Array<{ costCentreId: number; name: string; centreType: string; income: number; expenses: number; net: number }>; untagged: { income: number; expenses: number }; total: { income: number; expenses: number; net: number } }; loading: boolean }) {
  if (loading) return <Skeleton className="h-48 rounded-3xl" />;
  if (!data) return <p className="text-sm text-danger">Could not load the comparison.</p>;
  return (
    <div className="overflow-x-auto rounded-3xl border border-border">
      <Table className="min-w-[560px]">
        <TableHeader>
          <TableRow>
            <TableHead>Cost centre</TableHead>
            <TableHead className="text-right">Income</TableHead>
            <TableHead className="text-right">Expenses</TableHead>
            <TableHead className="text-right">Net</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.columns.map((c) => (
            <TableRow key={c.costCentreId}>
              <TableCell className="font-semibold">{c.name} <span className="text-xs font-normal capitalize text-muted-foreground">· {c.centreType}</span></TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(c.income)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(c.expenses)}</TableCell>
              <TableCell className={cn('text-right font-bold tabular-nums', c.net < 0 && 'text-danger')}>{formatCurrency(c.net)}</TableCell>
            </TableRow>
          ))}
          {data.untagged.income || data.untagged.expenses ? (
            <TableRow>
              <TableCell className="text-muted-foreground">Not tagged to a cost centre</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(data.untagged.income)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(data.untagged.expenses)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(data.untagged.income - data.untagged.expenses)}</TableCell>
            </TableRow>
          ) : null}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="font-extrabold">Whole business</TableCell>
            <TableCell className="text-right font-extrabold tabular-nums">{formatCurrency(data.total.income)}</TableCell>
            <TableCell className="text-right font-extrabold tabular-nums">{formatCurrency(data.total.expenses)}</TableCell>
            <TableCell className={cn('text-right font-extrabold tabular-nums', data.total.net < 0 && 'text-danger')}>{formatCurrency(data.total.net)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
