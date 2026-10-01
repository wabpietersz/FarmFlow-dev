import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { MonthlyLine, MonthlyTotal } from '@/hooks/useFinance';
import { cn, formatCurrency } from '@/lib/utils';

const iso = (d: Date) => d.toISOString().slice(0, 10);

export type Range = { from: string; to: string };

export function presetRanges(): Array<{ key: string; label: string; range: Range }> {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return [
    { key: 'month', label: 'This month', range: { from: iso(new Date(Date.UTC(y, m, 1))), to: iso(now) } },
    { key: 'last-month', label: 'Last month', range: { from: iso(new Date(Date.UTC(y, m - 1, 1))), to: iso(new Date(Date.UTC(y, m, 0))) } },
    { key: 'quarter', label: 'Last 3 months', range: { from: iso(new Date(Date.UTC(y, m - 2, 1))), to: iso(now) } },
    { key: 'year', label: 'This year', range: { from: `${y}-01-01`, to: iso(now) } },
    { key: '12m', label: 'Last 12 months', range: { from: iso(new Date(Date.UTC(y, m - 11, 1))), to: iso(now) } },
  ];
}

/** Preset pills plus custom From/To. */
export function RangePicker({ value, onChange, children }: { value: Range; onChange: (range: Range) => void; children?: ReactNode }) {
  const presets = presetRanges();
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Period">
        {presets.map((preset) => {
          const active = preset.range.from === value.from && preset.range.to === value.to;
          return (
            <button key={preset.key} type="button" aria-pressed={active} onClick={() => onChange(preset.range)}
              className={cn('min-h-10 rounded-full px-4 text-sm font-semibold', active ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground')}>
              {preset.label}
            </button>
          );
        })}
      </div>
      <div className="grid gap-1">
        <Label htmlFor="range-from" className="text-xs">From</Label>
        <Input id="range-from" type="date" value={value.from} max={value.to} onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })} className="h-10 w-[150px]" />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="range-to" className="text-xs">To</Label>
        <Input id="range-to" type="date" value={value.to} min={value.from} onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })} className="h-10 w-[150px]" />
      </div>
      {children}
    </div>
  );
}

export const monthLabel = (month: string) => new Date(`${month}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });

const amount = (value: number | undefined) => (value ? formatCurrency(value) : '—');

type Section = { title: string; lines: MonthlyLine[]; total: MonthlyTotal; totalLabel: string; tone?: 'income' | 'expense' };

/** Categories down, months across, with a total column. */
export function MonthlyTable({ months, sections, footer }: {
  months: string[];
  sections: Section[];
  footer?: { label: string; total: MonthlyTotal; emphasise?: boolean }[];
}) {
  // Many months: show the last 12 plus the total, older ones are still in the total
  const shown = months.slice(-12);
  return (
    <div className="overflow-x-auto rounded-3xl border border-border">
      <Table className="min-w-[640px]">
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-background">Category</TableHead>
            {shown.length > 1 ? shown.map((m) => <TableHead key={m} className="text-right">{monthLabel(m)}</TableHead>) : null}
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        {sections.map((section) => (
          <TableBody key={section.title}>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableCell colSpan={(shown.length > 1 ? shown.length : 0) + 2} className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{section.title}</TableCell>
            </TableRow>
            {section.lines.length === 0 ? (
              <TableRow><TableCell colSpan={(shown.length > 1 ? shown.length : 0) + 2} className="text-sm text-muted-foreground">Nothing in this period</TableCell></TableRow>
            ) : section.lines.map((line) => (
              <TableRow key={line.categoryCode}>
                <TableCell className="sticky left-0 bg-background">{line.categoryName}</TableCell>
                {shown.length > 1 ? shown.map((m) => <TableCell key={m} className="text-right tabular-nums">{amount(line.byMonth[m])}</TableCell>) : null}
                <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(line.total)}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="sticky left-0 bg-background font-bold">{section.totalLabel}</TableCell>
              {shown.length > 1 ? shown.map((m) => <TableCell key={m} className="text-right font-bold tabular-nums">{amount(section.total.byMonth[m])}</TableCell>) : null}
              <TableCell className="text-right font-bold tabular-nums">{formatCurrency(section.total.total)}</TableCell>
            </TableRow>
          </TableBody>
        ))}
        {footer ? (
          <TableFooter>
            {footer.map((row) => (
              <TableRow key={row.label}>
                <TableCell className={cn('sticky left-0 bg-muted font-extrabold', row.emphasise && 'text-base')}>{row.label}</TableCell>
                {shown.length > 1 ? shown.map((m) => (
                  <TableCell key={m} className={cn('text-right font-extrabold tabular-nums', (row.total.byMonth[m] ?? 0) < 0 && 'text-danger')}>{formatCurrency(row.total.byMonth[m] ?? 0)}</TableCell>
                )) : null}
                <TableCell className={cn('text-right font-extrabold tabular-nums', row.emphasise && 'text-base', row.total.total < 0 && 'text-danger')}>{formatCurrency(row.total.total)}</TableCell>
              </TableRow>
            ))}
          </TableFooter>
        ) : null}
      </Table>
    </div>
  );
}

export function StatCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'success' | 'danger' }) {
  return (
    <div className="rounded-3xl bg-panel p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn('text-xl font-extrabold tabular-nums', tone === 'success' && 'text-success', tone === 'danger' && 'text-danger')}>{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
