import { useState } from 'react';
import { Download, FileText, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePayables, useSupplierStatement } from '@/hooks/useFinance';
import { downloadCsv } from '@/lib/generatePayslips';
import { cn, formatCurrency } from '@/lib/utils';
import { StatCard } from './ReportBits';

const BUCKETS = [
  { key: 'current', label: 'Not yet due', tone: '' },
  { key: 'days1to30', label: '1–30 days late', tone: 'text-warning' },
  { key: 'days31to60', label: '31–60 days', tone: 'text-danger' },
  { key: 'days61to90', label: '61–90 days', tone: 'text-danger' },
  { key: 'over90', label: '90+ days', tone: 'text-danger' },
] as const;

/** What you owe suppliers, and how late it is. */
export function PayablesTab() {
  const { data, isLoading } = usePayables();
  const [statementFor, setStatementFor] = useState<{ id: number; name: string } | null>(null);
  const ageing = data?.data;

  if (isLoading) return <Skeleton className="h-64 rounded-3xl" />;
  if (!ageing || ageing.suppliers.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed p-8 text-center">
        <Truck className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <p className="font-semibold">You don't owe any supplier</p>
        <p className="text-sm text-muted-foreground">Unpaid supplier invoices show here, grouped by how late they are.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="You owe suppliers" value={formatCurrency(ageing.totalOwed)} />
        <StatCard label="Overdue" value={formatCurrency(ageing.overdue)} tone={ageing.overdue > 0 ? 'danger' : undefined} />
        <StatCard label="Not yet due" value={formatCurrency(ageing.totals.current)} />
      </div>
      <div className="overflow-x-auto rounded-3xl border border-border">
        <Table className="min-w-[860px]">
          <TableHeader>
            <TableRow>
              <TableHead>Supplier</TableHead>
              {BUCKETS.map((b) => <TableHead key={b.key} className="text-right">{b.label}</TableHead>)}
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="w-[120px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {ageing.suppliers.map((s) => (
              <TableRow key={s.supplierId}>
                <TableCell>
                  <p className="font-semibold">{s.supplierName}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.invoices.length} invoice{s.invoices.length === 1 ? '' : 's'}
                    {s.awaitingApproval ? ` · ${formatCurrency(s.awaitingApproval)} not approved yet` : ''}
                    {s.unappliedCredit ? ` · ${formatCurrency(s.unappliedCredit)} paid in advance` : ''}
                  </p>
                </TableCell>
                {BUCKETS.map((b) => (
                  <TableCell key={b.key} className={cn('text-right tabular-nums', s.buckets[b.key] > 0 ? b.tone : 'text-muted-foreground')}>
                    {s.buckets[b.key] > 0 ? formatCurrency(s.buckets[b.key]) : '—'}
                  </TableCell>
                ))}
                <TableCell className="text-right font-bold tabular-nums">{formatCurrency(s.totalOwed)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => setStatementFor({ id: s.supplierId, name: s.supplierName })}><FileText className="h-4 w-4" /> Statement</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {statementFor ? <SupplierStatementDialog supplierId={statementFor.id} name={statementFor.name} onClose={() => setStatementFor(null)} /> : null}
    </div>
  );
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

function SupplierStatementDialog({ supplierId, name, onClose }: { supplierId: number; name: string; onClose: () => void }) {
  const now = new Date();
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth() - 2, 1)));
  const [to, setTo] = useState(iso(now));
  const { data, isLoading } = useSupplierStatement(supplierId, from, to);
  const st = data?.data;

  const exportCsv = () => st && downloadCsv(`Supplier-statement-${name.replace(/[^\w-]+/g, '_')}-${to}.csv`, ['Date', 'Reference', 'Details', 'Invoiced', 'Paid', 'Balance'], [
    [from, '', 'Opening balance', '', '', st.openingBalance],
    ...st.entries.map((e) => [e.entryDate, e.referenceCode, e.description, e.charged || '', e.paid || '', e.runningBalance]),
  ]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[780px]">
        <DialogHeader>
          <DialogTitle>Statement · {name}</DialogTitle>
          <DialogDescription>Invoices add to what you owe; payments reduce it.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5"><Label htmlFor="ss-from">From</Label><Input id="ss-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label htmlFor="ss-to">To</Label><Input id="ss-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></div>
          <Button className="ml-auto" variant="outline" disabled={!st} onClick={exportCsv}><Download className="h-4 w-4" /> CSV</Button>
        </div>
        {isLoading || !st ? <Skeleton className="h-40 rounded-2xl" /> : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[['Opening', st.openingBalance], ['Invoiced', st.totalInvoiced], ['Paid', st.totalPaid], ['You owe', st.closingBalance]].map(([label, value]) => (
                <div key={label as string} className="rounded-2xl bg-panel p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="font-bold tabular-nums">{formatCurrency(value as number)}</p></div>
              ))}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead><TableHead>Reference</TableHead><TableHead>Details</TableHead>
                  <TableHead className="text-right">Invoiced</TableHead><TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {st.entries.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-14 text-center text-sm text-muted-foreground">Nothing in this period.</TableCell></TableRow>
                ) : st.entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{new Date(e.entryDate).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{e.referenceCode}</TableCell>
                    <TableCell className="text-muted-foreground">{e.description}{e.status === 'recorded' ? ' (not approved)' : ''}</TableCell>
                    <TableCell className="text-right tabular-nums">{e.charged ? formatCurrency(e.charged) : ''}</TableCell>
                    <TableCell className="text-right tabular-nums text-success">{e.paid ? formatCurrency(e.paid) : ''}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(e.runningBalance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
