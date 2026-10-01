import { useNavigate } from 'react-router-dom';
import { useCreateEmployee } from '@/hooks/useEmployees';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EmployeeForm from '@/components/employees/EmployeeForm';
import type { EmployeeFormValues } from '@/lib/validations/employee';
import { toast } from 'sonner';

export default function CreateEmployeePage() {
  const navigate = useNavigate();
  const createMutation = useCreateEmployee();

  const handleSubmit = async (values: EmployeeFormValues) => {
    try {
      const result = await createMutation.mutateAsync({
        firstName: values.firstName,
        lastName: values.lastName,
        designation: values.designation,
        siteId: values.siteId,
        ...(values.costCentreId ? { costCentreId: Number(values.costCentreId) } : {}),
        employmentType: values.employmentType as unknown as import('@farmflow/shared').EmploymentType,
        joinDate: values.joinDate,
        phone: values.phone || undefined,
      });
      toast.success('Employee created successfully');
      navigate(`/employees/${result.data?.id ?? ''}`);
    } catch {
      toast.error('Failed to create employee');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Add Employee</h1>
      <Card>
        <CardHeader>
          <CardTitle>Employee Details</CardTitle>
        </CardHeader>
        <CardContent>
          <EmployeeForm
            onSubmit={handleSubmit}
            isSubmitting={createMutation.isPending}
            submitLabel="Create Employee"
            onCancel={() => navigate('/employees')}
          />
        </CardContent>
      </Card>
    </div>
  );
}
