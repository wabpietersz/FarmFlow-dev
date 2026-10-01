import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import type { CreateUserRequest, UserRole } from '@farmflow/shared';

export interface UserListItem {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  userRole: string;
  siteId: number | null;
  siteName: string | null;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  userRole?: UserRole;
  siteId?: number | null;
  isActive?: boolean;
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => apiGet<UserListItem[]>('/auth/users'),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserRequest) =>
      apiPost<{ user: unknown; passwordResetLink: string }>('/auth/register', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateUserRequest }) =>
      apiPut<unknown>(`/auth/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useResendResetLink() {
  return useMutation({
    mutationFn: (userId: number) =>
      apiPost<{ passwordResetLink: string; emailSent?: boolean }>(`/auth/users/${userId}/reset-password`, {}),
  });
}
