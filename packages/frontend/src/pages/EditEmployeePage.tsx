import { useNavigate, useParams } from 'react-router-dom';
import { useEmployee, useUpdateEmployee } from '@/hooks/useEmployees';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import EmployeeForm from '@/components/employees/EmployeeForm';
import type { EmployeeFormValues } from '@/lib/validations/employee';
import { toast } from 'sonner';

export default function EditEmployeePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useEmployee(id);
  const updateMutation = useUpdateEmployee(id!);

  const employee = data?.data?.employee;

  const handleSubmit = async (values: EmployeeFormValues) => {
    try {
      await updateMutation.mutateAsync({
        firstName: values.firstName,
        lastName: values.lastName,
        designation: values.designation,
        employmentType: values.employmentType as unknown as import('@farmflow/shared').EmploymentType,
        phone: values.phone || undefined,
      });
      toast.success('Employee updated successfully');
      navigate(`/employees/${id}`);
    } catch {
      toast.error('Failed to update employee');
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
      <h1 className="text-2xl font-bold text-foreground">
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
    </div>
  );
}
