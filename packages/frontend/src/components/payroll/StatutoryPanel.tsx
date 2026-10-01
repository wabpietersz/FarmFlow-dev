import { useState } from 'react';
import { CheckCircle2, Download, Landmark } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRemitStatutory, useStatutoryRates, useStatutoryReturn } from '@/hooks/usePayroll';
import { getApiErrorMessage } from '@/lib/api';
import { downloadCsv } from '@/lib/generatePayslips';
import { formatCurrency } from '@/lib/utils';
import { AccountSelect } from './AccountSelect';

/** The monthly EPF/ETF return: who, how much, and paying it over. */
export function StatutoryPanel({ month, canPay }: { month: string; canPay: boolean }) {
  const { data, isLoading } = useStatutoryReturn(month);
  const rates = useStatutoryRates().data?.data;
  const [paying, setPaying] = useState(false);
  const ret = data?.data;

  if (isLoading) return <Skeleton className="h-64 rounded-3xl" />;
  if (!ret || ret.lines.length === 0) {
    return <p className="rounded-3xl border border-dashed p-8 text-center text-sm text-muted-foreground">No EPF/ETF for this month. It appears once payroll is generated for EPF members.</p>;
  }
  const t = ret.totals;
  const exportReturn = () => downloadCsv(`EPF-ETF-${month}.csv`,
    ['Employee', 'EPF No', 'Total earnings', `Employee EPF ${rates?.epfEmployeeRate ?? 8}%`, `Employer EPF ${rates?.epfEmployerRate ?? 12}%`, 'Total EPF', `ETF ${rates?.etfEmployerRate ?? 3}%`],
    ret.lines.map((l) => [l.employeeName, l.epfNumber, l.epfBase.toFixed(2), l.epfEmployee.toFixed(2), l.epfEmployer.toFixed(2), l.epfTotal.toFixed(2), l.etfEmployer.toFixed(2)]));
  const missingNumbers = ret.lines.filter((l) => !l.epfNumber).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-3xl bg-panel p-4"><p className="text-sm text-muted-foreground">Total EPF</p><p className="text-xl font-extrabold tabular-nums">{formatCurrency(t.epfTotal)}</p><p className="text-xs text-muted-foreground">{formatCurrency(t.epfEmployee)} staff + {formatCurrency(t.epfEmployer)} you</p></div>
        <div className="rounded-3xl bg-panel p-4"><p className="text-sm text-muted-foreground">ETF</p><p className="text-xl font-extrabold tabular-nums">{formatCurrency(t.etfEmployer)}</p><p className="text-xs text-muted-foreground">employer only</p></div>
        <div className="rounded-3xl bg-panel p-4"><p className="text-sm text-muted-foreground">To pay over</p><p className="text-xl font-extrabold tabular-nums">{formatCurrency(t.epfTotal + t.etfEmployer)}</p><p className="text-xs text-muted-foreground">{ret.lines.length} member{ret.lines.length === 1 ? '' : 's'}</p></div>
        <div className="rounded-3xl border border-border p-4">
          {ret.remittance ? (
            <>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-success"><CheckCircle2 className="h-4 w-4" /> Paid</p>
              <p className="font-bold">{new Date(ret.remittance.paidDate).toLocaleDateString()}</p>
              <p className="truncate text-xs text-muted-foreground">{[ret.remittance.epfReference, ret.remittance.etfReference].filter(Boolean).join(' · ') || 'No reference'}</p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="font-bold text-warning">Not paid yet</p>
              <p className="text-xs text-muted-foreground">{ret.unpaidPayrolls ? `${ret.unpaidPayrolls} payroll${ret.unpaidPayrolls === 1 ? '' : 's'} still to pay` : 'Ready to pay'}</p>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {canPay && !ret.remittance ? (
          <Button onClick={() => setPaying(true)} disabled={ret.unpaidPayrolls > 0} title={ret.unpaidPayrolls > 0 ? 'Pay all payroll for the month first' : undefined}>
            <Landmark className="h-4 w-4" /> Pay EPF/ETF
          </Button>
        ) : null}
        <Button variant="outline" onClick={exportReturn}><Download className="h-4 w-4" /> Return (CSV)</Button>
      </div>
      {missingNumbers ? <p className="text-sm text-warning">{missingNumbers} employee{missingNumbers === 1 ? ' has' : 's have'} no EPF number. Add it on their employee record.</p> : null}

      <div className="overflow-x-auto rounded-3xl border border-border">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>EPF No.</TableHead>
              <TableHead className="text-right">Earnings</TableHead>
              <TableHead className="text-right">Staff {rates?.epfEmployeeRate ?? 8}%</TableHead>
              <TableHead className="text-right">Employer {rates?.epfEmployerRate ?? 12}%</TableHead>
              <TableHead className="text-right">Total EPF</TableHead>
              <TableHead className="text-right">ETF {rates?.etfEmployerRate ?? 3}%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ret.lines.map((line) => (
              <TableRow key={line.payrollId}>
                <TableCell className="font-medium">{line.employeeName}{line.status !== 'paid' ? <span className="ml-2 text-xs text-warning">({line.status})</span> : null}</TableCell>
                <TableCell className={line.epfNumber ? '' : 'text-warning'}>{line.epfNumber ?? 'missing'}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(line.epfBase)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(line.epfEmployee)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(line.epfEmployer)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(line.epfTotal)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(line.etfEmployer)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2} className="font-bold">Total</TableCell>
              <TableCell className="text-right font-bold tabular-nums">{formatCurrency(t.epfBase)}</TableCell>
              <TableCell className="text-right font-bold tabular-nums">{formatCurrency(t.epfEmployee)}</TableCell>
              <TableCell className="text-right font-bold tabular-nums">{formatCurrency(t.epfEmployer)}</TableCell>
              <TableCell className="text-right font-bold tabular-nums">{formatCurrency(t.epfTotal)}</TableCell>
              <TableCell className="text-right font-bold tabular-nums">{formatCurrency(t.etfEmployer)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      {paying ? <RemitDialog month={month} total={t.epfTotal + t.etfEmployer} onClose={() => setPaying(false)} /> : null}
    </div>
  );
}

function RemitDialog({ month, total, onClose }: { month: string; total: number; onClose: () => void }) {
  const remit = useRemitStatutory();
  const [accountId, setAccountId] = useState('');
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [epfReference, setEpfReference] = useState('');
  const [etfReference, setEtfReference] = useState('');

  const submit = async () => {
    try {
      await remit.mutateAsync({ payPeriod: month, financeAccountId: Number(accountId), paidDate, epfReference: epfReference.trim() || null, etfReference: etfReference.trim() || null });
      toast.success('EPF/ETF paid and recorded in Money');
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not record the payment'));
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Pay EPF/ETF</DialogTitle>
          <DialogDescription>{formatCurrency(total)} for {new Date(`${month}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}. The employer share is charged to each employee's farm, mill or admin.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2"><Label htmlFor="rm-acc">Paid from</Label><AccountSelect id="rm-acc" value={accountId} onChange={setAccountId} /></div>
            <div className="grid gap-2"><Label htmlFor="rm-date">Paid on</Label><Input id="rm-date" type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} /></div>
            <div className="grid gap-2"><Label htmlFor="rm-epf">EPF reference</Label><Input id="rm-epf" value={epfReference} onChange={(e) => setEpfReference(e.target.value)} placeholder="C-form / receipt no." /></div>
            <div className="grid gap-2"><Label htmlFor="rm-etf">ETF reference</Label><Input id="rm-etf" value={etfReference} onChange={(e) => setEtfReference(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!accountId || remit.isPending}>Pay {formatCurrency(total)}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
