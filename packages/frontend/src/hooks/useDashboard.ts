import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { DashboardSummary } from '@farmflow/shared';

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => apiGet<DashboardSummary>('/dashboard/summary'),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
