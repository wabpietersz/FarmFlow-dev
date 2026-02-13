import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import {
  usePayroll, useUpdatePayrollStatus,
  useAddDeduction, useRemoveDeduction,
  useAddAllowance, useRemoveAllowance,
} from '@/hooks/usePayroll';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  deductionFormSchema, allowanceFormSchema,
  type DeductionFormValues, type AllowanceFormValues,
} from '@/lib/validations/payroll';
import { ArrowLeft, Plus, Trash2, Banknote, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';

const PAYROLL_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  reviewed: 'bg-blue-100 text-blue-800',
  approved: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
};

const NEXT_STATUS_LABELS: Record<string, { label: string; action: string }> = {
  draft: { label: 'reviewed', action: 'Mark as Reviewed' },
  reviewed: { label: 'approved', action: 'Approve' },
  approved: { label: 'paid', action: 'Mark as Paid' },
};

export default function PayrollDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuthStore();
  const { data, isLoading } = usePayroll(id);
  const updateStatusMutation = useUpdatePayrollStatus(id!);
  const addDeductionMutation = useAddDeduction(id!);
  const removeDeductionMutation = useRemoveDeduction(id!);
  const addAllowanceMutation = useAddAllowance(id!);
  const removeAllowanceMutation = useRemoveAllowance(id!);

  const [showAddDeduction, setShowAddDeduction] = useState(false);
  const [showAddAllowance, setShowAddAllowance] = useState(false);

  const payroll = data?.data;
  const deductions = payroll?.deductions ?? [];
  const allowances = payroll?.allowances ?? [];
  const totalDeductions = payroll?.totalDeductions ?? 0;
  const totalAllowances = payroll?.totalAllowances ?? 0;

  const deductionForm = useForm<DeductionFormValues>({
    resolver: zodResolver(deductionFormSchema),
    defaultValues: { deductionType: '', amount: 0, remarks: '' },
  });

  const allowanceForm = useForm<AllowanceFormValues>({
    resolver: zodResolver(allowanceFormSchema),
    defaultValues: { allowanceType: '', amount: 0, remarks: '' },
  });

  const handleAdvanceStatus = async () => {
    if (!payroll) return;
    const next = NEXT_STATUS_LABELS[payroll.status];
    if (!next) return;

    try {
      await updateStatusMutation.mutateAsync({ status: next.label });
      toast.success(`Payroll status updated to ${next.label}`);
    } catch {
      toast.error('Failed to update payroll status');
    }
  };

  const handleAddDeduction = async (values: DeductionFormValues) => {
    try {
      await addDeductionMutation.mutateAsync(values);
      toast.success('Deduction added');
      deductionForm.reset();
      setShowAddDeduction(false);
    } catch {
      toast.error('Failed to add deduction');
    }
  };

  const handleRemoveDeduction = async (deductionId: number) => {
    try {
      await removeDeductionMutation.mutateAsync(deductionId);
      toast.success('Deduction removed');
    } catch {
      toast.error('Failed to remove deduction');
    }
  };

  const handleAddAllowance = async (values: AllowanceFormValues) => {
    try {
      await addAllowanceMutation.mutateAsync(values);
      toast.success('Allowance added');
      allowanceForm.reset();
      setShowAddAllowance(false);
    } catch {
      toast.error('Failed to add allowance');
    }
  };

  const handleRemoveAllowance = async (allowanceId: number) => {
    try {
      await removeAllowanceMutation.mutateAsync(allowanceId);
      toast.success('Allowance removed');
    } catch {
      toast.error('Failed to remove allowance');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!payroll) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-medium">Payroll record not found</h2>
        <Button asChild variant="link">
          <Link to="/payroll">Back to Payroll</Link>
        </Button>
      </div>
    );
  }

  const canEdit = payroll.status === 'draft' || payroll.status === 'reviewed';
  const nextStatus = NEXT_STATUS_LABELS[payroll.status];
  const overtimePay = Number(payroll.overtimeHours ?? 0) * Number(payroll.overtimeRate ?? 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link to="/payroll"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">
            {payroll.employeeName ?? 'Employee'}
          </h1>
          <p className="text-muted-foreground">
            {payroll.designation ?? ''} — {new Date(payroll.payPeriod).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
          </p>
        </div>
        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium capitalize ${PAYROLL_STATUS_COLORS[payroll.status] ?? ''}`}>
          {payroll.status}
        </span>
        {hasPermission('payroll:update') && nextStatus && (
          <Button onClick={handleAdvanceStatus} disabled={updateStatusMutation.isPending}>
            {updateStatusMutation.isPending ? 'Updating...' : nextStatus.action}
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Banknote className="h-4 w-4" />
              Base Salary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(Number(payroll.baseSalary))}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {payroll.attendedDays}/{payroll.workingDays} days worked
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Overtime
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(overtimePay)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {Number(payroll.overtimeHours ?? 0)}h @ Rs. {Number(payroll.overtimeRate ?? 0)}/hr
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Gross Salary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(Number(payroll.grossSalary))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Net Salary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(Number(payroll.netSalary))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Allowances */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Allowances ({formatCurrency(totalAllowances)})</CardTitle>
          {hasPermission('payroll:update') && canEdit && (
            <Button size="sm" onClick={() => { allowanceForm.reset(); setShowAddAllowance(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Allowance
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {allowances.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No allowances added.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Remarks</TableHead>
                  {canEdit && hasPermission('payroll:update') && <TableHead className="w-[50px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {allowances.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.allowanceType}</TableCell>
                    <TableCell>{formatCurrency(Number(a.amount))}</TableCell>
                    <TableCell className="text-muted-foreground">{a.remarks ?? '--'}</TableCell>
                    {canEdit && hasPermission('payroll:update') && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveAllowance(a.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Deductions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Deductions ({formatCurrency(totalDeductions)})</CardTitle>
          {hasPermission('payroll:update') && canEdit && (
            <Button size="sm" onClick={() => { deductionForm.reset(); setShowAddDeduction(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Deduction
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {deductions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No deductions added.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Remarks</TableHead>
                  {canEdit && hasPermission('payroll:update') && <TableHead className="w-[50px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {deductions.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.deductionType}</TableCell>
                    <TableCell>{formatCurrency(Number(d.amount))}</TableCell>
                    <TableCell className="text-muted-foreground">{d.remarks ?? '--'}</TableCell>
                    {canEdit && hasPermission('payroll:update') && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveDeduction(d.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payroll Info */}
      {payroll.paidDate && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Paid on {new Date(payroll.paidDate).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      )}

      {payroll.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{payroll.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Add Deduction Dialog */}
      <Dialog open={showAddDeduction} onOpenChange={setShowAddDeduction}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Deduction</DialogTitle>
            <DialogDescription>Add a deduction to this payroll record.</DialogDescription>
          </DialogHeader>
          <Form {...deductionForm}>
            <form onSubmit={deductionForm.handleSubmit(handleAddDeduction)} className="space-y-4">
              <FormField
                control={deductionForm.control}
                name="deductionType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deduction Type</FormLabel>
                    <FormControl><Input placeholder="e.g. Tax, Insurance, Loan EMI" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={deductionForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (Rs.)</FormLabel>
                    <FormControl><Input type="number" step="0.01" placeholder="e.g. 500" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={deductionForm.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Remarks (Optional)</FormLabel>
                    <FormControl><Input placeholder="Optional remarks" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAddDeduction(false)}>Cancel</Button>
                <Button type="submit" disabled={addDeductionMutation.isPending}>
                  {addDeductionMutation.isPending ? 'Adding...' : 'Add Deduction'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add Allowance Dialog */}
      <Dialog open={showAddAllowance} onOpenChange={setShowAddAllowance}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Allowance</DialogTitle>
            <DialogDescription>Add an allowance to this payroll record.</DialogDescription>
          </DialogHeader>
          <Form {...allowanceForm}>
            <form onSubmit={allowanceForm.handleSubmit(handleAddAllowance)} className="space-y-4">
              <FormField
                control={allowanceForm.control}
                name="allowanceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Allowance Type</FormLabel>
                    <FormControl><Input placeholder="e.g. HRA, Medical, Bonus" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={allowanceForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (Rs.)</FormLabel>
                    <FormControl><Input type="number" step="0.01" placeholder="e.g. 1000" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={allowanceForm.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Remarks (Optional)</FormLabel>
                    <FormControl><Input placeholder="Optional remarks" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAddAllowance(false)}>Cancel</Button>
                <Button type="submit" disabled={addAllowanceMutation.isPending}>
                  {addAllowanceMutation.isPending ? 'Adding...' : 'Add Allowance'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
