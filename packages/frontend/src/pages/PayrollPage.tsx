import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useEmployees } from '@/hooks/useEmployees';
import {
  usePayrolls,
  useCreatePayroll,
  useGeneratePayroll,
  usePayrollGeneratePrecheck,
  usePayrollPreview,
  useDeletePayroll,
  useStatutoryRates,
  type PayrollGenerateResponse,
  type PayrollPrecheckResponse,
  type PayrollPreviewRow,
} from '@/hooks/usePayroll';
import type { PayrollAllowanceInput, PayrollDeductionInput } from '@farmflow/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Eye, Banknote, AlertTriangle, Trash2, CalendarDays, HandCoins, Landmark, ListChecks, type LucideIcon } from 'lucide-react';
import { PayMonthPanel } from '@/components/payroll/PayMonthPanel';
import { calculateRowTotals } from '@/lib/payrollPreview';
import { LoansPanel } from '@/components/payroll/LoansPanel';
import { StatutoryPanel } from '@/components/payroll/StatutoryPanel';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { parseApiError } from '@/lib/api';

const PAYROLL_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-foreground',
  reviewed: 'bg-info-soft text-info',
  approved: 'bg-warning-soft text-warning',
  paid: 'bg-success-soft text-success',
};

type EditableAllowance = PayrollAllowanceInput & { included: boolean };
type EditableDeduction = PayrollDeductionInput & { included: boolean };

type EditablePayrollRow = Omit<PayrollPreviewRow, 'allowances' | 'deductions' | 'notes'> & {
  selected: boolean;
  baseSalary: number;
  workingDays: number;
  attendedDays: number;
  overtimeHours: number;
  overtimeRate: number;
  notes: string;
  allowances: EditableAllowance[];
  deductions: EditableDeduction[];
};

function getCurrentMonthValue() {
  return new Date().toISOString().slice(0, 7);
}

function monthToPayPeriod(month: string) {
  if (!month || month.length !== 7) return new Date().toISOString().slice(0, 7) + '-01';
  return `${month}-01`;
}

function hasExistingPayrollWarning(row: Pick<PayrollPreviewRow, 'warnings'>) {
  return (row.warnings ?? []).some((warning) => warning.code === 'PAYROLL_ALREADY_EXISTS');
}

function toEditableRow(row: PayrollPreviewRow): EditablePayrollRow {
  return {
    ...row,
    selected: !hasExistingPayrollWarning(row),
    baseSalary: Number(row.baseSalary ?? 0),
    workingDays: Number(row.workingDays ?? 0),
    attendedDays: Number(row.attendedDays ?? row.workingDays ?? 0),
    overtimeHours: Number(row.overtimeHours ?? 0),
    overtimeRate: Number(row.overtimeRate ?? 0),
    notes: row.notes ?? '',
    allowances: (row.allowances ?? []).map((allowance) => ({
      ...allowance,
      amount: Number(allowance.amount ?? 0),
      included: allowance.included !== false,
    })),
    deductions: (row.deductions ?? []).map((deduction) => ({
      ...deduction,
      amount: Number(deduction.amount ?? 0),
      included: deduction.included !== false,
    })),
  };
}

const PAYROLL_VIEWS: Array<{ key: string; label: string; icon: LucideIcon }> = [
  { key: 'runs', label: 'Pay runs', icon: ListChecks },
  { key: 'month', label: 'Month & payslips', icon: CalendarDays },
  { key: 'loans', label: 'Advances & loans', icon: HandCoins },
  { key: 'epf', label: 'EPF / ETF', icon: Landmark },
];

export default function PayrollPage() {
  const { hasPermission } = useAuthStore();
  const epfRate = useStatutoryRates().data?.data?.epfEmployeeRate ?? 8;

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');
  const activeStatusTab = statusFilter || 'all';
  const [params, setParams] = useSearchParams();
  const view = params.get('view') ?? 'runs';
  /** The month panels need a month: the period filter, else this month */
  const panelMonth = periodFilter || getCurrentMonthValue();

  const [showCreatePayroll, setShowCreatePayroll] = useState(false);
  const [showGeneratePayroll, setShowGeneratePayroll] = useState(false);

  const [singleEmployeeId, setSingleEmployeeId] = useState<string>('');
  const [singleMonth, setSingleMonth] = useState(getCurrentMonthValue());
  const [singleRow, setSingleRow] = useState<EditablePayrollRow | null>(null);

  const [bulkMonth, setBulkMonth] = useState(getCurrentMonthValue());
  const [bulkRows, setBulkRows] = useState<EditablePayrollRow[]>([]);
  const [deletingPayrollId, setDeletingPayrollId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; employeeName: string } | null>(null);

  const [precheckResult, setPrecheckResult] = useState<PayrollPrecheckResponse | null>(null);
  const [generateResult, setGenerateResult] = useState<PayrollGenerateResponse | null>(null);

  const {
    data: payrollData,
    isLoading,
    isError: payrollError,
    refetch: refetchPayroll,
  } = usePayrolls({
    page,
    limit: 20,
    status: statusFilter || undefined,
    payPeriodMonth: periodFilter || undefined,
  });

  const {
    data: employeesData,
    isError: employeesError,
    isLoading: employeesLoading,
  } = useEmployees({ limit: 500, status: 'active' });

  const previewMutation = usePayrollPreview();
  const createPayrollMutation = useCreatePayroll();
  const generatePayrollMutation = useGeneratePayroll();
  const precheckMutation = usePayrollGeneratePrecheck();
  const deletePayrollMutation = useDeletePayroll();

  const payrollList = payrollData?.data ?? [];
  const total = payrollData?.total ?? 0;
  const totalPages = payrollData?.totalPages ?? 0;

  const activeEmployees = (Array.isArray(employeesData?.data) ? employeesData.data : []) as Array<{
    id: number;
    firstName: string;
    lastName: string;
    hasCompensation?: boolean;
  }>;

  const employeeSelectPlaceholder = employeesError
    ? 'Failed to load employees'
    : employeesLoading
      ? 'Loading employees...'
      : activeEmployees.length === 0
        ? 'No active employees found'
        : 'Select employee';

  const selectableBulkRows = bulkRows.filter((row) => !hasExistingPayrollWarning(row));
  const selectedBulkCount = selectableBulkRows.filter((row) => row.selected).length;

  const bulkTotals = useMemo(() => {
    return bulkRows
      .filter((row) => row.selected)
      .reduce((acc, row) => {
        const totals = calculateRowTotals(row, epfRate);
        return {
          gross: acc.gross + totals.gross,
          net: acc.net + totals.net,
        };
      }, { gross: 0, net: 0 });
  }, [bulkRows]);

  const loadBulkPreview = async (month: string) => {
    try {
      const payPeriod = monthToPayPeriod(month);
      const result = await previewMutation.mutateAsync({ payPeriod });
      setBulkRows((result.data?.rows ?? []).map(toEditableRow));
      setPrecheckResult(null);
      setGenerateResult(null);
    } catch (error) {
      parseApiError(error, 'Failed to load payroll preview');
      setBulkRows([]);
    }
  };

  const loadSinglePreview = async (employeeId: number, month: string) => {
    try {
      const payPeriod = monthToPayPeriod(month);
      const result = await previewMutation.mutateAsync({ payPeriod, employeeId });
      const row = result.data?.rows?.[0];
      setSingleRow(row ? toEditableRow(row) : null);
    } catch (error) {
      parseApiError(error, 'Failed to load employee payroll defaults');
      setSingleRow(null);
    }
  };

  useEffect(() => {
    if (!showCreatePayroll || !singleEmployeeId) return;
    void loadSinglePreview(Number(singleEmployeeId), singleMonth);
  }, [showCreatePayroll, singleEmployeeId, singleMonth]);

  const updateBulkRow = (employeeId: number, updater: (row: EditablePayrollRow) => EditablePayrollRow) => {
    setBulkRows((rows) => rows.map((row) => (row.employeeId === employeeId ? updater(row) : row)));
  };

  const updateSingleRow = (updater: (row: EditablePayrollRow) => EditablePayrollRow) => {
    setSingleRow((existing) => (existing ? updater(existing) : existing));
  };

  const handleRunPrecheck = async () => {
    try {
      const result = await precheckMutation.mutateAsync({ payPeriod: monthToPayPeriod(bulkMonth) });
      if (!result.data) {
        throw new Error('PRECHECK_EMPTY');
      }
      setPrecheckResult(result.data);
      toast.success('Pre-check completed');
    } catch (error) {
      parseApiError(error, 'Failed to run pre-check');
      setPrecheckResult(null);
    }
  };

  const handleGeneratePayroll = async () => {
    const selectedRows = bulkRows.filter((row) => row.selected && !hasExistingPayrollWarning(row));
    if (selectedRows.length === 0) {
      toast.error('Select at least one employee row to generate payroll');
      return;
    }

    try {
      const result = await generatePayrollMutation.mutateAsync({
        payPeriod: monthToPayPeriod(bulkMonth),
        entries: selectedRows.map((row) => ({
          employeeId: row.employeeId,
          baseSalary: Number(row.baseSalary),
          workingDays: Number(row.workingDays),
          attendedDays: Number(row.attendedDays),
          overtimeHours: Number(row.overtimeHours),
          overtimeRate: Number(row.overtimeRate),
          notes: row.notes || undefined,
          allowances: row.allowances.map((allowance) => ({
            allowanceType: allowance.allowanceType,
            amount: Number(allowance.amount),
            remarks: allowance.remarks,
            included: allowance.included,
          })),
          deductions: row.deductions.map((deduction) => ({
            deductionType: deduction.deductionType,
            amount: Number(deduction.amount),
            remarks: deduction.remarks,
            included: deduction.included,
          })),
          compensationRevisionId: row.compensationRevisionId,
        })),
      });

      setGenerateResult(result);
      const totalGenerated = result.total ?? 0;
      const skipped = result.meta?.skipped ?? 0;
      const warningCount = result.meta?.warningCount ?? 0;
      if (warningCount > 0 || skipped > 0) {
        toast.warning(`Generated ${totalGenerated}. Skipped ${skipped}. Warnings ${warningCount}.`);
      } else {
        toast.success(`Generated ${totalGenerated} payroll records`);
      }
      setShowGeneratePayroll(false);
      setBulkRows([]);
      await refetchPayroll();
    } catch (error) {
      parseApiError(error, 'Failed to generate payroll');
    }
  };

  const handleCreatePayroll = async () => {
    if (!singleRow) {
      toast.error('Load payroll defaults for an employee first');
      return;
    }
    if (hasExistingPayrollWarning(singleRow)) {
      toast.error('Payroll already exists for this employee in the selected period');
      return;
    }

    try {
      await createPayrollMutation.mutateAsync({
        employeeId: singleRow.employeeId,
        payPeriod: monthToPayPeriod(singleMonth),
        baseSalary: Number(singleRow.baseSalary),
        workingDays: Number(singleRow.workingDays),
        attendedDays: Number(singleRow.attendedDays),
        overtimeHours: Number(singleRow.overtimeHours),
        overtimeRate: Number(singleRow.overtimeRate),
        notes: singleRow.notes || undefined,
        allowances: singleRow.allowances.map((allowance) => ({
          allowanceType: allowance.allowanceType,
          amount: Number(allowance.amount),
          remarks: allowance.remarks,
          included: allowance.included,
        })),
        deductions: singleRow.deductions.map((deduction) => ({
          deductionType: deduction.deductionType,
          amount: Number(deduction.amount),
          remarks: deduction.remarks,
          included: deduction.included,
        })),
        compensationRevisionId: singleRow.compensationRevisionId,
      });

      toast.success('Payroll created');
      setShowCreatePayroll(false);
      setSingleEmployeeId('');
      setSingleRow(null);
      await refetchPayroll();
    } catch (error) {
      parseApiError(error, 'Failed to create payroll');
    }
  };

  const handleDeletePayroll = async (payrollId: number) => {
    try {
      setDeletingPayrollId(payrollId);
      await deletePayrollMutation.mutateAsync(payrollId);
      toast.success('Payroll deleted');
      await refetchPayroll();
      setDeleteTarget(null);
    } catch (error) {
      parseApiError(error, 'Failed to delete payroll');
    } finally {
      setDeletingPayrollId(null);
    }
  };

  const openGenerateDialog = () => {
    setShowGeneratePayroll(true);
    void loadBulkPreview(bulkMonth);
  };

  const openCreateDialog = () => {
    setShowCreatePayroll(true);
    setSingleEmployeeId('');
    setSingleRow(null);
  };

  const firstGenerateWarnings = (generateResult?.meta?.warnings ?? []).slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Payroll</h1>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <span className="text-sm text-muted-foreground">Period</span>
            <Input
              type="month"
              value={view === 'runs' ? periodFilter : panelMonth}
              onChange={(event) => {
                setPeriodFilter(event.target.value);
                setPage(1);
              }}
              className="w-full sm:w-[180px]"
            />
            {periodFilter && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setPeriodFilter('')}>
                Clear
              </Button>
            )}
          </div>
          {hasPermission('payroll:create') && (
            <>
              <Button variant="outline" onClick={openGenerateDialog}>
                Generate Payroll
              </Button>
              <Button
                onClick={openCreateDialog}
                disabled={employeesError || employeesLoading || activeEmployees.length === 0}
              >
                <Plus className="h-4 w-4 mr-2" />
                New Payroll
              </Button>
            </>
          )}
        </div>
      </div>

      <nav aria-label="Payroll sections" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:px-0">
        {PAYROLL_VIEWS.map((section) => (
          <button
            key={section.key}
            type="button"
            aria-current={view === section.key ? 'page' : undefined}
            onClick={() => setParams({ view: section.key }, { replace: true })}
            className={cn(
              'flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors',
              view === section.key ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            <section.icon className="h-4 w-4" />
            {section.label}
          </button>
        ))}
      </nav>

      {view === 'month' ? <PayMonthPanel month={panelMonth} canPay={hasPermission('payroll:update')} /> : null}
      {view === 'loans' ? <LoansPanel canIssue={hasPermission('payroll:create')} canWriteOff={hasPermission('payroll:approve')} /> : null}
      {view === 'epf' ? <StatutoryPanel month={panelMonth} canPay={hasPermission('payroll:update')} /> : null}

      {view === 'runs' ? (
      <Tabs value={activeStatusTab} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
        <div className="sm:hidden">
          <Select
            value={activeStatusTab}
            onValueChange={(v) => {
              setStatusFilter(v === 'all' ? '' : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filter payroll status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="hidden sm:block">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="paid">Paid</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={activeStatusTab}>
          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : payrollError ? (
                <div className="text-center py-12 space-y-3">
                  <Banknote className="h-12 w-12 text-danger mx-auto" />
                  <h3 className="text-lg font-medium text-foreground mb-1">Failed to load payroll records</h3>
                  <p className="text-sm text-muted-foreground">Please retry. If this persists, check API permissions and server logs.</p>
                  <Button variant="outline" onClick={() => { void refetchPayroll(); }}>
                    Retry
                  </Button>
                </div>
              ) : payrollList.length === 0 ? (
                <div className="text-center py-12">
                  <Banknote className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-1">No payroll records</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {statusFilter || periodFilter ? 'No records for this filter.' : 'Generate or create payroll records to get started.'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table className="min-w-[980px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Pay Period</TableHead>
                          <TableHead>Days</TableHead>
                          <TableHead>Overtime</TableHead>
                          <TableHead>Allowances</TableHead>
                          <TableHead>Deductions</TableHead>
                          <TableHead>Gross</TableHead>
                          <TableHead>Net</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[50px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payrollList.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell className="font-medium">{record.employeeName ?? '--'}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(record.payPeriod).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {Number(record.attendedDays).toFixed(1)}/{record.workingDays}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {Number(record.overtimeHours ?? 0)}h @ {formatCurrency(Number(record.overtimeRate ?? 0))}
                            </TableCell>
                            <TableCell>{formatCurrency(Number(record.totalAllowances ?? 0))}</TableCell>
                            <TableCell>{formatCurrency(Number(record.totalDeductions ?? 0))}</TableCell>
                            <TableCell>{formatCurrency(Number(record.grossSalary))}</TableCell>
                            <TableCell className="font-medium">{formatCurrency(Number(record.netSalary))}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize ${PAYROLL_STATUS_COLORS[record.status] ?? ''}`}>
                                {record.status}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button asChild variant="ghost" size="icon">
                                  <Link to={`/payroll/${record.id}`}><Eye className="h-4 w-4" /></Link>
                                </Button>
                                {hasPermission('payroll:delete') && record.status === 'draft' && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setDeleteTarget({
                                      id: record.id,
                                      employeeName: record.employeeName ?? `Employee ${record.employeeId}`,
                                    })}
                                    disabled={deletePayrollMutation.isPending && deletingPayrollId === record.id}
                                  >
                                    <Trash2 className="h-4 w-4 text-danger" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of {total}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      ) : null}

      <Dialog
        open={showGeneratePayroll}
        onOpenChange={(open) => {
          setShowGeneratePayroll(open);
          if (!open) {
            setBulkRows([]);
            setPrecheckResult(null);
            setGenerateResult(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[1200px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate Payroll</DialogTitle>
            <DialogDescription>
              Select month, review employee lines, adjust values, then generate draft payroll records.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="month"
              value={bulkMonth}
              onChange={(event) => setBulkMonth(event.target.value)}
              className="w-full sm:w-[180px]"
            />
            <Button type="button" variant="outline" onClick={() => { void loadBulkPreview(bulkMonth); }} disabled={previewMutation.isPending}>
              {previewMutation.isPending ? 'Loading...' : 'Reload Rows'}
            </Button>
            <Button type="button" variant="outline" onClick={handleRunPrecheck} disabled={precheckMutation.isPending}>
              <AlertTriangle className="mr-2 h-4 w-4" />
              {precheckMutation.isPending ? 'Checking...' : 'Run Pre-check'}
            </Button>
            <p className="text-sm text-muted-foreground ml-auto">
              Selected {selectedBulkCount} | Gross {formatCurrency(bulkTotals.gross)} | Net {formatCurrency(bulkTotals.net)}
            </p>
          </div>

          {precheckResult && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              Total {precheckResult.summary.totalEmployees} | Warnings {precheckResult.summary.warningEmployees} | Blocking {precheckResult.summary.errorEmployees}
            </div>
          )}

          {generateResult && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-2">
              <p>Generated {generateResult.total} | Skipped {generateResult.meta?.skipped ?? 0} | Warnings {generateResult.meta?.warningCount ?? 0}</p>
              {firstGenerateWarnings.length > 0 && (
                <div className="space-y-1">
                  {firstGenerateWarnings.map((warning, index) => (
                    <div key={`${warning.employeeId}-${warning.code}-${index}`} className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{warning.employeeName}</span>: {warning.code} - {warning.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="overflow-x-auto border rounded-md">
            <Table className="min-w-[1200px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[48px]">
                    <Checkbox
                      checked={selectableBulkRows.length > 0 && selectableBulkRows.every((row) => row.selected)}
                      onCheckedChange={(checked) => {
                        const value = Boolean(checked);
                        setBulkRows((rows) => rows.map((row) => ({
                          ...row,
                          selected: hasExistingPayrollWarning(row) ? false : value,
                        })));
                      }}
                    />
                  </TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Base Salary</TableHead>
                  <TableHead>Working Days</TableHead>
                  <TableHead>Overtime (hrs/rate)</TableHead>
                  <TableHead>Allowances (include)</TableHead>
                  <TableHead>Deductions</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>EPF / advances</TableHead>
                  <TableHead>Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bulkRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-6">
                      {previewMutation.isPending ? 'Loading preview rows...' : 'No employees available for selected month.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  bulkRows.map((row) => {
                    const totals = calculateRowTotals(row, epfRate);
                    return (
                      <TableRow key={row.employeeId}>
                        <TableCell>
                          <Checkbox
                            checked={row.selected}
                            disabled={hasExistingPayrollWarning(row)}
                            onCheckedChange={(checked) => updateBulkRow(row.employeeId, (current) => ({ ...current, selected: Boolean(checked) }))}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{row.employeeName}</div>
                          {hasExistingPayrollWarning(row) && (
                            <p className="text-xs text-danger">Payroll already exists for this period.</p>
                          )}
                          {!row.hasCompensation && (
                            <p className="text-xs text-warning">Compensation not setup; manual values required.</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={row.baseSalary}
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              updateBulkRow(row.employeeId, (current) => ({ ...current, baseSalary: Number.isFinite(value) ? value : 0 }));
                            }}
                            className="w-[130px]"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            step="1"
                            value={row.workingDays}
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              updateBulkRow(row.employeeId, (current) => ({ ...current, workingDays: Number.isFinite(value) ? value : 0, attendedDays: Number.isFinite(value) ? value : 0 }));
                            }}
                            className="w-[100px]"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <Input
                              type="number"
                              min={0}
                              step="0.5"
                              value={row.overtimeHours}
                              onChange={(event) => {
                                const value = Number(event.target.value);
                                updateBulkRow(row.employeeId, (current) => ({ ...current, overtimeHours: Number.isFinite(value) ? value : 0 }));
                              }}
                              className="w-[110px]"
                            />
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={row.overtimeRate}
                              onChange={(event) => {
                                const value = Number(event.target.value);
                                updateBulkRow(row.employeeId, (current) => ({ ...current, overtimeRate: Number.isFinite(value) ? value : 0 }));
                              }}
                              className="w-[110px]"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2 min-w-[220px]">
                            {row.allowances.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No recurring allowances</p>
                            ) : row.allowances.map((allowance, index) => (
                              <div key={`${row.employeeId}-allowance-${index}`} className="flex items-center gap-2">
                                <Checkbox
                                  checked={allowance.included}
                                  onCheckedChange={(checked) => {
                                    const value = Boolean(checked);
                                    updateBulkRow(row.employeeId, (current) => ({
                                      ...current,
                                      allowances: current.allowances.map((item, itemIndex) => itemIndex === index
                                        ? { ...item, included: value }
                                        : item),
                                    }));
                                  }}
                                />
                                <span className="text-xs truncate flex-1">{allowance.allowanceType}</span>
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={allowance.amount}
                                  onChange={(event) => {
                                    const value = Number(event.target.value);
                                    updateBulkRow(row.employeeId, (current) => ({
                                      ...current,
                                      allowances: current.allowances.map((item, itemIndex) => itemIndex === index
                                        ? { ...item, amount: Number.isFinite(value) ? value : 0 }
                                        : item),
                                    }));
                                  }}
                                  className="h-8 w-[92px]"
                                />
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2 min-w-[220px]">
                            {row.deductions.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No recurring deductions</p>
                            ) : row.deductions.map((deduction, index) => (
                              <div key={`${row.employeeId}-deduction-${index}`} className="flex items-center gap-2">
                                <Checkbox
                                  checked={deduction.included}
                                  onCheckedChange={(checked) => {
                                    const value = Boolean(checked);
                                    updateBulkRow(row.employeeId, (current) => ({
                                      ...current,
                                      deductions: current.deductions.map((item, itemIndex) => itemIndex === index
                                        ? { ...item, included: value }
                                        : item),
                                    }));
                                  }}
                                />
                                <span className="text-xs truncate flex-1">{deduction.deductionType}</span>
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={deduction.amount}
                                  onChange={(event) => {
                                    const value = Number(event.target.value);
                                    updateBulkRow(row.employeeId, (current) => ({
                                      ...current,
                                      deductions: current.deductions.map((item, itemIndex) => itemIndex === index
                                        ? { ...item, amount: Number.isFinite(value) ? value : 0 }
                                        : item),
                                    }));
                                  }}
                                  className="h-8 w-[92px]"
                                />
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={row.notes}
                            placeholder="Optional note"
                            onChange={(event) => updateBulkRow(row.employeeId, (current) => ({ ...current, notes: event.target.value }))}
                            className="w-[180px]"
                          />
                        </TableCell>
                        <TableCell>{formatCurrency(totals.gross)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {totals.epf > 0 ? formatCurrency(totals.epf) : '—'}
                          {totals.loan > 0 ? <span className="block text-xs">+ {formatCurrency(totals.loan)} advance</span> : null}
                        </TableCell>
                        <TableCell className="font-medium">{formatCurrency(totals.net)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowGeneratePayroll(false)}>Close</Button>
            <Button type="button" onClick={handleGeneratePayroll} disabled={generatePayrollMutation.isPending || selectedBulkCount === 0}>
              {generatePayrollMutation.isPending ? 'Generating...' : `Generate ${selectedBulkCount} Payroll${selectedBulkCount === 1 ? '' : 's'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreatePayroll} onOpenChange={setShowCreatePayroll}>
        <DialogContent className="sm:max-w-[920px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Payroll</DialogTitle>
            <DialogDescription>Create a single payroll record with the same editable logic as bulk generation.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Employee</p>
              <Select
                value={singleEmployeeId || undefined}
                onValueChange={(value) => {
                  setSingleEmployeeId(value);
                  void loadSinglePreview(Number(value), singleMonth);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={employeeSelectPlaceholder} />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-[300px]">
                  {activeEmployees.map((emp) => (
                    <SelectItem key={emp.id} value={String(emp.id)}>
                      {emp.firstName} {emp.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Pay Period</p>
              <Input
                type="month"
                value={singleMonth}
                onChange={(event) => setSingleMonth(event.target.value)}
              />
            </div>
          </div>

          {!singleRow ? (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">
              Select employee and month to load payroll defaults.
            </div>
          ) : (
            <div className="space-y-4">
              {!singleRow.hasCompensation && (
                <div className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning">
                  Compensation is not setup for this employee. You can still create payroll with manual values.
                </div>
              )}
              {hasExistingPayrollWarning(singleRow) && (
                <div className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
                  Payroll already exists for this employee in the selected pay period.
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Base Salary</p>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={singleRow.baseSalary}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      updateSingleRow((row) => ({ ...row, baseSalary: Number.isFinite(value) ? value : 0 }));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Working Days</p>
                  <Input
                    type="number"
                    min={0}
                    step="1"
                    value={singleRow.workingDays}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      updateSingleRow((row) => ({ ...row, workingDays: Number.isFinite(value) ? value : 0, attendedDays: Number.isFinite(value) ? value : 0 }));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Overtime Hours</p>
                  <Input
                    type="number"
                    min={0}
                    step="0.5"
                    value={singleRow.overtimeHours}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      updateSingleRow((row) => ({ ...row, overtimeHours: Number.isFinite(value) ? value : 0 }));
                    }}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Overtime Rate (Rs./hr)</p>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={singleRow.overtimeRate}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      updateSingleRow((row) => ({ ...row, overtimeRate: Number.isFinite(value) ? value : 0 }));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Note</p>
                  <Input
                    value={singleRow.notes}
                    placeholder="Optional note"
                    onChange={(event) => updateSingleRow((row) => ({ ...row, notes: event.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardContent className="pt-4 space-y-2">
                    <p className="text-sm font-medium">Allowances</p>
                    {singleRow.allowances.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No recurring allowances</p>
                    ) : singleRow.allowances.map((allowance, index) => (
                      <div key={`single-allowance-${index}`} className="flex items-center gap-2">
                        <Checkbox
                          checked={allowance.included}
                          onCheckedChange={(checked) => {
                            const value = Boolean(checked);
                            updateSingleRow((row) => ({
                              ...row,
                              allowances: row.allowances.map((item, itemIndex) => itemIndex === index
                                ? { ...item, included: value }
                                : item),
                            }));
                          }}
                        />
                        <span className="text-sm flex-1">{allowance.allowanceType}</span>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={allowance.amount}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            updateSingleRow((row) => ({
                              ...row,
                              allowances: row.allowances.map((item, itemIndex) => itemIndex === index
                                ? { ...item, amount: Number.isFinite(value) ? value : 0 }
                                : item),
                            }));
                          }}
                          className="h-8 w-[110px]"
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4 space-y-2">
                    <p className="text-sm font-medium">Deductions</p>
                    {singleRow.deductions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No recurring deductions</p>
                    ) : singleRow.deductions.map((deduction, index) => (
                      <div key={`single-deduction-${index}`} className="flex items-center gap-2">
                        <Checkbox
                          checked={deduction.included}
                          onCheckedChange={(checked) => {
                            const value = Boolean(checked);
                            updateSingleRow((row) => ({
                              ...row,
                              deductions: row.deductions.map((item, itemIndex) => itemIndex === index
                                ? { ...item, included: value }
                                : item),
                            }));
                          }}
                        />
                        <span className="text-sm flex-1">{deduction.deductionType}</span>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={deduction.amount}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            updateSingleRow((row) => ({
                              ...row,
                              deductions: row.deductions.map((item, itemIndex) => itemIndex === index
                                ? { ...item, amount: Number.isFinite(value) ? value : 0 }
                                : item),
                            }));
                          }}
                          className="h-8 w-[110px]"
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {(() => {
                const totals = calculateRowTotals(singleRow, epfRate);
                return (
                  <div className="rounded-md border p-3 text-sm flex flex-wrap gap-6">
                    <p>Gross: <span className="font-medium">{formatCurrency(totals.gross)}</span></p>
                    <p>Net: <span className="font-medium">{formatCurrency(totals.net)}</span></p>
                    <p>Allowances: <span className="font-medium">{formatCurrency(totals.allowanceTotal)}</span></p>
                    <p>Deductions: <span className="font-medium">{formatCurrency(totals.deductionTotal)}</span></p>
                    {totals.epf > 0 ? <p>EPF ({epfRate}%): <span className="font-medium">{formatCurrency(totals.epf)}</span></p> : null}
                    {totals.loan > 0 ? <p>Advance/loan: <span className="font-medium">{formatCurrency(totals.loan)}</span></p> : null}
                  </div>
                );
              })()}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowCreatePayroll(false)}>Cancel</Button>
            <Button
              type="button"
              onClick={handleCreatePayroll}
              disabled={createPayrollMutation.isPending || !singleRow || hasExistingPayrollWarning(singleRow)}
            >
              {createPayrollMutation.isPending ? 'Creating...' : 'Create Payroll'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Delete Draft Payroll?</DialogTitle>
            <DialogDescription>
              This will permanently delete the draft payroll record for <span className="font-medium text-foreground">{deleteTarget?.employeeName}</span>.
              Included allowances, deductions, and notes in this draft will also be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deletePayrollMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (!deleteTarget) return;
                void handleDeletePayroll(deleteTarget.id);
              }}
              disabled={deletePayrollMutation.isPending}
            >
              {deletePayrollMutation.isPending ? 'Deleting...' : 'Delete Draft'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
