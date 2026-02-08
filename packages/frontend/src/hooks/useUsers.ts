import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api';
import type { CreateUserRequest } from '@farmflow/shared';

interface UserListItem {
  id: number;
  email: string;
  fullName: string;
  userRole: string;
  siteId: number | null;
  siteName: string | null;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
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
