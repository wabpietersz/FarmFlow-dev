import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AccessLevel, AccessMatrix, AccessModuleKey } from '@farmflow/shared';
import { apiGet, apiPut } from '@/lib/api';

export function useAccessMatrix() {
  return useQuery({ queryKey: ['access-matrix'], queryFn: () => apiGet<AccessMatrix>('/auth/access') });
}

export function useSetAccessLevel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { role: string; moduleKey: AccessModuleKey; level: AccessLevel }) => apiPut<AccessMatrix>('/auth/access', data),
    onSuccess: (result) => queryClient.setQueryData(['access-matrix'], result),
  });
}
