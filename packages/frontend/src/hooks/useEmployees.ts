import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import type {
  Employee,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  EmergencyContact,
  BankDetails,
} from '@farmflow/shared';

interface EmployeeListResponse {
  data: (Employee & { siteName?: string })[];
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
}

export function useEmployees(params: EmployeeListParams) {
  const queryString = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();

  return useQuery({
    queryKey: ['employees', params],
    queryFn: () => apiGet<(Employee & { siteName?: string })[]>(`/employees?${queryString}`) as unknown as Promise<EmployeeListResponse>,
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
