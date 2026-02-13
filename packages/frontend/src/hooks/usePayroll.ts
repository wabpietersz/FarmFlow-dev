import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import type { Payroll, PayrollDeduction, PayrollAllowance } from '@farmflow/shared';

// --- Response interfaces ---

interface PayrollListItem extends Payroll {
  employeeName?: string | null;
}

interface PayrollListResponse {
  data: PayrollListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface PayrollListParams {
  page?: number;
  limit?: number;
  employeeId?: number;
  payPeriod?: string;
  status?: string;
}

interface PayrollDetail extends PayrollListItem {
  designation?: string | null;
  deductions: PayrollDeduction[];
  allowances: PayrollAllowance[];
  totalDeductions: number;
  totalAllowances: number;
}

// --- Payroll hooks ---

export function usePayrolls(params: PayrollListParams) {
  const queryString = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();

  return useQuery({
    queryKey: ['payrolls', params],
    queryFn: () =>
      apiGet<PayrollListItem[]>(`/payroll?${queryString}`) as unknown as Promise<PayrollListResponse>,
  });
}

export function usePayroll(id: string | undefined) {
  return useQuery({
    queryKey: ['payrolls', id],
    queryFn: () => apiGet<PayrollDetail>(`/payroll/${id}`),
    enabled: !!id,
  });
}

export function useCreatePayroll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      employeeId: number;
      payPeriod: string;
      baseSalary: number;
      workingDays: number;
      overtimeHours?: number;
      overtimeRate?: number;
      notes?: string;
    }) => apiPost<Payroll>('/payroll', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrolls'] });
    },
  });
}

export function useGeneratePayroll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { payPeriod: string; workingDays: number }) =>
      apiPost<Payroll[]>('/payroll/generate', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrolls'] });
    },
  });
}

export function useUpdatePayroll(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { notes?: string | null; overtimeHours?: number; overtimeRate?: number }) =>
      apiPut<Payroll>(`/payroll/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrolls', id] });
      queryClient.invalidateQueries({ queryKey: ['payrolls'] });
    },
  });
}

export function useUpdatePayrollStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { status: string }) =>
      apiPut<Payroll>(`/payroll/${id}/status`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrolls', id] });
      queryClient.invalidateQueries({ queryKey: ['payrolls'] });
    },
  });
}

export function useAddDeduction(payrollId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { deductionType: string; amount: number; remarks?: string }) =>
      apiPost<PayrollDeduction>(`/payroll/${payrollId}/deductions`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrolls', payrollId] });
    },
  });
}

export function useRemoveDeduction(payrollId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deductionId: number) =>
      apiDelete<void>(`/payroll/${payrollId}/deductions/${deductionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrolls', payrollId] });
    },
  });
}

export function useAddAllowance(payrollId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { allowanceType: string; amount: number; remarks?: string }) =>
      apiPost<PayrollAllowance>(`/payroll/${payrollId}/allowances`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrolls', payrollId] });
    },
  });
}

export function useRemoveAllowance(payrollId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (allowanceId: number) =>
      apiDelete<void>(`/payroll/${payrollId}/allowances/${allowanceId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrolls', payrollId] });
    },
  });
}

// Re-export types for page components
export type { PayrollListItem, PayrollListResponse, PayrollDetail };
