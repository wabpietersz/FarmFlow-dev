import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import {
  usePayroll, useUpdatePayrollStatus,
  useAddDeduction, useRemoveDeduction,
  useAddAllowance, useRemoveAllowance,
  useDeletePayroll,
  useCompensationTemplates,
  useCreateCompensationTemplate,
  useDeleteCompensationTemplate,
} from '@/hooks/usePayroll';
import { useChequeLeaves, useTreasuryAccounts } from '@/hooks/useTreasury';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  deductionFormSchema, allowanceFormSchema,
  type DeductionFormValues, type AllowanceFormValues,
} from '@/lib/validations/payroll';
import { ArrowLeft, Plus, Trash2, Banknote, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { parseApiError } from '@/lib/api';

const PAYROLL_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-foreground',
  reviewed: 'bg-info-soft text-info',
  approved: 'bg-warning-soft text-warning',
  paid: 'bg-success-soft text-success',
};

const NEXT_STATUS_LABELS: Record<string, { label: string; action: string }> = {
  draft: { label: 'reviewed', action: 'Mark as Reviewed' },
  reviewed: { label: 'approved', action: 'Approve' },
  approved: { label: 'paid', action: 'Mark as Paid' },
};

export default function PayrollDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();
  const { data, isLoading } = usePayroll(id);
  const updateStatusMutation = useUpdatePayrollStatus(id!);
  const deletePayrollMutation = useDeletePayroll();
  const addDeductionMutation = useAddDeduction(id!);
  const removeDeductionMutation = useRemoveDeduction(id!);
  const addAllowanceMutation = useAddAllowance(id!);
  const removeAllowanceMutation = useRemoveAllowance(id!);
  const { data: deductionTemplatesData } = useCompensationTemplates('deduction');
  const { data: allowanceTemplatesData } = useCompensationTemplates('allowance');
  const { data: allTemplatesData } = useCompensationTemplates();
  const { data: treasuryAccountsData } = useTreasuryAccounts();
  const createTemplateMutation = useCreateCompensationTemplate();
  const deleteTemplateMutation = useDeleteCompensationTemplate();

  const [showAddDeduction, setShowAddDeduction] = useState(false);
  const [showAddAllowance, setShowAddAllowance] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMarkPaidDialog, setShowMarkPaidDialog] = useState(false);
  const [selectedFinanceAccountId, setSelectedFinanceAccountId] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'bank_transfer' | 'cash' | 'cheque'>('bank_transfer');
  const [selectedChequeLeafId, setSelectedChequeLeafId] = useState('');
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateCategory, setNewTemplateCategory] = useState<'allowance' | 'deduction'>('allowance');
  const [newTemplateDefaultAmount, setNewTemplateDefaultAmount] = useState<number>(0);
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const { data: chequeLeavesData } = useChequeLeaves({
    accountId: selectedFinanceAccountId ? Number(selectedFinanceAccountId) : undefined,
    status: 'available',
  });

  const payroll = data?.data;
  const deductionTemplates = deductionTemplatesData?.data ?? [];
  const allowanceTemplates = allowanceTemplatesData?.data ?? [];
  const allTemplates = allTemplatesData?.data ?? [];
  const deductions = payroll?.deductions ?? [];
  const allowances = payroll?.allowances ?? [];
  const totalDeductions = payroll?.totalDeductions ?? 0;
  const totalAllowances = payroll?.totalAllowances ?? 0;
  const treasuryAccounts = (treasuryAccountsData?.data ?? []).filter((account) => account.status === 'active');
  const availableChequeLeaves = (chequeLeavesData?.data ?? []).filter((leaf) => leaf.status === 'available');

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

    if (next.label === 'paid') {
      setShowMarkPaidDialog(true);
      return;
    }

    try {
      await updateStatusMutation.mutateAsync({ status: next.label });
      toast.success(`Payroll status updated to ${next.label}`);
    } catch (error) {
      parseApiError(error, 'Failed to update payroll status');
    }
  };

  const handleMarkPaid = async () => {
    if (!selectedFinanceAccountId) {
      toast.error('Select the treasury account used for this payroll payout');
      return;
    }
    if (selectedPaymentMethod === 'cheque' && !selectedChequeLeafId) {
      toast.error('Select the cheque leaf used for this payroll payout');
      return;
    }

    try {
      await updateStatusMutation.mutateAsync({
        status: 'paid',
        financeAccountId: Number(selectedFinanceAccountId),
        paymentMethod: selectedPaymentMethod,
        chequeLeafId: selectedPaymentMethod === 'cheque' ? Number(selectedChequeLeafId) : undefined,
      });
      toast.success('Payroll marked as paid and posted to treasury');
      setShowMarkPaidDialog(false);
      setSelectedFinanceAccountId('');
      setSelectedPaymentMethod('bank_transfer');
      setSelectedChequeLeafId('');
    } catch (error) {
      parseApiError(error, 'Failed to mark payroll as paid');
    }
  };

  const handleDeletePayroll = async () => {
    if (!payroll) return;

    try {
      await deletePayrollMutation.mutateAsync(payroll.id);
      toast.success('Payroll deleted');
      setShowDeleteConfirm(false);
      navigate('/payroll');
    } catch (error) {
      parseApiError(error, 'Failed to delete payroll');
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

  const handleDeductionTemplateSelect = (templateId: string) => {
    if (templateId === 'custom') return;
    const template = deductionTemplates.find((item) => String(item.id) === templateId);
    if (!template) return;
    deductionForm.setValue('deductionType', template.name);
    if (template.defaultAmount !== null && template.defaultAmount !== undefined) {
      deductionForm.setValue('amount', Number(template.defaultAmount));
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

  const handleAllowanceTemplateSelect = (templateId: string) => {
    if (templateId === 'custom') return;
    const template = allowanceTemplates.find((item) => String(item.id) === templateId);
    if (!template) return;
    allowanceForm.setValue('allowanceType', template.name);
    if (template.defaultAmount !== null && template.defaultAmount !== undefined) {
      allowanceForm.setValue('amount', Number(template.defaultAmount));
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

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast.error('Template name is required');
      return;
    }

    try {
      await createTemplateMutation.mutateAsync({
        name: newTemplateName.trim(),
        category: newTemplateCategory,
        defaultAmount: newTemplateDefaultAmount > 0 ? newTemplateDefaultAmount : undefined,
        description: newTemplateDescription.trim() || undefined,
      });
      toast.success('Template created');
      setNewTemplateName('');
      setNewTemplateDefaultAmount(0);
      setNewTemplateDescription('');
    } catch {
      toast.error('Failed to create template');
    }
  };

  const handleDeactivateTemplate = async (templateId: number) => {
    try {
      await deleteTemplateMutation.mutateAsync(templateId);
      toast.success('Template deactivated');
    } catch {
      toast.error('Failed to deactivate template');
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
  const proRatedBase = payroll.workingDays > 0
    ? (Number(payroll.baseSalary) / Number(payroll.workingDays)) * Number(payroll.attendedDays)
    : 0;
  const compensationSnapshot = (payroll.compensationSnapshot ?? null) as {
    revisionId: number;
    payType: string;
    baseRate: number;
    overtimeRate: number;
    standardHoursPerDay: number;
    effectiveFrom: string;
    effectiveTo?: string | null;
    components?: Array<{
      id: number;
      componentType: string;
      name: string;
      calculationType: string;
      value: number;
      calculatedAmount: number;
    }>;
  } | null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link to="/payroll"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            {payroll.employeeName ?? 'Employee'}
          </h1>
          <p className="text-muted-foreground">
            {payroll.designation ?? ''} — {new Date(payroll.payPeriod).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
          </p>
        </div>
        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium capitalize ${PAYROLL_STATUS_COLORS[payroll.status] ?? ''}`}>
          {payroll.status}
        </span>
        {hasPermission('payroll:update') && (
          <Button variant="outline" onClick={() => setShowTemplateManager(true)}>
            Manage Templates
          </Button>
        )}
        {hasPermission('payroll:update') && nextStatus && (
          <Button onClick={handleAdvanceStatus} disabled={updateStatusMutation.isPending}>
            {updateStatusMutation.isPending ? 'Updating...' : nextStatus.action}
          </Button>
        )}
        {hasPermission('payroll:delete') && payroll.status === 'draft' && (
          <Button
            type="button"
            variant="destructive"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deletePayrollMutation.isPending}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {deletePayrollMutation.isPending ? 'Deleting...' : 'Delete Draft'}
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
            <p className="text-2xl font-bold text-success">
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Treasury Posting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {payroll.treasuryTransactionId ? (
            <>
              <p className="font-medium text-foreground">
                Paid payroll is posted into Treasury.
              </p>
              <p className="text-muted-foreground">
                Treasury transaction #{payroll.treasuryTransactionId} was posted from{' '}
                {payroll.financeAccountName || (payroll.financeAccountId ? `account #${payroll.financeAccountId}` : 'an unassigned account')} on{' '}
                {payroll.paidDate ? new Date(payroll.paidDate).toLocaleDateString() : '--'}.
              </p>
              <p className="text-muted-foreground">
                Method: {payroll.paymentMethod ? payroll.paymentMethod.replace('_', ' ') : '--'}
                {payroll.chequeNumber ? ` • Cheque ${payroll.chequeNumber}` : payroll.chequeLeafId ? ` • Leaf #${payroll.chequeLeafId}` : ''}
              </p>
            </>
          ) : payroll.status === 'approved' ? (
            <p className="text-muted-foreground">
              When this payroll is marked as paid, you must choose the treasury account used for the payout so the farm cash position is updated immediately.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Treasury posting becomes available when this payroll reaches the approved stage.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Payroll Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 text-sm">
          <p><span className="text-muted-foreground">Pay Period:</span> {new Date(payroll.payPeriod).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</p>
          <p><span className="text-muted-foreground">Base Salary Input:</span> {formatCurrency(Number(payroll.baseSalary))}</p>
          <p><span className="text-muted-foreground">Prorated Base:</span> {formatCurrency(proRatedBase)}</p>
          <p><span className="text-muted-foreground">Working Days:</span> {Number(payroll.workingDays)}</p>
          <p><span className="text-muted-foreground">Attended Days:</span> {Number(payroll.attendedDays).toFixed(1)}</p>
          <p><span className="text-muted-foreground">Overtime Hours:</span> {Number(payroll.overtimeHours ?? 0).toFixed(2)}</p>
          <p><span className="text-muted-foreground">Overtime Rate:</span> {formatCurrency(Number(payroll.overtimeRate ?? 0))}</p>
          <p><span className="text-muted-foreground">Allowances Total:</span> {formatCurrency(totalAllowances)}</p>
          <p><span className="text-muted-foreground">Deductions Total:</span> {formatCurrency(totalDeductions)}</p>
          <p><span className="text-muted-foreground">Treasury Account:</span> {payroll.financeAccountName || (payroll.financeAccountId ? `Account #${payroll.financeAccountId}` : '--')}</p>
          <p><span className="text-muted-foreground">Payment Method:</span> {payroll.paymentMethod ? payroll.paymentMethod.replace('_', ' ') : '--'}</p>
          <p><span className="text-muted-foreground">Cheque:</span> {payroll.chequeNumber || (payroll.chequeLeafId ? `Leaf #${payroll.chequeLeafId}` : '--')}</p>
        </CardContent>
      </Card>

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
                          <Trash2 className="h-4 w-4 text-danger" />
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
                          <Trash2 className="h-4 w-4 text-danger" />
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
      {compensationSnapshot && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Compensation Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <p><span className="text-muted-foreground">Revision:</span> #{compensationSnapshot.revisionId}</p>
              <p className="capitalize"><span className="text-muted-foreground">Pay Type:</span> {compensationSnapshot.payType}</p>
              <p><span className="text-muted-foreground">Base Rate:</span> {formatCurrency(Number(compensationSnapshot.baseRate))}</p>
              <p><span className="text-muted-foreground">OT Rate:</span> {formatCurrency(Number(compensationSnapshot.overtimeRate))}</p>
              <p><span className="text-muted-foreground">Hours/Day:</span> {Number(compensationSnapshot.standardHoursPerDay).toFixed(2)}</p>
              <p><span className="text-muted-foreground">Effective:</span> {new Date(compensationSnapshot.effectiveFrom).toLocaleDateString()}</p>
            </div>
            {(compensationSnapshot.components?.length ?? 0) > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Calc</TableHead>
                    <TableHead>Applied</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {compensationSnapshot.components!.map((component) => (
                    <TableRow key={component.id}>
                      <TableCell>{component.name}</TableCell>
                      <TableCell className="capitalize">{component.componentType}</TableCell>
                      <TableCell className="capitalize">{component.calculationType}</TableCell>
                      <TableCell>{formatCurrency(Number(component.calculatedAmount))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

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
              <FormItem>
                <FormLabel>Template (Optional)</FormLabel>
                <Select onValueChange={handleDeductionTemplateSelect}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a template or continue with custom entry" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="custom">Custom</SelectItem>
                    {deductionTemplates.map((template) => (
                      <SelectItem key={template.id} value={String(template.id)}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
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
              <FormItem>
                <FormLabel>Template (Optional)</FormLabel>
                <Select onValueChange={handleAllowanceTemplateSelect}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a template or continue with custom entry" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="custom">Custom</SelectItem>
                    {allowanceTemplates.map((template) => (
                      <SelectItem key={template.id} value={String(template.id)}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
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

      <Dialog open={showTemplateManager} onOpenChange={setShowTemplateManager}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Compensation Templates</DialogTitle>
            <DialogDescription>Create and manage allowance/deduction templates.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Input
                placeholder="Template name"
                value={newTemplateName}
                onChange={(event) => setNewTemplateName(event.target.value)}
              />
              <Select
                value={newTemplateCategory}
                onValueChange={(value: 'allowance' | 'deduction') => setNewTemplateCategory(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="allowance">Allowance</SelectItem>
                  <SelectItem value="deduction">Deduction</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                step="0.01"
                placeholder="Default amount"
                value={newTemplateDefaultAmount}
                onChange={(event) => setNewTemplateDefaultAmount(Number(event.target.value))}
              />
              <Button onClick={handleCreateTemplate} disabled={createTemplateMutation.isPending}>
                {createTemplateMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </div>
            <Input
              placeholder="Description (optional)"
              value={newTemplateDescription}
              onChange={(event) => setNewTemplateDescription(event.target.value)}
            />

            {allTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No templates configured.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Default</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allTemplates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell className="capitalize">{template.category}</TableCell>
                      <TableCell>
                        {template.defaultAmount !== null && template.defaultAmount !== undefined
                          ? formatCurrency(Number(template.defaultAmount))
                          : '--'}
                      </TableCell>
                      <TableCell>{template.isActive ? 'Active' : 'Inactive'}</TableCell>
                      <TableCell>
                        {template.isActive && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeactivateTemplate(template.id)}
                            disabled={deleteTemplateMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-danger" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Delete Draft Payroll?</DialogTitle>
            <DialogDescription>
              This will permanently delete this draft payroll for <span className="font-medium text-foreground">{payroll.employeeName ?? 'the selected employee'}</span>.
              Draft allowances, deductions, and notes will be removed and cannot be recovered.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deletePayrollMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDeletePayroll()}
              disabled={deletePayrollMutation.isPending}
            >
              {deletePayrollMutation.isPending ? 'Deleting...' : 'Delete Draft'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMarkPaidDialog} onOpenChange={setShowMarkPaidDialog}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Mark Payroll as Paid</DialogTitle>
            <DialogDescription>
              Select the treasury account used for this salary payout. This will immediately post the outflow into Treasury.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <FormLabel>Treasury Account</FormLabel>
            <Select value={selectedFinanceAccountId} onValueChange={setSelectedFinanceAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select treasury account" />
              </SelectTrigger>
              <SelectContent>
                {treasuryAccounts.map((account) => (
                  <SelectItem key={account.id} value={String(account.id)}>
                    {account.accountName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {treasuryAccounts.length === 0 ? (
              <p className="text-xs text-destructive">
                No active treasury accounts are available. Create one in Treasury before marking payroll as paid.
              </p>
            ) : null}
            <FormLabel className="pt-2">Payment Method</FormLabel>
            <Select
              value={selectedPaymentMethod}
              onValueChange={(value: 'bank_transfer' | 'cash' | 'cheque') => {
                setSelectedPaymentMethod(value);
                if (value !== 'cheque') {
                  setSelectedChequeLeafId('');
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
            {selectedPaymentMethod === 'cheque' ? (
              <>
                <FormLabel className="pt-2">Cheque Leaf</FormLabel>
                <Select value={selectedChequeLeafId} onValueChange={setSelectedChequeLeafId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select available cheque leaf" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableChequeLeaves.map((leaf) => (
                      <SelectItem key={leaf.id} value={String(leaf.id)}>
                        {leaf.chequeNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {availableChequeLeaves.length === 0 ? (
                  <p className="text-xs text-destructive">
                    No available cheque leaves were found for the selected account. Create a cheque book in Treasury first.
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowMarkPaidDialog(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleMarkPaid()}
              disabled={updateStatusMutation.isPending || treasuryAccounts.length === 0}
            >
              {updateStatusMutation.isPending ? 'Posting...' : 'Post to Treasury'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
