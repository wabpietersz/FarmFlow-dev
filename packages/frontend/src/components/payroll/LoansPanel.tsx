import { useState } from 'react';
import { HandCoins, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { StaffLoan } from '@farmflow/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useEmployees } from '@/hooks/useEmployees';
import { useIssueLoan, useRepayLoan, useStaffLoans, useWriteOffLoan } from '@/hooks/usePayroll';
import { getApiErrorMessage } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { AccountSelect } from './AccountSelect';

const STATUS: Record<StaffLoan['status'], { label: string; variant: 'info' | 'success' | 'secondary' }> = {
  active: { label: 'Recovering', variant: 'info' },
  settled: { label: 'Paid back', variant: 'success' },
  written_off: { label: 'Written off', variant: 'secondary' },
};
const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => today().slice(0, 7);
const monthLabel = (date: string) => new Date(`${date.slice(0, 7)}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

/** Salary advances and staff loans: paid out from Money, taken back through payroll. */
export function LoansPanel({ canIssue, canWriteOff }: { canIssue: boolean; canWriteOff: boolean }) {
  const [filter, setFilter] = useState('active');
  const { data, isLoading } = useStaffLoans(filter);
  const writeOff = useWriteOffLoan();
  const [issuing, setIssuing] = useState(false);
  const [repaying, setRepaying] = useState<StaffLoan | null>(null);
  const loans = data?.data ?? [];
  const owed = loans.filter((l) => l.status === 'active').reduce((sum, l) => sum + l.outstanding, 0);

  const doWriteOff = async (loan: StaffLoan) => {
    const reason = window.prompt(`Why write off ${formatCurrency(loan.outstanding)} on ${loan.loanCode}?`);
    if (!reason) return;
    try {
      await writeOff.mutateAsync({ id: loan.id, reason });
      toast.success('Written off; it will no longer be taken from pay');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not write off'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
          {[['active', 'Recovering'], ['settled', 'Paid back'], ['written_off', 'Written off'], ['all', 'All']].map(([value, label]) => (
            <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value}
              className={`min-h-10 rounded-full px-4 text-sm font-semibold ${filter === value ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {filter === 'active' && loans.length ? <span className="text-sm text-muted-foreground">Staff owe <span className="font-bold text-foreground">{formatCurrency(owed)}</span></span> : null}
          {canIssue ? <Button onClick={() => setIssuing(true)}><Plus className="h-4 w-4" /> Advance or loan</Button> : null}
        </div>
      </div>

      {isLoading ? <Skeleton className="h-40 rounded-3xl" /> : loans.length === 0 ? (
        <div className="rounded-3xl border border-dashed p-8 text-center">
          <HandCoins className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-semibold">No advances or loans here</p>
          <p className="text-sm text-muted-foreground">Pay an advance from cash or bank; it is taken back from the employee's pay automatically.</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {loans.map((loan) => {
            const pct = loan.principal > 0 ? Math.min(100, Math.round(((loan.principal - loan.outstanding) / loan.principal) * 100)) : 0;
            return (
              <div key={loan.id} className="space-y-3 rounded-3xl border border-border p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{loan.employeeName}</p>
                    <p className="text-sm text-muted-foreground">{loan.loanType === 'advance' ? 'Salary advance' : 'Staff loan'} · {loan.loanCode} · {new Date(loan.issuedDate).toLocaleDateString()}</p>
                  </div>
                  <Badge variant={STATUS[loan.status].variant}>{STATUS[loan.status].label}</Badge>
                </div>
                <div>
                  <div className="flex justify-between text-sm">
                    <span><span className="font-bold tabular-nums">{formatCurrency(loan.outstanding)}</span> <span className="text-muted-foreground">left of {formatCurrency(loan.principal)}</span></span>
                    <span className="text-muted-foreground">{formatCurrency(loan.installmentAmount)}/month from {monthLabel(loan.firstRecoveryPeriod)}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Paid back">
                    <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
                  </div>
                  {loan.scheduled > 0 ? <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(loan.scheduled)} is in a payroll not yet paid</p> : null}
                </div>
                {loan.notes ? <p className="whitespace-pre-line text-sm text-muted-foreground">{loan.notes}</p> : null}
                {loan.status === 'active' ? (
                  <div className="flex flex-wrap gap-2">
                    {canIssue ? <Button size="sm" variant="outline" onClick={() => setRepaying(loan)}>Paid back directly</Button> : null}
                    {canWriteOff ? <Button size="sm" variant="ghost" onClick={() => doWriteOff(loan)}>Write off</Button> : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {issuing ? <IssueLoanDialog onClose={() => setIssuing(false)} /> : null}
      {repaying ? <RepayDialog loan={repaying} onClose={() => setRepaying(null)} /> : null}
    </div>
  );
}

function IssueLoanDialog({ onClose }: { onClose: () => void }) {
  const issue = useIssueLoan();
  const employees = (useEmployees({ limit: 500, status: 'active' }).data?.data ?? []) as Array<{ id: number; firstName: string; lastName: string }>;
  const [form, setForm] = useState({ employeeId: '', loanType: 'advance' as 'advance' | 'loan', principal: '', installmentAmount: '', issuedDate: today(), firstRecoveryPeriod: thisMonth(), accountId: '', method: 'cash' as 'cash' | 'bank_transfer', notes: '' });
  const set = <K extends keyof typeof form>(key: K) => (value: (typeof form)[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const principal = Number(form.principal) || 0;
  const installment = form.loanType === 'advance' ? principal : Number(form.installmentAmount) || 0;
  const months = installment > 0 ? Math.ceil(principal / installment) : 0;
  const valid = form.employeeId && principal > 0 && installment > 0 && installment <= principal && form.accountId;

  const submit = async () => {
    try {
      await issue.mutateAsync({
        employeeId: Number(form.employeeId), loanType: form.loanType, principal,
        installmentAmount: form.loanType === 'loan' ? installment : undefined,
        issuedDate: form.issuedDate, firstRecoveryPeriod: form.firstRecoveryPeriod,
        financeAccountId: Number(form.accountId), paymentMethod: form.method, notes: form.notes.trim() || null,
      });
      toast.success('Paid out and recorded in Money');
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not pay out'));
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Advance or loan</DialogTitle>
          <DialogDescription>Paid out now and taken back from pay. An advance comes back in one month; a loan in monthly instalments.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex gap-2 sm:col-span-2" role="group" aria-label="Type">
            {([['advance', 'Salary advance'], ['loan', 'Staff loan']] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => set('loanType')(value)} aria-pressed={form.loanType === value}
                className={`min-h-10 flex-1 rounded-full px-4 text-sm font-semibold ${form.loanType === value ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>{label}</button>
            ))}
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Employee</Label>
            <Select value={form.employeeId} onValueChange={set('employeeId')}>
              <SelectTrigger><SelectValue placeholder="Choose employee" /></SelectTrigger>
              <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-2"><Label htmlFor="ln-amount">Amount</Label><Input id="ln-amount" type="number" inputMode="decimal" min="0" value={form.principal} onChange={(e) => set('principal')(e.target.value)} /></div>
          {form.loanType === 'loan' ? (
            <div className="grid gap-2"><Label htmlFor="ln-inst">Per month</Label><Input id="ln-inst" type="number" inputMode="decimal" min="0" value={form.installmentAmount} onChange={(e) => set('installmentAmount')(e.target.value)} /></div>
          ) : <div />}
          <div className="grid gap-2"><Label htmlFor="ln-date">Paid out on</Label><Input id="ln-date" type="date" value={form.issuedDate} onChange={(e) => set('issuedDate')(e.target.value)} /></div>
          <div className="grid gap-2"><Label htmlFor="ln-first">Take back from</Label><Input id="ln-first" type="month" value={form.firstRecoveryPeriod} onChange={(e) => set('firstRecoveryPeriod')(e.target.value)} /></div>
          <div className="grid gap-2"><Label htmlFor="ln-acc">Paid from</Label><AccountSelect id="ln-acc" value={form.accountId} onChange={set('accountId')} /></div>
          <div className="grid gap-2">
            <Label>How</Label>
            <Select value={form.method} onValueChange={(v) => set('method')(v as 'cash' | 'bank_transfer')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank_transfer">Bank transfer</SelectItem></SelectContent>
            </Select>
          </div>
          {principal > 0 && installment > 0 ? (
            <p className="rounded-2xl bg-panel p-3 text-sm sm:col-span-2">
              {formatCurrency(installment)} a month for {months} month{months === 1 ? '' : 's'}. Never more than the employee's pay after EPF.
            </p>
          ) : null}
          <div className="grid gap-2 sm:col-span-2"><Label htmlFor="ln-notes">Notes</Label><Textarea id="ln-notes" value={form.notes} onChange={(e) => set('notes')(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!valid || issue.isPending}>Pay out {principal ? formatCurrency(principal) : ''}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RepayDialog({ loan, onClose }: { loan: StaffLoan; onClose: () => void }) {
  const repay = useRepayLoan();
  const max = Math.max(loan.leftAfterScheduled, 0);
  const [amount, setAmount] = useState(String(max));
  const [date, setDate] = useState(today());
  const [accountId, setAccountId] = useState('');
  const value = Number(amount) || 0;

  const submit = async () => {
    try {
      await repay.mutateAsync({ id: loan.id, amount: value, date, financeAccountId: Number(accountId) });
      toast.success('Repayment recorded');
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not record the repayment'));
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Paid back directly</DialogTitle>
          <DialogDescription>{loan.employeeName} paid cash or by bank instead of through pay. Up to {formatCurrency(max)} can be paid this way.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2"><Label htmlFor="rp-amt">Amount</Label><Input id="rp-amt" type="number" inputMode="decimal" min="0" max={max} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="grid gap-2"><Label htmlFor="rp-date">Date</Label><Input id="rp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
          <div className="grid gap-2"><Label htmlFor="rp-acc">Paid into</Label><AccountSelect id="rp-acc" value={accountId} onChange={setAccountId} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!accountId || value <= 0 || value > max || repay.isPending}>Record</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
