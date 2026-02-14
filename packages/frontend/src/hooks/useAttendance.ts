import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import type { Shift, Attendance, LeaveBalance, LeaveType } from '@farmflow/shared';

// --- Response interfaces ---

interface AttendanceListItem extends Attendance {
  employeeName?: string | null;
  shiftName?: string | null;
}

interface AttendanceListResponse {
  data: AttendanceListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface AttendanceListParams {
  page?: number;
  limit?: number;
  employeeId?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
  siteId?: number;
}

interface AttendanceSummary {
  totalPresent: number;
  totalAbsent: number;
  totalOnLeave: number;
  totalHalfDay: number;
  totalRecords: number;
}

interface AttendanceSummaryParams {
  startDate?: string;
  endDate?: string;
  siteId?: number;
}

interface AttendanceEmployeeOption {
  id: number;
  firstName: string;
  lastName: string;
  status: string;
  siteId: number;
}

interface AttendanceEmployeeParams {
  status?: string;
  siteId?: number;
}

interface LeaveBalanceItem extends Omit<LeaveBalance, 'balanceDays'> {
  employeeName?: string | null;
  balanceDays: number;
}

interface LeaveBalanceListParams {
  employeeId?: number;
  year?: number;
}

// --- Shift hooks ---

export function useShifts(status?: string) {
  const queryString = status ? `?status=${status}` : '';
  return useQuery({
    queryKey: ['shifts', status],
    queryFn: () => apiGet<Shift[]>(`/shifts${queryString}`),
  });
}

export function useCreateShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { shiftName: string; startTime: string; endTime: string }) =>
      apiPost<Shift>('/shifts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
  });
}

export function useUpdateShift(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<{ shiftName: string; startTime: string; endTime: string }>) =>
      apiPut<Shift>(`/shifts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
  });
}

export function useDeleteShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete<void>(`/shifts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
  });
}

// --- Attendance hooks ---

export function useAttendance(params: AttendanceListParams) {
  const queryString = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();

  return useQuery({
    queryKey: ['attendance', params],
    queryFn: () =>
      apiGet<AttendanceListItem[]>(`/attendance?${queryString}`) as unknown as Promise<AttendanceListResponse>,
  });
}

export function useAttendanceSummary(params: AttendanceSummaryParams) {
  const queryString = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();

  return useQuery({
    queryKey: ['attendance-summary', params],
    queryFn: () => apiGet<AttendanceSummary>(`/attendance/summary?${queryString}`),
  });
}

export function useAttendanceEmployees(params: AttendanceEmployeeParams = {}) {
  const queryString = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();

  return useQuery({
    queryKey: ['attendance-employees', params],
    queryFn: () => apiGet<AttendanceEmployeeOption[]>(`/attendance/employees${queryString ? `?${queryString}` : ''}`),
  });
}

export function useRecordAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      employeeId: number;
      attendanceDate: string;
      status: string;
      leaveType?: LeaveType;
      shiftId?: number;
      notes?: string;
    }) => apiPost<Attendance>('/attendance', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-summary'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
    },
  });
}

export function useBulkAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      attendanceDate: string;
      shiftId?: number;
      records: Array<{ employeeId: number; status: string; leaveType?: LeaveType; notes?: string }>;
    }) => apiPost<Attendance[]>('/attendance/bulk', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-summary'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
    },
  });
}

export function useUpdateAttendance(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { status?: string; leaveType?: LeaveType | null; shiftId?: number | null; notes?: string | null }) =>
      apiPut<Attendance>(`/attendance/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-summary'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
    },
  });
}

// ... existing delete attendance hook ...

export function useDeleteAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete<void>(`/attendance/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-summary'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
    },
  });
}

// --- Leave balance hooks ---

export function useLeaveBalances(params: LeaveBalanceListParams) {
  const queryString = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();

  return useQuery({
    queryKey: ['leave-balances', params],
    queryFn: () => apiGet<LeaveBalanceItem[]>(`/leave-balances?${queryString}`),
  });
}

export function useEmployeeLeaveBalances(employeeId: number | undefined) {
  return useQuery({
    queryKey: ['leave-balances', employeeId],
    queryFn: () => apiGet<LeaveBalanceItem[]>(`/leave-balances/${employeeId}`),
    enabled: !!employeeId,
  });
}

export function useSetLeaveBalance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      employeeId: number;
      leaveType: LeaveType;
      year: number;
      totalDays: number;
    }) => apiPost<LeaveBalance>('/leave-balances', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
    },
  });
}

export function useBulkSetLeaveBalance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      year: number;
      balances: Array<{ employeeId: number; leaveType: LeaveType; totalDays: number }>;
    }) => apiPost<LeaveBalance[]>('/leave-balances/bulk', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
    },
  });
}

export function useUpdateLeaveBalance(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { totalDays?: number; usedDays?: number }) =>
      apiPut<LeaveBalance>(`/leave-balances/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
    },
  });
}

// Re-export types for page components
export type {
  AttendanceListItem,
  AttendanceListResponse,
  AttendanceSummary,
  AttendanceEmployeeOption,
  LeaveBalanceItem,
};
