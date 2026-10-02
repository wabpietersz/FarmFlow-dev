import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useEmployees, useDeleteEmployee } from '@/hooks/useEmployees';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableActionsHead, TableActionsCell } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Search, Users, Download } from 'lucide-react';
import { toast } from 'sonner';
import { getIdToken } from '@/lib/firebase';
import { RowActions } from '@/components/ui/row-actions';
import { StatusBadge } from '@/components/ui/status-badge';

export default function EmployeesPage() {
  const { hasPermission } = useAuthStore();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const { data, isLoading } = useEmployees({
    page,
    limit: 20,
    search: debouncedSearch,
    status: statusFilter || undefined,
  });

  const deleteMutation = useDeleteEmployee();

  // Debounce search
  const searchTimeoutRef = useState<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimeoutRef[0]) clearTimeout(searchTimeoutRef[0]);
    searchTimeoutRef[0] = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success(`${deleteTarget.name} has been terminated`);
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete employee');
    }
  };

  const handleExportCSV = async () => {
    try {
      const token = await getIdToken();
      const baseUrl = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${baseUrl}/employees/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `employees-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV exported successfully');
    } catch {
      toast.error('Failed to export employees');
    }
  };

  const employees = data?.data ?? [];
  const totalPages = data?.totalPages ?? 0;
  const total = data?.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Employees</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          {hasPermission('employees:create') && (
            <Button asChild>
              <Link to="/employees/new">
                <Plus className="h-4 w-4" />
                Add Employee
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or designation..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="on_leave">On Leave</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : employees.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">No employees found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {debouncedSearch || statusFilter
                  ? 'Try adjusting your search or filters.'
                  : 'Get started by adding your first employee.'}
              </p>
              {hasPermission('employees:create') && !debouncedSearch && !statusFilter && (
                <Button asChild>
                  <Link to="/employees/new">
                    <Plus className="h-4 w-4" />
                    Add Employee
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead className="hidden sm:table-cell">Site</TableHead>
                    <TableHead className="hidden md:table-cell">Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Join Date</TableHead>
                    <TableActionsHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp) => (
                    <TableRow key={emp.id} onOpen={() => navigate(`/employees/${emp.id}`)}>
                      <TableCell className="font-semibold">{emp.firstName} {emp.lastName}</TableCell>
                      <TableCell className="text-muted-foreground">{emp.designation}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {emp.siteName ?? '--'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className="capitalize">
                          {emp.employmentType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={emp.status} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {new Date(emp.joinDate).toLocaleDateString()}
                      </TableCell>
                      <TableActionsCell>
                        <RowActions
                          label={`${emp.firstName} ${emp.lastName}`}
                          open={`/employees/${emp.id}`}
                          actions={[
                            { label: 'Edit', icon: Pencil, href: `/employees/${emp.id}/edit`, hidden: !hasPermission('employees:update') },
                            {
                              label: 'Terminate',
                              icon: Trash2,
                              destructive: true,
                              hidden: !hasPermission('employees:delete') || emp.status === 'terminated',
                              onSelect: () => setDeleteTarget({ id: emp.id, name: `${emp.firstName} ${emp.lastName}` }),
                            },
                          ]}
                        />
                      </TableActionsCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of {total}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Termination</DialogTitle>
            <DialogDescription>
              Are you sure you want to terminate {deleteTarget?.name}? This will set their status
              to terminated. This action can be reversed by editing the employee.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Terminating...' : 'Terminate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
