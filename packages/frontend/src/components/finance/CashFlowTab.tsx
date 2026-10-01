import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useCashFlow } from '@/hooks/useFinance';
import { useTreasuryAccounts } from '@/hooks/useTreasury';
import { downloadCsv } from '@/lib/generatePayslips';
import { formatCurrency } from '@/lib/utils';
import { MonthlyTable, RangePicker, StatCard, presetRanges, type Range } from './ReportBits';

const ALL = 'all';

/** Where the cash came from and went: trading, then owner/loans/advances; opening to closing balance. */
export function CashFlowTab() {
  const [range, setRange] = useState<Range>(presetRanges().find((p) => p.key === 'year')!.range);
  const [accountId, setAccountId] = useState(ALL);
  const accounts = useTreasuryAccounts().data?.data ?? [];
  const { data, isLoading } = useCashFlow({ ...range, accountId: accountId === ALL ? null : Number(accountId) });
  const flow = data?.data;

  const byMonth = (pick: (b: { opening: number; net: number; closing: number }) => number) =>
    ({ byMonth: Object.fromEntries((flow?.months ?? []).map((m) => [m, pick(flow!.balances[m])])), total: 0 });

  const exportCsv = () => {
    if (!flow) return;
    downloadCsv(`Cash-flow-${flow.from}-to-${flow.to}.csv`, ['Section', 'Category', ...flow.months, 'Total'], [
      ['', 'Opening balance', ...flow.months.map((m) => flow.balances[m].opening), flow.openingBalance],
      ...flow.operating.lines.map((l) => ['Trading', l.categoryName, ...flow.months.map((m) => l.byMonth[m] ?? 0), l.total]),
      ...flow.financing.lines.map((l) => ['Owner, loans & advances', l.categoryName, ...flow.months.map((m) => l.byMonth[m] ?? 0), l.total]),
      ...flow.other.lines.map((l) => ['Other', l.categoryName, ...flow.months.map((m) => l.byMonth[m] ?? 0), l.total]),
      ['', 'Closing balance', ...flow.months.map((m) => flow.balances[m].closing), flow.closingBalance],
    ]);
  };

  return (
    <div className="space-y-4">
      <RangePicker value={range} onChange={setRange}>
        <div className="w-[200px]">
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger aria-label="Account"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All accounts</SelectItem>
              {accounts.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.accountName}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </RangePicker>

      {isLoading ? <Skeleton className="h-72 rounded-3xl" /> : !flow ? <p className="text-sm text-danger">Could not load cash flow.</p> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Opening balance" value={formatCurrency(flow.openingBalance)} hint={new Date(flow.from).toLocaleDateString()} />
            <StatCard label="From trading" value={formatCurrency(flow.operating.total)} tone={flow.operating.total >= 0 ? 'success' : 'danger'} hint="sales in, costs out" />
            <StatCard label="Owner, loans & advances" value={formatCurrency(flow.financing.total)} />
            <StatCard label="Closing balance" value={formatCurrency(flow.closingBalance)} hint={`${flow.netChange >= 0 ? '+' : ''}${formatCurrency(flow.netChange)} in the period`} />
          </div>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4" /> CSV</Button>
          </div>
          <MonthlyTable
            months={flow.months}
            sections={[
              { title: 'Trading', lines: flow.operating.lines, total: flow.operating, totalLabel: 'Net cash from trading' },
              { title: 'Owner, loans & advances', lines: flow.financing.lines, total: flow.financing, totalLabel: 'Net from owner, loans & advances' },
              ...(flow.other.lines.length ? [{ title: 'Other', lines: flow.other.lines, total: flow.other, totalLabel: 'Net other' }] : []),
            ]}
            footer={[
              { label: 'Opening balance', total: { ...byMonth((b) => b.opening), total: flow.openingBalance } },
              { label: 'Closing balance', total: { ...byMonth((b) => b.closing), total: flow.closingBalance }, emphasise: true },
            ]}
          />
          <p className="text-xs text-muted-foreground">Money in is positive, money out negative. Transfers between your own accounts are left out unless you pick one account.</p>
        </>
      )}
    </div>
  );
}
