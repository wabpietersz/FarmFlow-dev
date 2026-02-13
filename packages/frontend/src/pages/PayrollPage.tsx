import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useEmployees } from '@/hooks/useEmployees';
import { usePayrolls, useCreatePayroll, useGeneratePayroll } from '@/hooks/usePayroll';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  payrollFormSchema, generatePayrollFormSchema,
  type PayrollFormValues, type GeneratePayrollFormValues,
} from '@/lib/validations/payroll';
import { Plus, Eye, Banknote } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';

const PAYROLL_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  reviewed: 'bg-blue-100 text-blue-800',
  approved: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
};

export default function PayrollPage() {
  const { hasPermission } = useAuthStore();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreatePayroll, setShowCreatePayroll] = useState(false);
  const [showGeneratePayroll, setShowGeneratePayroll] = useState(false);

  const { data: payrollData, isLoading } = usePayrolls({
    page,
    limit: 20,
    status: statusFilter || undefined,
  });
  const { data: employeesData, isError: employeesError } = useEmployees({ limit: 200, status: 'active' });

  const createPayrollMutation = useCreatePayroll();
  const generatePayrollMutation = useGeneratePayroll();

  const payrollList = payrollData?.data ?? [];
  const total = payrollData?.total ?? 0;
  const totalPages = payrollData?.totalPages ?? 0;
  const activeEmployees = (Array.isArray(employeesData?.data) ? employeesData.data : []) as unknown as Array<{ id: number; firstName: string; lastName: string; [key: string]: unknown }>;

  const payrollForm = useForm<PayrollFormValues>({
    resolver: zodResolver(payrollFormSchema),
    defaultValues: {
      employeeId: undefined,
      payPeriod: new Date().toISOString().slice(0, 7) + '-01',
      baseSalary: 0,
      workingDays: 22,
      overtimeHours: 0,
      overtimeRate: 0,
      notes: '',
    },
  });

  const generateForm = useForm<GeneratePayrollFormValues>({
    resolver: zodResolver(generatePayrollFormSchema),
    defaultValues: {
      payPeriod: new Date().toISOString().slice(0, 7) + '-01',
      workingDays: 22,
    },
  });

  const handleCreatePayroll = async (values: PayrollFormValues) => {
    try {
      await createPayrollMutation.mutateAsync({
        ...values,
        notes: values.notes || undefined,
      });
      toast.success('Payroll created');
      payrollForm.reset();
      setShowCreatePayroll(false);
    } catch {
      toast.error('Failed to create payroll');
    }
  };

  const handleGeneratePayroll = async (values: GeneratePayrollFormValues) => {
    try {
      const result = await generatePayrollMutation.mutateAsync(values);
      toast.success(`Generated ${(result as unknown as { total: number }).total ?? 0} payroll records`);
      generateForm.reset();
      setShowGeneratePayroll(false);
    } catch {
      toast.error('Failed to generate payroll');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Payroll</h1>
        <div className="flex gap-2">
          {hasPermission('payroll:create') && (
            <>
              <Button variant="outline" onClick={() => setShowGeneratePayroll(true)}>
                Generate Payroll
              </Button>
              <Button onClick={() => setShowCreatePayroll(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Payroll
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs defaultValue="all" onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
        </TabsList>

        <TabsContent value={statusFilter || 'all'}>
          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : payrollList.length === 0 ? (
                <div className="text-center py-12">
                  <Banknote className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-1">No payroll records</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {statusFilter ? 'No records with this status.' : 'Generate or create payroll records to get started.'}
                  </p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Pay Period</TableHead>
                        <TableHead className="hidden sm:table-cell">Base Salary</TableHead>
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
                          <TableCell className="hidden sm:table-cell">
                            {formatCurrency(Number(record.baseSalary))}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(Number(record.grossSalary))}
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(Number(record.netSalary))}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize ${PAYROLL_STATUS_COLORS[record.status] ?? ''}`}>
                              {record.status}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button asChild variant="ghost" size="icon">
                              <Link to={`/payroll/${record.id}`}><Eye className="h-4 w-4" /></Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="flex items-center justify-between pt-4">
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

      {/* Create Payroll Dialog */}
      <Dialog open={showCreatePayroll} onOpenChange={setShowCreatePayroll}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Payroll</DialogTitle>
            <DialogDescription>Create a payroll record for an individual employee.</DialogDescription>
          </DialogHeader>
          <Form {...payrollForm}>
            <form onSubmit={payrollForm.handleSubmit(handleCreatePayroll)} className="space-y-4">
              <FormField
                control={payrollForm.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee</FormLabel>
                    <Select value={field.value ? String(field.value) : undefined} onValueChange={(v) => field.onChange(Number(v))}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder={employeesError ? 'Failed to load employees' : activeEmployees.length === 0 ? 'Loading employees...' : 'Select employee'} /></SelectTrigger>
                      </FormControl>
                      <SelectContent position="popper" className="max-h-[300px]">
                        {activeEmployees.map((emp) => (
                          <SelectItem key={emp.id} value={String(emp.id)}>
                            {emp.firstName} {emp.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={payrollForm.control}
                name="payPeriod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pay Period (first of month)</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={payrollForm.control}
                  name="baseSalary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Salary (Rs.)</FormLabel>
                      <FormControl><Input type="number" step="0.01" placeholder="e.g. 15000" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={payrollForm.control}
                  name="workingDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Working Days</FormLabel>
                      <FormControl><Input type="number" placeholder="e.g. 22" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={payrollForm.control}
                  name="overtimeHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Overtime Hours</FormLabel>
                      <FormControl><Input type="number" step="0.5" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={payrollForm.control}
                  name="overtimeRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Overtime Rate (Rs./hr)</FormLabel>
                      <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={payrollForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl><Textarea placeholder="Any notes..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreatePayroll(false)}>Cancel</Button>
                <Button type="submit" disabled={createPayrollMutation.isPending}>
                  {createPayrollMutation.isPending ? 'Creating...' : 'Create Payroll'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Generate Payroll Dialog */}
      <Dialog open={showGeneratePayroll} onOpenChange={setShowGeneratePayroll}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Generate Payroll</DialogTitle>
            <DialogDescription>Generate draft payroll records for all active employees.</DialogDescription>
          </DialogHeader>
          <Form {...generateForm}>
            <form onSubmit={generateForm.handleSubmit(handleGeneratePayroll)} className="space-y-4">
              <FormField
                control={generateForm.control}
                name="payPeriod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pay Period (first of month)</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={generateForm.control}
                name="workingDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Working Days in Period</FormLabel>
                    <FormControl><Input type="number" placeholder="e.g. 22" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowGeneratePayroll(false)}>Cancel</Button>
                <Button type="submit" disabled={generatePayrollMutation.isPending}>
                  {generatePayrollMutation.isPending ? 'Generating...' : 'Generate'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
