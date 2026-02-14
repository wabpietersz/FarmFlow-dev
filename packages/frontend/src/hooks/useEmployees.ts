import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import type {
  Employee,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  EmergencyContact,
  BankDetails,
  EmployeeCompensation,
  UpsertCompensationRequest,
  EmployeeCompensationProfile,
  EmployeeCompensationRevision,
  CreateCompensationRevisionRequest,
  UpdateCompensationRevisionRequest,
} from '@farmflow/shared';

interface EmployeeListResponse {
  data: (Employee & { siteName?: string; hasCompensation?: boolean })[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface EmployeeListParams {
  page?: number;
  limit?: number;
  search?: string;
  siteId?: number;
  designation?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface EmployeeDetail {
  employee: Employee;
  emergencyContacts: EmergencyContact[];
  bankDetails: BankDetails | null;
  compensation: EmployeeCompensation | null;
}

interface CompensationHistoryResponse {
  data: EmployeeCompensationRevision[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useEmployees(params: EmployeeListParams) {
  const queryString = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();

  return useQuery({
    queryKey: ['employees', params],
    queryFn: () => apiGet<(Employee & { siteName?: string; hasCompensation?: boolean })[]>(`/employees?${queryString}`) as unknown as Promise<EmployeeListResponse>,
  });
}

export function useEmployee(id: string | undefined) {
  return useQuery({
    queryKey: ['employees', id],
    queryFn: () => apiGet<EmployeeDetail>(`/employees/${id}`),
    enabled: !!id,
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateEmployeeRequest) =>
      apiPost<Employee>('/employees', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useUpdateEmployee(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateEmployeeRequest) =>
      apiPut<Employee>(`/employees/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees', id] });
    },
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete<void>(`/employees/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useAddEmergencyContact(employeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<EmergencyContact, 'id' | 'employeeId'>) =>
      apiPost<EmergencyContact>(`/employees/${employeeId}/emergency-contacts`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId] });
    },
  });
}

export function useUpdateEmergencyContact(employeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ contactId, data }: { contactId: number; data: Omit<EmergencyContact, 'id' | 'employeeId'> }) =>
      apiPut<EmergencyContact>(`/employees/${employeeId}/emergency-contacts/${contactId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId] });
    },
  });
}

export function useDeleteEmergencyContact(employeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contactId: number) =>
      apiDelete<void>(`/employees/${employeeId}/emergency-contacts/${contactId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId] });
    },
  });
}

export function useUpsertBankDetails(employeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<BankDetails, 'id' | 'employeeId' | 'createdAt' | 'updatedAt'>) =>
      apiPost<BankDetails>(`/employees/${employeeId}/bank-details`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId] });
    },
  });
}

export function useDeleteBankDetails(employeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiDelete<void>(`/employees/${employeeId}/bank-details`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId] });
    },
  });
}

export function useUpsertCompensation(employeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertCompensationRequest) =>
      apiPut<EmployeeCompensation>(`/employees/${employeeId}/compensation`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useDeleteCompensation(employeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiDelete<void>(`/employees/${employeeId}/compensation`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useCompensationProfile(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['employees', employeeId, 'compensation-profile'],
    queryFn: () => apiGet<EmployeeCompensationProfile>(`/employees/${employeeId}/compensation`),
    enabled: !!employeeId,
  });
}

export function useCompensationHistory(employeeId: string | undefined, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['employees', employeeId, 'compensation-history', page, limit],
    queryFn: () => apiGet<EmployeeCompensationRevision[]>(`/employees/${employeeId}/compensation/history?page=${page}&limit=${limit}`) as unknown as Promise<CompensationHistoryResponse>,
    enabled: !!employeeId,
  });
}

export function useCreateCompensationRevision(employeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCompensationRevisionRequest) =>
      apiPost<EmployeeCompensationRevision>(`/employees/${employeeId}/compensation/revisions`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId, 'compensation-profile'] });
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId, 'compensation-history'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useUpdateCompensationRevision(employeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ revisionId, data }: { revisionId: number; data: UpdateCompensationRevisionRequest }) =>
      apiPut<EmployeeCompensationRevision>(`/employees/${employeeId}/compensation/revisions/${revisionId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId, 'compensation-profile'] });
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId, 'compensation-history'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useActivateCompensationRevision(employeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (revisionId: number) =>
      apiPost<EmployeeCompensationRevision>(`/employees/${employeeId}/compensation/revisions/${revisionId}/activate`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId, 'compensation-profile'] });
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId, 'compensation-history'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useDeleteCompensationRevision(employeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (revisionId: number) =>
      apiDelete<{ id: number }>(`/employees/${employeeId}/compensation/revisions/${revisionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId, 'compensation-profile'] });
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId, 'compensation-history'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}
