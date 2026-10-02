import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Tag } from 'lucide-react';
import { toast } from 'sonner';
import type { MoneyLedgerEntry } from '@farmflow/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableActionsHead, TableActionsCell } from '@/components/ui/table';
import { useCostCentres, useFinanceCategories, useMoneyLedger, useRetagLedgerEntry } from '@/hooks/useFinance';
import { getApiErrorMessage } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { EMPTY_FINANCE_TAGS, FinanceTagFields, type FinanceTagValue } from './FinanceTagFields';
import { RowActions } from '@/components/ui/row-actions';

const ALL = 'all';
const PAGE_SIZE = 50;

function firstOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
}

interface MoneyLedgerTabProps {
  accounts: Array<{ id: number; accountName: string }>;
  canManage: boolean;
  onOpenTransaction: (transactionId: number) => void;
}

/** Line-level view of every money movement, filterable by what it was for and where it belongs. */
export function MoneyLedgerTab({ accounts, canManage, onOpenTransaction }: MoneyLedgerTabProps) {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState('');
  const [accountId, setAccountId] = useState(ALL);
  const [costCentreId, setCostCentreId] = useState(ALL);
  const [categoryId, setCategoryId] = useState(ALL);
  const [categoryType, setCategoryType] = useState(ALL);
  const [page, setPage] = useState(1);
  const [retagEntry, setRetagEntry] = useState<MoneyLedgerEntry | null>(null);
  const [retagValue, setRetagValue] = useState<FinanceTagValue>(EMPTY_FINANCE_TAGS);

  const { data: categoriesData } = useFinanceCategories();
  const { data: costCentresData } = useCostCentres();
  const retag = useRetagLedgerEntry();

  const params = useMemo(() => ({
    from: from || undefined,
    to: to || undefined,
    accountId: accountId !== ALL ? Number(accountId) : undefined,
    costCentreId: costCentreId !== ALL ? Number(costCentreId) : undefined,
    categoryId: categoryId !== ALL ? Number(categoryId) : undefined,
    categoryType: categoryType !== ALL ? categoryType : undefined,
    page,
    limit: PAGE_SIZE,
  }), [from, to, accountId, costCentreId, categoryId, categoryType, page]);

  const ledgerQuery = useMoneyLedger(params);
  const ledger = ledgerQuery.data?.data;
  const entries = ledger?.entries ?? [];
  const totalPages = ledger ? Math.max(Math.ceil(ledger.pagination.total / PAGE_SIZE), 1) : 1;

  const resetPage = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const openRetag = (entry: MoneyLedgerEntry) => {
    setRetagEntry(entry);
    setRetagValue({
      categoryId: entry.categoryType === 'suspense' ? '' : String(entry.categoryId),
      costCentreId: entry.costCentreId ? String(entry.costCentreId) : '',
      batchId: entry.batchId ? String(entry.batchId) : '',
    });
  };

  const submitRetag = async () => {
    if (!retagEntry || !retagValue.categoryId) {
      toast.error('Choose a category');
      return;
    }
    try {
      await retag.mutateAsync({
        entryId: retagEntry.id,
        data: {
          categoryId: Number(retagValue.categoryId),
          costCentreId: retagValue.costCentreId ? Number(retagValue.costCentreId) : null,
          batchId: retagValue.batchId ? Number(retagValue.batchId) : null,
        },
      });
      toast.success('Ledger line re-tagged');
      setRetagEntry(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to re-tag ledger line'));
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="grid gap-2">
          <Label htmlFor="ledger-from">From</Label>
          <Input id="ledger-from" type="date" className="min-h-11" value={from} onChange={(e) => resetPage(setFrom)(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ledger-to">To</Label>
          <Input id="ledger-to" type="date" className="min-h-11" value={to} onChange={(e) => resetPage(setTo)(e.target.value)} />
        </div>
        <FilterSelect label="Account" value={accountId} onChange={resetPage(setAccountId)} allLabel="All accounts"
          options={accounts.map((account) => ({ value: String(account.id), label: account.accountName }))} />
        <FilterSelect label="Cost centre" value={costCentreId} onChange={resetPage(setCostCentreId)} allLabel="All cost centres"
          options={(costCentresData?.data ?? []).map((centre) => ({ value: String(centre.id), label: centre.name }))} />
        <FilterSelect label="Type" value={categoryType} onChange={resetPage(setCategoryType)} allLabel="All types"
          options={[
            { value: 'income', label: 'Income' },
            { value: 'expense', label: 'Expense' },
            { value: 'financing', label: 'Financing' },
            { value: 'transfer', label: 'Transfers' },
            { value: 'suspense', label: 'Needs review' },
          ]} />
        <FilterSelect label="Category" value={categoryId} onChange={resetPage(setCategoryId)} allLabel="All categories"
          options={(categoriesData?.data ?? []).map((category) => ({ value: String(category.id), label: category.name }))} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <TotalTile label="Money in" value={ledger?.totals.inflow} tone="in" />
        <TotalTile label="Money out" value={ledger?.totals.outflow} tone="out" />
        <TotalTile label="Net movement" value={ledger?.totals.net} tone="net" />
      </div>
      <p className="text-xs text-muted-foreground">
        Totals include internal transfers when no type filter is set. Choose a type to see income or spending only.
      </p>

      <Card>
        <CardContent className="p-0">
          {ledgerQuery.isLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-12 rounded-lg" />)}
            </div>
          ) : ledgerQuery.error ? (
            <p className="p-6 text-sm text-destructive">{getApiErrorMessage(ledgerQuery.error, 'Failed to load the money ledger.')}</p>
          ) : entries.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No money movements match these filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Cost centre / batch</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Counterparty / note</TableHead>
                    <TableHead className="text-right">In</TableHead>
                    <TableHead className="text-right">Out</TableHead>
                    <TableActionsHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id} onOpen={() => onOpenTransaction(entry.treasuryTransactionId)}>
                      <TableCell className="whitespace-nowrap">
                        <p>{new Date(entry.valueDate).toLocaleDateString()}</p>
                        <p className="text-xs text-muted-foreground">{entry.transactionCode}</p>
                      </TableCell>
                      <TableCell>
                        {entry.categoryType === 'suspense' ? (
                          <Badge variant="outline" className="gap-1 border-warning/30 text-warning">
                            <AlertTriangle className="h-3 w-3" /> Needs review
                          </Badge>
                        ) : (
                          <>
                            <p className="font-medium">{entry.categoryName}</p>
                            <p className="text-xs text-muted-foreground">{entry.reportGroup}</p>
                          </>
                        )}
                      </TableCell>
                      <TableCell>
                        <p>{entry.costCentreName ?? '—'}</p>
                        {entry.batchCode ? <p className="text-xs text-muted-foreground">{entry.batchCode}</p> : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{entry.financeAccountName}</TableCell>
                      <TableCell className="max-w-64">
                        <p className="truncate">{entry.counterpartyNameSnapshot ?? entry.narrative ?? '—'}</p>
                        {entry.notes ? <p className="truncate text-xs text-muted-foreground">{entry.notes}</p> : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {entry.entryDirection === 'inflow' ? formatCurrency(Number(entry.amount)) : ''}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {entry.entryDirection === 'outflow' ? formatCurrency(Number(entry.amount)) : ''}
                      </TableCell>
                      <TableActionsCell>
                        <RowActions
                          label={`transaction ${entry.transactionCode}`}
                          open={() => onOpenTransaction(entry.treasuryTransactionId)}
                          actions={[{ label: 'Re-tag', icon: Tag, hidden: !canManage || entry.categoryType === 'transfer', onSelect: () => openRetag(entry) }]}
                        />
                      </TableActionsCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {ledger && ledger.pagination.total > PAGE_SIZE ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page} of {totalPages} · {ledger.pagination.total} lines
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      ) : null}

      <Dialog open={!!retagEntry} onOpenChange={(open) => !open && setRetagEntry(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Re-tag ledger line</DialogTitle>
            <DialogDescription>
              {retagEntry
                ? `${retagEntry.entryDirection === 'inflow' ? 'Money in' : 'Money out'} of ${formatCurrency(Number(retagEntry.amount))} on ${new Date(retagEntry.valueDate).toLocaleDateString()}. The amount, account and date don't change.`
                : null}
            </DialogDescription>
          </DialogHeader>
          {retagEntry ? (
            <FinanceTagFields value={retagValue} onChange={setRetagValue} direction={retagEntry.entryDirection} />
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRetagEntry(null)}>Cancel</Button>
            <Button onClick={submitRetag} disabled={retag.isPending}>{retag.isPending ? 'Saving…' : 'Save tags'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  allLabel,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="min-h-11 w-full"><SelectValue placeholder={allLabel} /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function TotalTile({ label, value, tone }: { label: string; value: number | undefined; tone: 'in' | 'out' | 'net' }) {
  const Icon = tone === 'in' ? ArrowDownLeft : tone === 'out' ? ArrowUpRight : null;
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{value === undefined ? '—' : formatCurrency(value)}</p>
        </div>
        {Icon ? <Icon className="h-5 w-5 text-muted-foreground" /> : null}
      </CardContent>
    </Card>
  );
}
