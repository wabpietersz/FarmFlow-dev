import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import {
  useShifts, useCreateShift, useDeleteShift,
  useAttendance, useAttendanceSummary, useRecordAttendance, useBulkAttendance, useDeleteAttendance,
  useLeaveBalances, useSetLeaveBalance, useBulkSetLeaveBalance, useAttendanceEmployees,
} from '@/hooks/useAttendance';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription,
} from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  attendanceFormSchema, bulkAttendanceFormSchema, shiftFormSchema, leaveBalanceFormSchema, bulkLeaveBalanceFormSchema,
  type AttendanceFormValues, type BulkAttendanceFormValues, type ShiftFormValues, type LeaveBalanceFormValues, type BulkLeaveBalanceFormValues,
} from '@/lib/validations/attendance';
import { Plus, Clock, CalendarDays, Palmtree, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useMemo } from 'react';
import type { LeaveType } from '@farmflow/shared';
import { parseApiError } from '@/lib/api';

const ATTENDANCE_STATUS_COLORS: Record<string, string> = {
  present: 'bg-success-soft text-success',
  absent: 'bg-danger-soft text-danger',
  on_leave: 'bg-warning-soft text-warning',
  half_day: 'bg-info-soft text-info',
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  casual: 'Casual',
  earned: 'Earned',
  medical: 'Medical',
  maternity: 'Maternity',
  unpaid: 'Unpaid',
};

export default function AttendancePage() {
  const { hasPermission } = useAuthStore();

  // Attendance state
  const [attendancePage, setAttendancePage] = useState(1);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState('');
  const [showRecordAttendance, setShowRecordAttendance] = useState(false);
  const [showBulkAttendance, setShowBulkAttendance] = useState(false);

  // Leave balance state
  const [leaveEmployeeFilter, setLeaveEmployeeFilter] = useState('');
  const [leaveYear, setLeaveYear] = useState(new Date().getFullYear());
  const [showLeaveBalance, setShowLeaveBalance] = useState(false);
  const [showBulkLeaveBalance, setShowBulkLeaveBalance] = useState(false);

  // Shift state
  const [showShiftDialog, setShowShiftDialog] = useState(false);

  // Data hooks
  const {
    data: attendanceData,
    isLoading: attendanceLoading,
    isError: attendanceError,
    refetch: refetchAttendance,
  } = useAttendance({
    page: attendancePage,
    limit: 20,
    startDate: attendanceDate,
    endDate: attendanceDate,
    status: attendanceStatusFilter || undefined,
  });
  const { data: summaryData } = useAttendanceSummary({
    startDate: attendanceDate,
    endDate: attendanceDate,
  });
  const { data: shiftsData, isLoading: shiftsLoading } = useShifts();
  const {
    data: attendanceEmployeesData,
    isError: attendanceEmployeesError,
    isLoading: attendanceEmployeesLoading,
  } = useAttendanceEmployees({ status: 'active' });
  const { data: leaveBalancesData, isLoading: leavesLoading } = useLeaveBalances({
    employeeId: leaveEmployeeFilter ? Number(leaveEmployeeFilter) : undefined,
    year: leaveYear,
  });

  const recordAttendanceMutation = useRecordAttendance();
  const bulkAttendanceMutation = useBulkAttendance();
  const deleteAttendanceMutation = useDeleteAttendance();
  const createShiftMutation = useCreateShift();
  const deleteShiftMutation = useDeleteShift();
  const setLeaveBalanceMutation = useSetLeaveBalance();
  const bulkSetLeaveBalanceMutation = useBulkSetLeaveBalance();

  const attendanceList = attendanceData?.data ?? [];
  const attendanceTotal = attendanceData?.total ?? 0;
  const attendanceTotalPages = attendanceData?.totalPages ?? 0;
  const summary = summaryData?.data ?? { totalPresent: 0, totalAbsent: 0, totalOnLeave: 0, totalHalfDay: 0, totalRecords: 0 };
  const shiftsList = shiftsData?.data ?? [];
  const activeEmployees = (Array.isArray(attendanceEmployeesData?.data) ? attendanceEmployeesData.data : []) as unknown as Array<{ id: number; firstName: string; lastName: string;[key: string]: unknown }>;
  const leaveBalancesList = leaveBalancesData?.data ?? [];
  const employeeSelectPlaceholder = attendanceEmployeesError
    ? 'Failed to load employees'
    : attendanceEmployeesLoading
      ? 'Loading employees...'
      : activeEmployees.length === 0
        ? 'No active employees found'
        : 'Select employee';
  const canBulkRecordAttendance = !attendanceEmployeesLoading && !attendanceEmployeesError && activeEmployees.length > 0;

  // Attendance form
  const attendanceForm = useForm<AttendanceFormValues>({
    resolver: zodResolver(attendanceFormSchema),
    defaultValues: {
      employeeId: undefined,
      attendanceDate: new Date().toISOString().split('T')[0],
      status: 'present',
      shiftId: undefined,
      notes: '',
    },
  });

  const bulkAttendanceForm = useForm<BulkAttendanceFormValues>({
    resolver: zodResolver(bulkAttendanceFormSchema),
    defaultValues: {
      attendanceDate: new Date().toISOString().split('T')[0],
      employeeIds: [],
      status: 'present',
      shiftId: undefined,
      notes: '',
    },
  });

  // Shift form
  const shiftForm = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftFormSchema),
    defaultValues: { shiftName: '', startTime: '', endTime: '' },
  });

  // Leave balance form
  const leaveBalanceForm = useForm<LeaveBalanceFormValues>({
    resolver: zodResolver(leaveBalanceFormSchema),
    defaultValues: {
      employeeId: undefined,
      leaveType: 'casual',
      year: new Date().getFullYear(),
      totalDays: 0,
    },
  });

  const recordStatus = useWatch({ control: attendanceForm.control, name: 'status' });
  const isLeaveStatus = recordStatus === 'on_leave' || recordStatus === 'half_day';
  const bulkStatus = useWatch({ control: bulkAttendanceForm.control, name: 'status' });
  const isBulkLeaveStatus = bulkStatus === 'on_leave' || bulkStatus === 'half_day';

  // Bulk Leave balance form
  const bulkLeaveBalanceForm = useForm<BulkLeaveBalanceFormValues>({
    resolver: zodResolver(bulkLeaveBalanceFormSchema),
    defaultValues: {
      year: new Date().getFullYear(),
      employeeIds: [],
      leaveType: 'casual',
      totalDays: 0,
    },
  });

  // Group leave balances by employee
  const groupedLeaveBalances = useMemo(() => {
    if (!leaveBalancesList.length) return [];

    // Explicitly type the accumulator
    const groups: Record<number, {
      employeeId: number;
      employeeName: string;
      balances: typeof leaveBalancesList
    }> = {};

    leaveBalancesList.forEach(balance => {
      if (!groups[balance.employeeId]) {
        groups[balance.employeeId] = {
          employeeId: balance.employeeId,
          employeeName: balance.employeeName ?? `Employee #${balance.employeeId}`,
          balances: []
        };
      }
      groups[balance.employeeId].balances.push(balance);
    });

    return Object.values(groups).sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [leaveBalancesList]);

  const handleRecordAttendance = async (values: AttendanceFormValues) => {
    try {
      await recordAttendanceMutation.mutateAsync({
        employeeId: values.employeeId,
        attendanceDate: values.attendanceDate,
        status: values.status,
        leaveType: values.leaveType as LeaveType | undefined,
        shiftId: values.shiftId as number | undefined,
        notes: values.notes || undefined,
      });
      toast.success('Attendance recorded');
      attendanceForm.reset();
      setShowRecordAttendance(false);
    } catch (error) {
      parseApiError(error, 'Failed to record attendance');
    }
  };

  const handleBulkRecordAttendance = async (values: BulkAttendanceFormValues) => {
    try {
      await bulkAttendanceMutation.mutateAsync({
        attendanceDate: values.attendanceDate,
        shiftId: values.shiftId as number | undefined,
        records: values.employeeIds.map((employeeId) => ({
          employeeId,
          status: values.status,
          leaveType: values.leaveType as LeaveType | undefined,
          notes: values.notes || undefined,
        })),
      });
      toast.success(`Recorded attendance for ${values.employeeIds.length} employees`);
      bulkAttendanceForm.reset({
        attendanceDate: values.attendanceDate,
        employeeIds: [],
        status: 'present',
        shiftId: undefined,
        notes: '',
      });
      setShowBulkAttendance(false);
    } catch (error) {
      parseApiError(error, 'Failed to record bulk attendance');
    }
  };

  const handleCreateShift = async (values: ShiftFormValues) => {
    try {
      await createShiftMutation.mutateAsync(values);
      toast.success('Shift created');
      shiftForm.reset();
      setShowShiftDialog(false);
    } catch {
      toast.error('Failed to create shift');
    }
  };

  const handleDeactivateShift = async (id: number) => {
    try {
      await deleteShiftMutation.mutateAsync(id);
      toast.success('Shift deactivated');
    } catch {
      toast.error('Failed to deactivate shift');
    }
  };

  const handleBulkSetLeaveBalance = async (values: BulkLeaveBalanceFormValues) => {
    try {
      if (values.employeeIds.length === 0) {
        toast.error('Select at least one employee');
        return;
      }

      const balances = values.employeeIds.map(empId => ({
        employeeId: empId,
        leaveType: values.leaveType as LeaveType,
        totalDays: values.totalDays,
      }));

      await bulkSetLeaveBalanceMutation.mutateAsync({
        year: values.year,
        balances,
      });

      toast.success(`Updated leave balances for ${values.employeeIds.length} employees`);
      bulkLeaveBalanceForm.reset();
      setShowBulkLeaveBalance(false);
    } catch {
      toast.error('Failed to update bulk leave balances');
    }
  };

  const handleSetLeaveBalance = async (values: LeaveBalanceFormValues) => {
    try {
      await setLeaveBalanceMutation.mutateAsync({
        employeeId: values.employeeId,
        leaveType: values.leaveType as LeaveType,
        year: values.year,
        totalDays: values.totalDays,
      });
      toast.success('Leave balance set');
      leaveBalanceForm.reset();
      setShowLeaveBalance(false);
    } catch {
      toast.error('Failed to set leave balance');
    }
  };

  const handleDeleteAttendance = async (id: number) => {
    try {
      await deleteAttendanceMutation.mutateAsync(id);
      toast.success('Attendance record deleted');
    } catch {
      toast.error('Failed to delete attendance record');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Attendance & Leave</h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Present</p>
            <p className="text-2xl font-bold text-success">{summary.totalPresent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Absent</p>
            <p className="text-2xl font-bold text-danger">{summary.totalAbsent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">On Leave</p>
            <p className="text-2xl font-bold text-warning">{summary.totalOnLeave}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Half Day</p>
            <p className="text-2xl font-bold text-info">{summary.totalHalfDay}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Total Records</p>
            <p className="text-2xl font-bold">{summary.totalRecords}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="attendance">
        <TabsList>
          <TabsTrigger value="attendance" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            Attendance
          </TabsTrigger>
          <TabsTrigger value="leave" className="gap-2">
            <Palmtree className="h-4 w-4" />
            Leave Balances
          </TabsTrigger>
          <TabsTrigger value="shifts" className="gap-2">
            <Clock className="h-4 w-4" />
            Shifts
          </TabsTrigger>
        </TabsList>

        {/* ATTENDANCE TAB */}
        <TabsContent value="attendance">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <Input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => { setAttendanceDate(e.target.value); setAttendancePage(1); }}
                  className="w-[180px]"
                />
                <Select value={attendanceStatusFilter || 'all'} onValueChange={(v) => { setAttendanceStatusFilter(v === 'all' ? '' : v); setAttendancePage(1); }}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                    <SelectItem value="half_day">Half Day</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2 ml-auto">
                  {hasPermission('attendance:create') && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {
                          bulkAttendanceForm.reset({
                            attendanceDate,
                            employeeIds: [],
                            status: 'present',
                            shiftId: undefined,
                            notes: '',
                          });
                          setShowBulkAttendance(true);
                        }}
                        disabled={!canBulkRecordAttendance}
                      >
                        Bulk Record
                      </Button>
                      <Button
                        onClick={() => { attendanceForm.reset({ attendanceDate, status: 'present' }); setShowRecordAttendance(true); }}
                        disabled={attendanceEmployeesLoading || attendanceEmployeesError || activeEmployees.length === 0}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Record
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {attendanceLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : attendanceError ? (
                <div className="text-center py-12 space-y-3">
                  <CalendarDays className="h-12 w-12 text-danger mx-auto" />
                  <h3 className="text-lg font-medium text-foreground">Failed to load attendance records</h3>
                  <p className="text-sm text-muted-foreground">Please retry. If this persists, check API permissions and server logs.</p>
                  <Button variant="outline" onClick={() => { void refetchAttendance(); }}>
                    Retry
                  </Button>
                </div>
              ) : attendanceList.length === 0 ? (
                <div className="text-center py-12">
                  <CalendarDays className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-1">No attendance records</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    No attendance recorded for {new Date(attendanceDate).toLocaleDateString()}.
                  </p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Leave Type</TableHead>
                        <TableHead className="hidden sm:table-cell">Shift</TableHead>
                        <TableHead className="hidden md:table-cell">Notes</TableHead>
                        {hasPermission('attendance:delete') && <TableHead className="w-[50px]" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceList.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">{record.employeeName ?? '--'}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(record.attendanceDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize ${ATTENDANCE_STATUS_COLORS[record.status] ?? ''}`}>
                              {record.status.replace('_', ' ')}
                            </span>
                          </TableCell>
                          <TableCell className="capitalize text-muted-foreground">
                            {record.leaveType ? (LEAVE_TYPE_LABELS[record.leaveType] || record.leaveType) : '-'}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground">
                            {record.shiftName ?? '--'}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground max-w-[200px] truncate">
                            {record.notes ?? '--'}
                          </TableCell>
                          {hasPermission('attendance:delete') && (
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteAttendance(record.id)}>
                                <Trash2 className="h-4 w-4 text-danger" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {(attendancePage - 1) * 20 + 1} to {Math.min(attendancePage * 20, attendanceTotal)} of {attendanceTotal}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={attendancePage <= 1} onClick={() => setAttendancePage((p) => p - 1)}>Previous</Button>
                      <Button variant="outline" size="sm" disabled={attendancePage >= attendanceTotalPages} onClick={() => setAttendancePage((p) => p + 1)}>Next</Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* LEAVE BALANCES TAB */}
        <TabsContent value="leave">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <Select value={leaveEmployeeFilter || 'all'} onValueChange={(v) => setLeaveEmployeeFilter(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="All Employees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {activeEmployees.map((emp) => (
                      <SelectItem key={emp.id} value={String(emp.id)}>
                        {emp.firstName} {emp.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={leaveYear}
                  onChange={(e) => setLeaveYear(Number(e.target.value))}
                  className="w-[120px]"
                  min={2020}
                  max={2100}
                />

                {hasPermission('attendance:create') && (
                  <div className="ml-auto flex gap-2">
                    <Button variant="outline" onClick={() => { bulkLeaveBalanceForm.reset({ year: leaveYear, employeeIds: [] }); setShowBulkLeaveBalance(true); }}>
                      <Users className="h-4 w-4 mr-2" />
                      Bulk Set
                    </Button>
                    <Button onClick={() => { leaveBalanceForm.reset({ year: leaveYear }); setShowLeaveBalance(true); }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Set Balance
                    </Button>
                  </div>
                )}
              </div>

              {leavesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : leaveBalancesList.length === 0 ? (
                <div className="text-center py-12">
                  <Palmtree className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-1">No leave balances</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    No leave balances configured for {leaveYear}.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[300px]">Employee / Leave Type</TableHead>
                      <TableHead>Total Days</TableHead>
                      <TableHead>Used Days</TableHead>
                      <TableHead>Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedLeaveBalances.map((group) => (
                      <div key={group.employeeId} style={{ display: 'contents' }}>
                        {/* Header Row for Employee */}
                        <TableRow className="bg-muted/30 hover:bg-muted/50">
                          <TableCell colSpan={4} className="font-semibold py-3">
                            {group.employeeName}
                          </TableCell>
                        </TableRow>
                        {/* Detail Rows for Leave Types */}
                        {group.balances.map((balance) => (
                          <TableRow key={balance.id}>
                            <TableCell className="pl-8 capitalize text-muted-foreground">
                              {LEAVE_TYPE_LABELS[balance.leaveType] ?? balance.leaveType}
                            </TableCell>
                            <TableCell>{balance.totalDays}</TableCell>
                            <TableCell>{balance.usedDays}</TableCell>
                            <TableCell>
                              <span className={`font-medium ${balance.balanceDays <= 0 ? 'text-danger' : 'text-success'}`}>
                                {balance.balanceDays}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </div>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SHIFTS TAB */}
        <TabsContent value="shifts">
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between mb-6">
                <h3 className="text-lg font-medium">Shift Definitions</h3>
                {hasPermission('attendance:create') && (
                  <Button onClick={() => { shiftForm.reset(); setShowShiftDialog(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Shift
                  </Button>
                )}
              </div>

              {shiftsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : shiftsList.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-1">No shifts defined</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create shift definitions to assign to attendance records.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Shift Name</TableHead>
                      <TableHead>Start Time</TableHead>
                      <TableHead>End Time</TableHead>
                      <TableHead>Status</TableHead>
                      {hasPermission('attendance:delete') && <TableHead className="w-[100px]" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shiftsList.map((shift) => (
                      <TableRow key={shift.id}>
                        <TableCell className="font-medium">{shift.shiftName}</TableCell>
                        <TableCell>{shift.startTime}</TableCell>
                        <TableCell>{shift.endTime}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize ${shift.status === 'active' ? 'bg-success-soft text-success' : 'bg-muted text-foreground'}`}>
                            {shift.status}
                          </span>
                        </TableCell>
                        {hasPermission('attendance:delete') && (
                          <TableCell>
                            {shift.status === 'active' && (
                              <Button variant="ghost" size="sm" className="text-danger" onClick={() => handleDeactivateShift(shift.id)}>
                                Deactivate
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Bulk Record Attendance Dialog */}
      <Dialog open={showBulkAttendance} onOpenChange={setShowBulkAttendance}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Bulk Record Attendance</DialogTitle>
            <DialogDescription>Apply one attendance status to multiple employees.</DialogDescription>
          </DialogHeader>
          <Form {...bulkAttendanceForm}>
            <form onSubmit={bulkAttendanceForm.handleSubmit(handleBulkRecordAttendance)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={bulkAttendanceForm.control}
                  name="attendanceDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={bulkAttendanceForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent position="popper">
                          <SelectItem value="present">Present</SelectItem>
                          <SelectItem value="absent">Absent</SelectItem>
                          <SelectItem value="on_leave">On Leave</SelectItem>
                          <SelectItem value="half_day">Half Day</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {isBulkLeaveStatus && (
                <FormField
                  control={bulkAttendanceForm.control}
                  name="leaveType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Leave Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select leave type" /></SelectTrigger>
                        </FormControl>
                        <SelectContent position="popper">
                          <SelectItem value="casual">Casual</SelectItem>
                          <SelectItem value="earned">Earned</SelectItem>
                          <SelectItem value="medical">Medical</SelectItem>
                          <SelectItem value="maternity">Maternity</SelectItem>
                          <SelectItem value="unpaid">Unpaid</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={bulkAttendanceForm.control}
                name="shiftId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shift (Optional)</FormLabel>
                    <Select value={field.value ? String(field.value) : undefined} onValueChange={(v) => field.onChange(v ? Number(v) : undefined)}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="No shift" /></SelectTrigger>
                      </FormControl>
                      <SelectContent position="popper" className="max-h-[300px]">
                        {shiftsList.map((shift) => (
                          <SelectItem key={shift.id} value={String(shift.id)}>
                            {shift.shiftName} ({shift.startTime} - {shift.endTime})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={bulkAttendanceForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl><Textarea placeholder="Any notes..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={bulkAttendanceForm.control}
                name="employeeIds"
                render={() => (
                  <FormItem>
                    <div className="mb-2">
                      <FormLabel className="text-base">Employees</FormLabel>
                      <FormDescription>Select employees to apply this attendance status.</FormDescription>
                    </div>
                    <div className="border rounded-md max-h-[220px] overflow-y-auto p-2 space-y-2">
                      <div className="flex items-center space-x-2 sticky top-0 bg-background pb-2 border-b z-10">
                        <Checkbox
                          checked={activeEmployees.length > 0 && bulkAttendanceForm.watch('employeeIds').length === activeEmployees.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              bulkAttendanceForm.setValue('employeeIds', activeEmployees.map((employee) => employee.id));
                            } else {
                              bulkAttendanceForm.setValue('employeeIds', []);
                            }
                          }}
                        />
                        <span className="text-sm font-medium">Select All</span>
                      </div>
                      {activeEmployees.map((employee) => (
                        <FormField
                          key={employee.id}
                          control={bulkAttendanceForm.control}
                          name="employeeIds"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(employee.id)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...field.value, employee.id])
                                      : field.onChange(field.value?.filter((value) => value !== employee.id));
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal cursor-pointer">
                                {employee.firstName} {employee.lastName}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowBulkAttendance(false)}>Cancel</Button>
                <Button type="submit" disabled={bulkAttendanceMutation.isPending}>
                  {bulkAttendanceMutation.isPending ? 'Recording...' : 'Record Attendance'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Record Attendance Dialog */}
      <Dialog open={showRecordAttendance} onOpenChange={setShowRecordAttendance}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Record Attendance</DialogTitle>
            <DialogDescription>Record attendance for an employee.</DialogDescription>
          </DialogHeader>
          <Form {...attendanceForm}>
            <form onSubmit={attendanceForm.handleSubmit(handleRecordAttendance)} className="space-y-4">
              <FormField
                control={attendanceForm.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee</FormLabel>
                    <Select value={field.value ? String(field.value) : undefined} onValueChange={(v) => field.onChange(Number(v))}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder={employeeSelectPlaceholder} /></SelectTrigger>
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
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={attendanceForm.control}
                  name="attendanceDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={attendanceForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent position="popper">
                          <SelectItem value="present">Present</SelectItem>
                          <SelectItem value="absent">Absent</SelectItem>
                          <SelectItem value="on_leave">On Leave</SelectItem>
                          <SelectItem value="half_day">Half Day</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {isLeaveStatus && (
                <FormField
                  control={attendanceForm.control}
                  name="leaveType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Leave Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select leave type" /></SelectTrigger>
                        </FormControl>
                        <SelectContent position="popper">
                          <SelectItem value="casual">Casual</SelectItem>
                          <SelectItem value="earned">Earned</SelectItem>
                          <SelectItem value="medical">Medical</SelectItem>
                          <SelectItem value="maternity">Maternity</SelectItem>
                          <SelectItem value="unpaid">Unpaid</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={attendanceForm.control}
                name="shiftId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shift (Optional)</FormLabel>
                    <Select value={field.value ? String(field.value) : undefined} onValueChange={(v) => field.onChange(v ? Number(v) : undefined)}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="No shift" /></SelectTrigger>
                      </FormControl>
                      <SelectContent position="popper" className="max-h-[300px]">
                        {shiftsList.map((shift) => (
                          <SelectItem key={shift.id} value={String(shift.id)}>
                            {shift.shiftName} ({shift.startTime} - {shift.endTime})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={attendanceForm.control}
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
                <Button type="button" variant="outline" onClick={() => setShowRecordAttendance(false)}>Cancel</Button>
                <Button type="submit" disabled={recordAttendanceMutation.isPending}>
                  {recordAttendanceMutation.isPending ? 'Saving...' : 'Record'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Create Shift Dialog */}
      <Dialog open={showShiftDialog} onOpenChange={setShowShiftDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>New Shift</DialogTitle>
            <DialogDescription>Define a new shift schedule.</DialogDescription>
          </DialogHeader>
          <Form {...shiftForm}>
            <form onSubmit={shiftForm.handleSubmit(handleCreateShift)} className="space-y-4">
              <FormField
                control={shiftForm.control}
                name="shiftName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shift Name</FormLabel>
                    <FormControl><Input placeholder="e.g. Morning Shift" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={shiftForm.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <FormControl><Input type="time" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={shiftForm.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time</FormLabel>
                      <FormControl><Input type="time" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowShiftDialog(false)}>Cancel</Button>
                <Button type="submit" disabled={createShiftMutation.isPending}>
                  {createShiftMutation.isPending ? 'Creating...' : 'Create Shift'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Set Leave Balance Dialog */}
      <Dialog open={showLeaveBalance} onOpenChange={setShowLeaveBalance}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Set Leave Balance</DialogTitle>
            <DialogDescription>Set or update leave allocation for an employee.</DialogDescription>
          </DialogHeader>
          <Form {...leaveBalanceForm}>
            <form onSubmit={leaveBalanceForm.handleSubmit(handleSetLeaveBalance)} className="space-y-4">
              <FormField
                control={leaveBalanceForm.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee</FormLabel>
                    <Select value={field.value ? String(field.value) : undefined} onValueChange={(v) => field.onChange(Number(v))}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder={employeeSelectPlaceholder} /></SelectTrigger>
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
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={leaveBalanceForm.control}
                  name="leaveType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Leave Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent position="popper">
                          <SelectItem value="casual">Casual</SelectItem>
                          <SelectItem value="earned">Earned</SelectItem>
                          <SelectItem value="medical">Medical</SelectItem>
                          <SelectItem value="maternity">Maternity</SelectItem>
                          <SelectItem value="unpaid">Unpaid</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={leaveBalanceForm.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={leaveBalanceForm.control}
                name="totalDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Days</FormLabel>
                    <FormControl><Input type="number" min={0} placeholder="e.g. 12" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowLeaveBalance(false)}>Cancel</Button>
                <Button type="submit" disabled={setLeaveBalanceMutation.isPending}>
                  {setLeaveBalanceMutation.isPending ? 'Saving...' : 'Set Balance'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      {/* Bulk Set Leave Balance Dialog */}
      <Dialog open={showBulkLeaveBalance} onOpenChange={setShowBulkLeaveBalance}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Bulk Set Leave Balances</DialogTitle>
            <DialogDescription>Set leave balances for multiple employees at once.</DialogDescription>
          </DialogHeader>
          <Form {...bulkLeaveBalanceForm}>
            <form onSubmit={bulkLeaveBalanceForm.handleSubmit(handleBulkSetLeaveBalance)} className="space-y-4">
              <FormField
                control={bulkLeaveBalanceForm.control}
                name="year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Year</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={bulkLeaveBalanceForm.control}
                  name="leaveType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Leave Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent position="popper">
                          <SelectItem value="casual">Casual</SelectItem>
                          <SelectItem value="earned">Earned</SelectItem>
                          <SelectItem value="medical">Medical</SelectItem>
                          <SelectItem value="maternity">Maternity</SelectItem>
                          <SelectItem value="unpaid">Unpaid</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={bulkLeaveBalanceForm.control}
                  name="totalDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Days</FormLabel>
                      <FormControl><Input type="number" min={0} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={bulkLeaveBalanceForm.control}
                name="employeeIds"
                render={() => (
                  <FormItem>
                    <div className="mb-4">
                      <FormLabel className="text-base">Employees</FormLabel>
                      <FormDescription>Select employees to apply this balance to.</FormDescription>
                    </div>
                    <div className="border rounded-md max-h-[200px] overflow-y-auto p-2 space-y-2">
                      <div className="flex items-center space-x-2 sticky top-0 bg-background pb-2 border-b z-10">
                        <Checkbox
                          checked={activeEmployees.length > 0 && bulkLeaveBalanceForm.watch('employeeIds').length === activeEmployees.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              bulkLeaveBalanceForm.setValue('employeeIds', activeEmployees.map(e => e.id));
                            } else {
                              bulkLeaveBalanceForm.setValue('employeeIds', []);
                            }
                          }}
                        />
                        <span className="text-sm font-medium">Select All</span>
                      </div>
                      {activeEmployees.map((emp) => (
                        <FormField
                          key={emp.id}
                          control={bulkLeaveBalanceForm.control}
                          name="employeeIds"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={emp.id}
                                className="flex flex-row items-start space-x-3 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(emp.id)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, emp.id])
                                        : field.onChange(
                                          field.value?.filter(
                                            (value) => value !== emp.id
                                          )
                                        )
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">
                                  {emp.firstName} {emp.lastName}
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowBulkLeaveBalance(false)}>Cancel</Button>
                <Button type="submit" disabled={bulkSetLeaveBalanceMutation.isPending}>
                  {bulkSetLeaveBalanceMutation.isPending ? 'Updating...' : 'Update Balances'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
