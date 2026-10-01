import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEmployee, useUpdateEmployee, useUpsertCompensation } from '@/hooks/useEmployees';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import EmployeeForm from '@/components/employees/EmployeeForm';
import {
  compensationFormSchema,
  type EmployeeFormValues,
  type CompensationFormValues,
} from '@/lib/validations/employee';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { getApiErrorMessage, parseApiError } from '@/lib/api';

export default function EditEmployeePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useEmployee(id);
  const updateMutation = useUpdateEmployee(id!);
  const upsertCompensationMutation = useUpsertCompensation(id!);
  const [compensationError, setCompensationError] = useState<string | null>(null);

  const detail = data?.data;
  const employee = detail?.employee;
  const compensation = detail?.compensation;

  const compensationForm = useForm<CompensationFormValues>({
    resolver: zodResolver(compensationFormSchema),
    defaultValues: {
      payType: (compensation?.payType ?? 'monthly') as 'monthly' | 'daily' | 'hourly',
      baseRate: compensation ? Number(compensation.baseRate) : 0,
      overtimeRate: compensation ? Number(compensation.overtimeRate) : 0,
      effectiveFrom: compensation
        ? (typeof compensation.effectiveFrom === 'string'
          ? compensation.effectiveFrom
          : new Date(compensation.effectiveFrom).toISOString().split('T')[0])
        : new Date().toISOString().split('T')[0],
      notes: compensation?.notes ?? '',
    },
  });

  useEffect(() => {
    if (!compensation) return;
    compensationForm.reset({
      payType: compensation.payType as 'monthly' | 'daily' | 'hourly',
      baseRate: Number(compensation.baseRate),
      overtimeRate: Number(compensation.overtimeRate),
      effectiveFrom: typeof compensation.effectiveFrom === 'string'
        ? compensation.effectiveFrom
        : new Date(compensation.effectiveFrom).toISOString().split('T')[0],
      notes: compensation.notes ?? '',
    });
  }, [compensation, compensationForm]);

  const handleSubmit = async (values: EmployeeFormValues) => {
    try {
      await updateMutation.mutateAsync({
        firstName: values.firstName,
        lastName: values.lastName,
        designation: values.designation,
        siteId: values.siteId,
        costCentreId: values.costCentreId ? Number(values.costCentreId) : null,
        employmentType: values.employmentType as unknown as import('@farmflow/shared').EmploymentType,
        phone: values.phone || undefined,
      });
      toast.success('Employee updated successfully');
      navigate(`/employees/${id}`);
    } catch {
      toast.error('Failed to update employee');
    }
  };

  const handleCompensationSubmit = async (values: CompensationFormValues) => {
    try {
      setCompensationError(null);
      await upsertCompensationMutation.mutateAsync({
        payType: values.payType as unknown as import('@farmflow/shared').PayType,
        baseRate: values.baseRate,
        overtimeRate: values.overtimeRate,
        effectiveFrom: values.effectiveFrom,
        notes: values.notes || undefined,
      });
      toast.success('Compensation updated successfully');
    } catch (error) {
      setCompensationError(getApiErrorMessage(error, 'Failed to update compensation'));
      parseApiError(error, 'Failed to update compensation');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-foreground">Employee not found</h2>
        <p className="text-muted-foreground mt-2">The employee you are looking for does not exist.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
        Edit {employee.firstName} {employee.lastName}
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Employee Details</CardTitle>
        </CardHeader>
        <CardContent>
          <EmployeeForm
            defaultValues={{
              firstName: employee.firstName,
              lastName: employee.lastName,
              designation: employee.designation,
              siteId: employee.siteId,
              costCentreId: employee.costCentreId ? String(employee.costCentreId) : '',
              employmentType: employee.employmentType as unknown as 'permanent' | 'contract' | 'seasonal',
              joinDate: typeof employee.joinDate === 'string'
                ? employee.joinDate
                : new Date(employee.joinDate).toISOString().split('T')[0],
              phone: employee.phone ?? '',
            }}
            onSubmit={handleSubmit}
            isSubmitting={updateMutation.isPending}
            submitLabel="Save Changes"
            onCancel={() => navigate(`/employees/${id}`)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compensation</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...compensationForm}>
            <form onSubmit={compensationForm.handleSubmit(handleCompensationSubmit)} className="space-y-4">
              {compensationError && (
                <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {compensationError}
                </p>
              )}
              <FormField
                control={compensationForm.control}
                name="payType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pay Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="hourly">Hourly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={compensationForm.control}
                  name="baseRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Rate</FormLabel>
                      <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={compensationForm.control}
                  name="overtimeRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Overtime Rate</FormLabel>
                      <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={compensationForm.control}
                name="effectiveFrom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Effective From</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={compensationForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl><Textarea {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={upsertCompensationMutation.isPending}>
                Save Compensation
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
