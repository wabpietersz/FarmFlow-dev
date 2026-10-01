import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Landmark, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { AccountSelect } from '@/components/payroll/AccountSelect';
import { useBusinessLoans, useReceiveLoan, useRecordOwnerMoney, useRepayLoan, type BusinessLoan } from '@/hooks/useFinance';
import { getApiErrorMessage } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

const today = () => new Date().toISOString().slice(0, 10);

/** Owner money in/out and business loans. None of it is profit or loss. */
export function OwnerLoansTab({ canManage }: { canManage: boolean }) {
  const { data, isLoading } = useBusinessLoans();
  const [owner, setOwner] = useState<'in' | 'out' | null>(null);
  const [newLoan, setNewLoan] = useState(false);
  const [repaying, setRepaying] = useState<BusinessLoan | null>(null);
  const loans = data?.data ?? [];
  const owed = loans.filter((l) => l.status === 'active').reduce((sum, l) => sum + l.outstanding, 0);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h3 className="font-bold">Owner money</h3>
          <p className="text-sm text-muted-foreground">Money you put into the business or take out for yourself. Shows in cash flow, never as profit or cost.</p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setOwner('in')}><ArrowDownLeft className="h-4 w-4" /> Put money in</Button>
            <Button variant="outline" onClick={() => setOwner('out')}><ArrowUpRight className="h-4 w-4" /> Take money out</Button>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-bold">Business loans</h3>
            <p className="text-sm text-muted-foreground">Repayments are split: principal reduces the loan, interest is a cost in profit & loss.</p>
          </div>
          <div className="flex items-center gap-3">
            {owed > 0 ? <span className="text-sm text-muted-foreground">Still owed <span className="font-bold text-foreground">{formatCurrency(owed)}</span></span> : null}
            {canManage ? <Button onClick={() => setNewLoan(true)}><Plus className="h-4 w-4" /> Loan received</Button> : null}
          </div>
        </div>
        {isLoading ? <Skeleton className="h-32 rounded-3xl" /> : loans.length === 0 ? (
          <div className="rounded-3xl border border-dashed p-8 text-center">
            <Landmark className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No loans recorded.</p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {loans.map((loan) => {
              const pct = loan.principal ? Math.round((loan.principalRepaid / loan.principal) * 100) : 0;
              return (
                <div key={loan.id} className="space-y-3 rounded-3xl border border-border p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold">{loan.lender}</p>
                      <p className="text-sm text-muted-foreground">{loan.loanCode} · received {new Date(loan.receivedDate).toLocaleDateString()}{loan.interestRate != null ? ` · ${loan.interestRate}% a year` : ''}</p>
                    </div>
                    <Badge variant={loan.status === 'active' ? 'info' : 'success'}>{loan.status === 'active' ? 'Repaying' : 'Repaid'}</Badge>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm">
                      <span><span className="font-bold tabular-nums">{formatCurrency(loan.outstanding)}</span> <span className="text-muted-foreground">left of {formatCurrency(loan.principal)}</span></span>
                      <span className="text-muted-foreground">Interest paid {formatCurrency(loan.interestPaid)}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Repaid">
                      <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  {canManage && loan.status === 'active' ? <Button size="sm" variant="outline" onClick={() => setRepaying(loan)}>Record repayment</Button> : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {owner ? <OwnerMoneyDialog direction={owner} onClose={() => setOwner(null)} /> : null}
      {newLoan ? <LoanDialog onClose={() => setNewLoan(false)} /> : null}
      {repaying ? <RepayDialog loan={repaying} onClose={() => setRepaying(null)} /> : null}
    </div>
  );
}

function OwnerMoneyDialog({ direction, onClose }: { direction: 'in' | 'out'; onClose: () => void }) {
  const save = useRecordOwnerMoney();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [accountId, setAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const value = Number(amount) || 0;
  const submit = async () => {
    try {
      await save.mutateAsync({ direction, amount: value, date, financeAccountId: Number(accountId), notes: notes.trim() || null });
      toast.success(direction === 'in' ? 'Owner money in recorded' : 'Drawings recorded');
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not record it'));
    }
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{direction === 'in' ? 'Put money in' : 'Take money out'}</DialogTitle>
          <DialogDescription>{direction === 'in' ? 'Recorded as Owner Capital Introduced.' : 'Recorded as Owner Drawings.'}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2"><Label htmlFor="om-amt">Amount</Label><Input id="om-amt" type="number" inputMode="decimal" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="grid gap-2"><Label htmlFor="om-date">Date</Label><Input id="om-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
          <div className="grid gap-2"><Label htmlFor="om-acc">{direction === 'in' ? 'Paid into' : 'Paid from'}</Label><AccountSelect id="om-acc" value={accountId} onChange={setAccountId} /></div>
          <div className="grid gap-2"><Label htmlFor="om-notes">Notes</Label><Textarea id="om-notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!accountId || value <= 0 || save.isPending}>Record</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LoanDialog({ onClose }: { onClose: () => void }) {
  const save = useReceiveLoan();
  const [form, setForm] = useState({ lender: '', principal: '', receivedDate: today(), accountId: '', interestRate: '', termMonths: '', monthlyInstallment: '', notes: '' });
  const set = (key: keyof typeof form) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const principal = Number(form.principal) || 0;
  const num = (v: string) => (v.trim() ? Number(v) : null);
  const submit = async () => {
    try {
      await save.mutateAsync({ lender: form.lender.trim(), principal, receivedDate: form.receivedDate, financeAccountId: Number(form.accountId), interestRate: num(form.interestRate), termMonths: num(form.termMonths), monthlyInstallment: num(form.monthlyInstallment), notes: form.notes.trim() || null });
      toast.success('Loan recorded and money added to the account');
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not record the loan'));
    }
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Loan received</DialogTitle>
          <DialogDescription>The amount goes into the account as Loan Received.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2"><Label htmlFor="ln-lender">Lender</Label><Input id="ln-lender" value={form.lender} onChange={(e) => set('lender')(e.target.value)} placeholder="e.g. People's Bank" /></div>
          <div className="grid gap-2"><Label htmlFor="ln-p">Amount</Label><Input id="ln-p" type="number" inputMode="decimal" min="0" value={form.principal} onChange={(e) => set('principal')(e.target.value)} /></div>
          <div className="grid gap-2"><Label htmlFor="ln-d">Received on</Label><Input id="ln-d" type="date" value={form.receivedDate} onChange={(e) => set('receivedDate')(e.target.value)} /></div>
          <div className="grid gap-2 sm:col-span-2"><Label htmlFor="ln-a">Paid into</Label><AccountSelect id="ln-a" value={form.accountId} onChange={set('accountId')} /></div>
          <div className="grid gap-2"><Label htmlFor="ln-r">Interest % a year <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="ln-r" type="number" inputMode="decimal" min="0" step="0.1" value={form.interestRate} onChange={(e) => set('interestRate')(e.target.value)} /></div>
          <div className="grid gap-2"><Label htmlFor="ln-t">Term (months)</Label><Input id="ln-t" type="number" inputMode="numeric" min="1" value={form.termMonths} onChange={(e) => set('termMonths')(e.target.value)} /></div>
          <div className="grid gap-2 sm:col-span-2"><Label htmlFor="ln-n">Notes</Label><Textarea id="ln-n" value={form.notes} onChange={(e) => set('notes')(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!form.lender.trim() || principal <= 0 || !form.accountId || save.isPending}>Record {principal ? formatCurrency(principal) : ''}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RepayDialog({ loan, onClose }: { loan: BusinessLoan; onClose: () => void }) {
  const save = useRepayLoan();
  const [principal, setPrincipal] = useState(loan.monthlyInstallment ? String(Math.max(0, Math.min(loan.outstanding, loan.monthlyInstallment - loan.suggestedInterest))) : '');
  const [interest, setInterest] = useState(loan.suggestedInterest ? String(loan.suggestedInterest) : '0');
  const [date, setDate] = useState(today());
  const [accountId, setAccountId] = useState('');
  const p = Number(principal) || 0;
  const i = Number(interest) || 0;
  const submit = async () => {
    try {
      await save.mutateAsync({ id: loan.id, paymentDate: date, principalAmount: p, interestAmount: i, financeAccountId: Number(accountId) });
      toast.success('Repayment recorded');
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not record the repayment'));
    }
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Repay {loan.lender}</DialogTitle>
          <DialogDescription>{formatCurrency(loan.outstanding)} principal left.{loan.suggestedInterest ? ` One month's interest at ${loan.interestRate}% is about ${formatCurrency(loan.suggestedInterest)}.` : ''}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2"><Label htmlFor="rp-p">Principal</Label><Input id="rp-p" type="number" inputMode="decimal" min="0" value={principal} onChange={(e) => setPrincipal(e.target.value)} /></div>
            <div className="grid gap-2"><Label htmlFor="rp-i">Interest</Label><Input id="rp-i" type="number" inputMode="decimal" min="0" value={interest} onChange={(e) => setInterest(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2"><Label htmlFor="rp-d">Paid on</Label><Input id="rp-d" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="grid gap-2"><Label htmlFor="rp-a">Paid from</Label><AccountSelect id="rp-a" value={accountId} onChange={setAccountId} /></div>
          </div>
          <p className="rounded-2xl bg-panel p-3 text-sm">Total paid <span className="font-bold">{formatCurrency(p + i)}</span></p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!accountId || p + i <= 0 || p > loan.outstanding || save.isPending}>Record</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
