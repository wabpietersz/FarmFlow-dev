import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import type {
  Payroll,
  PayrollDeduction,
  PayrollAllowance,
  PayrollAllowanceInput,
  PayrollDeductionInput,
  CompensationTemplate,
  PayrollGenerationWarning,
  PayrollRegister,
  StaffLoan,
  StatutoryRates,
  StatutoryReturn,
} from '@farmflow/shared';

// --- Response interfaces ---

interface PayrollListItem extends Payroll {
  employeeName?: string | null;
  financeAccountName?: string | null;
  compensationRevisionId?: number | null;
  compensationSnapshot?: Payroll['compensationSnapshot'] | null;
  chequeNumber?: string | null;
  totalAllowances?: number;
  totalDeductions?: number;
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
  payPeriodMonth?: string;
  status?: string;
}

interface PayrollDetail extends PayrollListItem {
  designation?: string | null;
  deductions: PayrollDeduction[];
  allowances: PayrollAllowance[];
  totalDeductions: number;
  totalAllowances: number;
}

interface PayrollGenerateResponse {
  data: Payroll[];
  total: number;
  meta?: {
    employeesWithoutCompensation?: number;
    skipped?: number;
    warningCount?: number;
    warnings?: PayrollGenerationWarning[];
  };
}

interface PayrollPreviewRow {
  employeeId: number;
  employeeName: string;
  payPeriod: string;
  workingDays: number;
  attendedDays: number;
  baseSalary: number;
  overtimeHours: number;
  overtimeRate: number;
  allowances: PayrollAllowanceInput[];
  deductions: PayrollDeductionInput[];
  hasCompensation: boolean;
  compensationRevisionId: number | null;
  compensationSnapshot?: Payroll['compensationSnapshot'] | null;
  warnings: PayrollGenerationWarning[];
  grossSalaryPreview: number;
  epfEmployeePreview?: number;
  epfEmployerPreview?: number;
  etfEmployerPreview?: number;
  loanRecoveryPreview?: number;
  netSalaryPreview: number;
  notes?: string;
}

interface PayrollPreviewResponse {
  payPeriod: string;
  startDate: string;
  endDate: string;
  rows: PayrollPreviewRow[];
  summary: {
    totalEmployees: number;
    employeesWithCompensation: number;
    employeesWithoutCompensation: number;
    warningCount: number;
  };
}

interface PayrollPrecheckItem {
  employeeId: number;
  employeeName: string;
  status: 'ok' | 'warning' | 'error';
  warnings: PayrollGenerationWarning[];
}

interface PayrollPrecheckResponse {
  payPeriod: string;
  summary: {
    totalEmployees: number;
    okEmployees: number;
    warningEmployees: number;
    errorEmployees: number;
    warningCount: number;
  };
  checks: PayrollPrecheckItem[];
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
      attendedDays?: number;
      overtimeHours?: number;
      overtimeRate?: number;
      notes?: string;
      allowances?: PayrollAllowanceInput[];
      deductions?: PayrollDeductionInput[];
      compensationRevisionId?: number | null;
    }) => apiPost<Payroll>('/payroll', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrolls'] });
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
      queryClient.invalidateQueries({ queryKey: ['staff-loans'] });
    },
  });
}

export function useGeneratePayroll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      payPeriod: string;
      workingDays?: number;
      entries?: Array<{
        employeeId: number;
        baseSalary: number;
        workingDays: number;
        attendedDays?: number;
        overtimeHours?: number;
        overtimeRate?: number;
        notes?: string;
        allowances?: PayrollAllowanceInput[];
        deductions?: PayrollDeductionInput[];
        compensationRevisionId?: number | null;
      }>;
    }) =>
      apiPost<Payroll[]>('/payroll/generate', data) as unknown as Promise<PayrollGenerateResponse>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrolls'] });
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
      queryClient.invalidateQueries({ queryKey: ['staff-loans'] });
    },
  });
}

export function usePayrollGeneratePrecheck() {
  return useMutation({
    mutationFn: (data: { payPeriod: string }) =>
      apiPost<PayrollPrecheckResponse>('/payroll/generate/precheck', data),
  });
}

export function usePayrollPreview() {
  return useMutation({
    mutationFn: (data: { payPeriod: string; employeeId?: number }) =>
      apiPost<PayrollPreviewResponse>('/payroll/preview', data),
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
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
      queryClient.invalidateQueries({ queryKey: ['staff-loans'] });
    },
  });
}

export function useUpdatePayrollStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { status: string; financeAccountId?: number; paymentMethod?: 'cash' | 'cheque' | 'bank_transfer'; chequeLeafId?: number }) =>
      apiPut<Payroll>(`/payroll/${id}/status`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payrolls', id] });
      queryClient.invalidateQueries({ queryKey: ['payrolls'] });
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
      queryClient.invalidateQueries({ queryKey: ['staff-loans'] });
      queryClient.invalidateQueries({ queryKey: ['treasury'] });
    },
  });
}

export function useDeletePayroll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete<{ message: string }>(`/payroll/${id}`),
    onSuccess: (_response, id) => {
      queryClient.invalidateQueries({ queryKey: ['payrolls'] });
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
      queryClient.invalidateQueries({ queryKey: ['staff-loans'] });
      queryClient.invalidateQueries({ queryKey: ['payrolls', String(id)] });
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
    mutationFn: (data: { allowanceType: string; amount: number; countsForEpf?: boolean; remarks?: string }) =>
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

export function useCompensationTemplates(category?: 'allowance' | 'deduction', active = true) {
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  params.append('active', String(active));
  const queryString = params.toString();

  return useQuery({
    queryKey: ['compensation-templates', category, active],
    queryFn: () => apiGet<CompensationTemplate[]>(`/compensation-templates?${queryString}`),
  });
}

export function useCreateCompensationTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      category: 'allowance' | 'deduction';
      defaultAmount?: number;
      description?: string;
      isActive?: boolean;
    }) => apiPost<CompensationTemplate>('/compensation-templates', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compensation-templates'] });
    },
  });
}

export function useUpdateCompensationTemplate(templateId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name?: string;
      category?: 'allowance' | 'deduction';
      defaultAmount?: number | null;
      description?: string | null;
      isActive?: boolean;
    }) => apiPut<CompensationTemplate>(`/compensation-templates/${templateId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compensation-templates'] });
    },
  });
}

export function useDeleteCompensationTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (templateId: number) => apiDelete<void>(`/compensation-templates/${templateId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compensation-templates'] });
    },
  });
}

// Re-export types for page components
export type {
  PayrollListItem,
  PayrollListResponse,
  PayrollDetail,
  PayrollGenerateResponse,
  PayrollPreviewRow,
  PayrollPreviewResponse,
  PayrollPrecheckResponse,
  PayrollPrecheckItem,
};

// --- EPF/ETF, advances & loans, register ---

const invalidatePayrollMoney = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: ['payrolls'] });
  queryClient.invalidateQueries({ queryKey: ['payroll'] });
  queryClient.invalidateQueries({ queryKey: ['staff-loans'] });
  queryClient.invalidateQueries({ queryKey: ['treasury'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
};

export function useStatutoryRates() {
  return useQuery({ queryKey: ['payroll', 'statutory-rates'], queryFn: () => apiGet<StatutoryRates>('/payroll/settings/statutory') });
}

export function useSaveStatutoryRates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rates: StatutoryRates) => apiPut<StatutoryRates>('/payroll/settings/statutory', rates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payroll', 'statutory-rates'] }),
  });
}

export function useStaffLoans(status = 'active') {
  return useQuery({ queryKey: ['staff-loans', status], queryFn: () => apiGet<StaffLoan[]>(`/payroll/loans?status=${status}`) });
}

export interface IssueLoanPayload {
  employeeId: number;
  loanType: 'advance' | 'loan';
  principal: number;
  installmentAmount?: number;
  issuedDate: string;
  firstRecoveryPeriod: string;
  financeAccountId: number;
  paymentMethod: 'cash' | 'bank_transfer';
  notes?: string | null;
}

export function useIssueLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: IssueLoanPayload) => apiPost('/payroll/loans', data),
    onSuccess: () => invalidatePayrollMoney(queryClient),
  });
}

export function useRepayLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; amount: number; date: string; financeAccountId: number; notes?: string | null }) =>
      apiPost(`/payroll/loans/${id}/repayments`, data),
    onSuccess: () => invalidatePayrollMoney(queryClient),
  });
}

export function useWriteOffLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => apiPost(`/payroll/loans/${id}/write-off`, { reason }),
    onSuccess: () => invalidatePayrollMoney(queryClient),
  });
}

export function usePayrollRegister(period: string) {
  return useQuery({
    queryKey: ['payroll', 'register', period],
    queryFn: () => apiGet<PayrollRegister>(`/payroll/register?period=${period}`),
    enabled: /^\d{4}-\d{2}/.test(period),
  });
}

export function usePayPeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { payPeriod: string; financeAccountId: number; paymentMethod: 'cash' | 'bank_transfer'; payDate?: string }) =>
      apiPost<{ paid: number; total: number }>('/payroll/pay-period', data),
    onSuccess: () => invalidatePayrollMoney(queryClient),
  });
}

export function useStatutoryReturn(period: string) {
  return useQuery({
    queryKey: ['payroll', 'statutory', period],
    queryFn: () => apiGet<StatutoryReturn>(`/payroll/statutory?period=${period}`),
    enabled: /^\d{4}-\d{2}/.test(period),
  });
}

export function useRemitStatutory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { payPeriod: string; financeAccountId: number; paidDate: string; epfReference?: string | null; etfReference?: string | null }) =>
      apiPost('/payroll/statutory/remit', data),
    onSuccess: () => invalidatePayrollMoney(queryClient),
  });
}
