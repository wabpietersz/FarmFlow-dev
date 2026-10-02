import { useState } from 'react';
import { Download, FileText, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AgeingBucket } from '@farmflow/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableActionsHead, TableActionsCell } from '@/components/ui/table';
import { useBuyerStatement, useReceivablesAgeing } from '@/hooks/useSales';
import { generateStatementPDF } from '@/lib/generateStatement';
import { cn, formatCurrency } from '@/lib/utils';
import { RowActions } from '@/components/ui/row-actions';

const BUCKETS: Array<{ key: AgeingBucket; label: string; tone: string }> = [
  { key: 'current', label: 'Not yet due', tone: 'text-foreground' },
  { key: 'days1to30', label: '1–30 days late', tone: 'text-warning' },
  { key: 'days31to60', label: '31–60 days', tone: 'text-danger' },
  { key: 'days61to90', label: '61–90 days', tone: 'text-danger' },
  { key: 'over90', label: '90+ days', tone: 'text-danger' },
];

/** Who owes money, and how late it is. Click a buyer for their statement. */
export function ReceivablesTab() {
  const navigate = useNavigate();
  const { data, isLoading } = useReceivablesAgeing();
  const [statementBuyer, setStatementBuyer] = useState<{ id: number; name: string } | null>(null);
  const ageing = data?.data;

  if (isLoading) return <Skeleton className="h-64 rounded-3xl" />;
  if (!ageing || ageing.buyers.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed p-8 text-center">
        <Wallet className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <p className="font-semibold">Nobody owes you money</p>
        <p className="text-sm text-muted-foreground">Unpaid sales show here, grouped by how late they are.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-3xl bg-panel p-4 sm:col-span-1">
          <p className="text-sm text-muted-foreground">Owed to you</p>
          <p className="text-xl font-extrabold tabular-nums">{formatCurrency(ageing.totalOwed)}</p>
        </div>
        {BUCKETS.map((bucket) => (
          <div key={bucket.key} className="rounded-3xl border border-border p-4">
            <p className="text-sm text-muted-foreground">{bucket.label}</p>
            <p className={cn('text-lg font-bold tabular-nums', ageing.totals[bucket.key] > 0 ? bucket.tone : 'text-muted-foreground')}>
              {formatCurrency(ageing.totals[bucket.key])}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-3xl border border-border">
        <Table className="min-w-[860px]">
          <TableHeader>
            <TableRow>
              <TableHead>Buyer</TableHead>
              {BUCKETS.map((bucket) => <TableHead key={bucket.key} className="text-right">{bucket.label}</TableHead>)}
              <TableHead className="text-right">Total owed</TableHead>
              <TableActionsHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {ageing.buyers.map((buyer) => {
              const overLimit = buyer.creditLimit != null && buyer.totalOwed > buyer.creditLimit;
              return (
                <TableRow key={buyer.buyerId} onOpen={() => navigate(`/buyers/${buyer.buyerId}`)}>
                  <TableCell>
                    <p className="font-semibold">{buyer.buyerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {buyer.creditTerms ? `${buyer.creditTerms}-day terms` : 'Pay on delivery'}
                      {buyer.creditLimit != null ? ` · limit ${formatCurrency(buyer.creditLimit)}` : ''}
                      {buyer.unappliedCredit > 0 ? ` · ${formatCurrency(buyer.unappliedCredit)} credit unapplied` : ''}
                    </p>
                    {overLimit ? <p className="text-xs font-semibold text-danger">Over credit limit</p> : null}
                  </TableCell>
                  {BUCKETS.map((bucket) => (
                    <TableCell key={bucket.key} className={cn('text-right tabular-nums', buyer.buckets[bucket.key] > 0 ? bucket.tone : 'text-muted-foreground')}>
                      {buyer.buckets[bucket.key] > 0 ? formatCurrency(buyer.buckets[bucket.key]) : '—'}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-bold tabular-nums">{formatCurrency(buyer.totalOwed)}</TableCell>
                  <TableActionsCell>
                    <RowActions
                      label={`buyer ${buyer.buyerName}`}
                      open={`/buyers/${buyer.buyerId}`}
                      actions={[{ label: 'Statement', icon: FileText, onSelect: () => setStatementBuyer({ id: buyer.buyerId, name: buyer.buyerName }) }]}
                    />
                  </TableActionsCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {statementBuyer ? <BuyerStatementDialog buyerId={statementBuyer.id} buyerName={statementBuyer.name} onClose={() => setStatementBuyer(null)} /> : null}
    </div>
  );
}

const iso = (date: Date) => date.toISOString().slice(0, 10);

export function BuyerStatementDialog({ buyerId, buyerName, onClose }: { buyerId: number; buyerName: string; onClose: () => void }) {
  const now = new Date();
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth() - 2, 1)));
  const [to, setTo] = useState(iso(now));
  const { data, isLoading, isError } = useBuyerStatement(buyerId, from, to);
  const statement = data?.data;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[820px]">
        <DialogHeader>
          <DialogTitle>Statement · {buyerName}</DialogTitle>
          <DialogDescription>Every sale and payment in the period, with the running balance.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="st-from">From</Label>
            <Input id="st-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="st-to">To</Label>
            <Input id="st-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button className="ml-auto" disabled={!statement} onClick={() => statement && generateStatementPDF(statement)}>
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        </div>

        {isLoading ? <Skeleton className="h-48 rounded-2xl" /> : isError || !statement ? (
          <p className="text-sm text-danger">Could not load the statement.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Opening balance', statement.openingBalance],
                ['Sold', statement.totalSales],
                ['Received', statement.totalReceived],
                ['Balance due', statement.closingBalance],
              ].map(([label, value]) => (
                <div key={label as string} className="rounded-2xl bg-panel p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-bold tabular-nums">{formatCurrency(value as number)}</p>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="text-right">Charged</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statement.entries.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="h-16 text-center text-sm text-muted-foreground">Nothing in this period.</TableCell></TableRow>
                  ) : statement.entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{new Date(entry.entryDate).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{entry.referenceCode}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {entry.description}
                        {entry.entryType === 'receipt' && entry.credit === 0 ? <span className="ml-1 text-xs">({entry.status})</span> : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{entry.debit ? formatCurrency(entry.debit) : ''}</TableCell>
                      <TableCell className="text-right tabular-nums text-success">{entry.credit ? formatCurrency(entry.credit) : ''}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(entry.runningBalance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
