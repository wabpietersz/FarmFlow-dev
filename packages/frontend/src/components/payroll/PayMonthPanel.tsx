import { useState } from 'react';
import { Banknote, Download, FileText, Landmark } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow, TableActionsHead, TableActionsCell } from '@/components/ui/table';
import { usePayPeriod, usePayrollRegister } from '@/hooks/usePayroll';
import { getApiErrorMessage } from '@/lib/api';
import { downloadCsv, generatePayslipsPDF } from '@/lib/generatePayslips';
import { formatCurrency } from '@/lib/utils';
import { AccountSelect } from './AccountSelect';
import { RowActions } from '@/components/ui/row-actions';
import { StatusBadge } from '@/components/ui/status-badge';

/** The month at a glance: register, pay everyone, bank transfer list, payslips. */
export function PayMonthPanel({ month, canPay }: { month: string; canPay: boolean }) {
  const navigate = useNavigate();
  const { data, isLoading } = usePayrollRegister(month);
  const [paying, setPaying] = useState(false);
  const register = data?.data;
  const rows = register?.rows ?? [];
  const approved = rows.filter((row) => row.status === 'approved');
  const bankRows = rows.filter((row) => row.status === 'approved' || row.status === 'paid');

  const exportRegister = () => downloadCsv(`Payroll-register-${month}.csv`,
    ['Employee', 'EPF No', 'Designation', 'Farm', 'Cost centre', 'Days', 'Basic', 'Overtime', 'Allowances', 'Gross', 'EPF employee', 'Other deductions', 'Loan recovery', 'Net pay', 'EPF employer', 'ETF', 'Status'],
    rows.map((r) => [r.employeeName, r.epfNumber, r.designation, r.siteName, r.costCentreName, `${r.attendedDays}/${r.workingDays}`, r.basicEarned, r.overtimePay,
      r.allowances.reduce((s, a) => s + a.amount, 0), r.grossSalary, r.epfEmployee, r.otherDeductions, r.loanRecovery, r.netSalary, r.epfEmployer, r.etfEmployer, r.status]));

  const exportBankList = () => {
    const missing = bankRows.filter((r) => !r.accountNumber);
    if (missing.length) toast.warning(`${missing.length} employee${missing.length === 1 ? ' has' : 's have'} no bank details: ${missing.slice(0, 3).map((r) => r.employeeName).join(', ')}`);
    downloadCsv(`Bank-transfer-list-${month}.csv`,
      ['Account holder', 'Bank', 'Branch code', 'Account number', 'Amount', 'Reference'],
      bankRows.filter((r) => r.accountNumber).map((r) => [r.accountHolderName ?? r.employeeName, r.bankName, r.branchCode, r.accountNumber, r.netSalary.toFixed(2), `Salary ${month}`]));
  };

  if (isLoading) return <Skeleton className="h-64 rounded-3xl" />;
  if (!register || rows.length === 0) {
    return <p className="rounded-3xl border border-dashed p-8 text-center text-sm text-muted-foreground">No payroll for this month yet. Generate it from Pay runs.</p>;
  }
  const t = register.totals;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Gross pay', t.grossSalary, `${t.employees} employee${t.employees === 1 ? '' : 's'}`],
          ['Net pay', t.netSalary, `after EPF ${formatCurrency(t.epfEmployee)} and ${formatCurrency(t.otherDeductions + t.loanRecovery)} other deductions`],
          ['Employer EPF + ETF', t.epfEmployer + t.etfEmployer, 'paid with the monthly return'],
          ['Total labour cost', t.employerCost, 'gross + employer EPF/ETF'],
        ].map(([label, value, hint]) => (
          <div key={label as string} className="rounded-3xl bg-panel p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-xl font-extrabold tabular-nums">{formatCurrency(value as number)}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {canPay ? (
          <Button onClick={() => setPaying(true)} disabled={approved.length === 0} title={approved.length === 0 ? 'Approve payroll first' : undefined}>
            <Banknote className="h-4 w-4" /> Pay {approved.length} approved
          </Button>
        ) : null}
        <Button variant="outline" onClick={exportBankList} disabled={bankRows.length === 0}><Landmark className="h-4 w-4" /> Bank transfer list</Button>
        <Button variant="outline" onClick={() => generatePayslipsPDF(register.payPeriod, rows)}><FileText className="h-4 w-4" /> All payslips (PDF)</Button>
        <Button variant="outline" onClick={exportRegister}><Download className="h-4 w-4" /> Register (CSV)</Button>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-border">
        <Table className="min-w-[1000px]">
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead className="text-right">EPF</TableHead>
              <TableHead className="text-right">Other</TableHead>
              <TableHead className="text-right">Advances</TableHead>
              <TableHead className="text-right">Net pay</TableHead>
              <TableHead className="text-right">Employer EPF/ETF</TableHead>
              <TableHead>Status</TableHead>
              <TableActionsHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.payrollId} onOpen={() => navigate(`/payroll/${row.payrollId}`)}>
                <TableCell>
                  <p className="font-semibold">{row.employeeName}</p>
                  <p className="text-xs text-muted-foreground">{row.designation} · {row.costCentreName ?? row.siteName ?? '—'}{row.epfNumber ? ` · EPF ${row.epfNumber}` : ''}</p>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(row.grossSalary)}</TableCell>
                <TableCell className="text-right tabular-nums">{row.epfEmployee ? formatCurrency(row.epfEmployee) : '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{row.otherDeductions ? formatCurrency(row.otherDeductions) : '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{row.loanRecovery ? formatCurrency(row.loanRecovery) : '—'}</TableCell>
                <TableCell className="text-right font-bold tabular-nums">{formatCurrency(row.netSalary)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{row.epfEmployer + row.etfEmployer ? formatCurrency(row.epfEmployer + row.etfEmployer) : '—'}</TableCell>
                <TableCell><StatusBadge status={row.status} tone={row.status === 'approved' ? 'warning' : undefined} /></TableCell>
                <TableActionsCell>
                  <RowActions
                    label={`payslip for ${row.employeeName}`}
                    open={`/payroll/${row.payrollId}`}
                    actions={[{ label: 'Download payslip', icon: FileText, onSelect: () => generatePayslipsPDF(register.payPeriod, [row]) }]}
                  />
                </TableActionsCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-bold">Total</TableCell>
              <TableCell className="text-right font-bold tabular-nums">{formatCurrency(t.grossSalary)}</TableCell>
              <TableCell className="text-right font-bold tabular-nums">{formatCurrency(t.epfEmployee)}</TableCell>
              <TableCell className="text-right font-bold tabular-nums">{formatCurrency(t.otherDeductions)}</TableCell>
              <TableCell className="text-right font-bold tabular-nums">{formatCurrency(t.loanRecovery)}</TableCell>
              <TableCell className="text-right font-bold tabular-nums">{formatCurrency(t.netSalary)}</TableCell>
              <TableCell className="text-right font-bold tabular-nums">{formatCurrency(t.epfEmployer + t.etfEmployer)}</TableCell>
              <TableCell colSpan={2} />
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      {paying ? <PayMonthDialog month={month} count={approved.length} total={approved.reduce((s, r) => s + r.netSalary, 0)} onClose={() => setPaying(false)} /> : null}
    </div>
  );
}

function PayMonthDialog({ month, count, total, onClose }: { month: string; count: number; total: number; onClose: () => void }) {
  const pay = usePayPeriod();
  const [accountId, setAccountId] = useState('');
  const [method, setMethod] = useState<'bank_transfer' | 'cash'>('bank_transfer');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));

  const submit = async () => {
    try {
      const result = await pay.mutateAsync({ payPeriod: month, financeAccountId: Number(accountId), paymentMethod: method, payDate });
      toast.success(`Paid ${result.data?.paid ?? 0} employees · ${formatCurrency(result.data?.total ?? 0)}`);
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not pay the month'));
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Pay {count} employee{count === 1 ? '' : 's'}</DialogTitle>
          <DialogDescription>{formatCurrency(total)} net pay. Each payslip is posted to Money: wages, EPF withheld and advances recovered. All are paid, or none.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2"><Label htmlFor="pm-account">Pay from</Label><AccountSelect id="pm-account" value={accountId} onChange={setAccountId} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>How</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as 'bank_transfer' | 'cash')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="bank_transfer">Bank transfer</SelectItem><SelectItem value="cash">Cash</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label htmlFor="pm-date">Pay date</Label><Input id="pm-date" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!accountId || pay.isPending}>Pay {formatCurrency(total)}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
