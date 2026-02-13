import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { DashboardSummary, EnhancedDashboardSummary, DashboardPeriod, RecentActivity } from '@farmflow/shared';

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => apiGet<DashboardSummary>('/dashboard/summary'),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useEnhancedDashboard(period: DashboardPeriod = '7d') {
  return useQuery({
    queryKey: ['dashboard', 'enhanced', period],
    queryFn: () => apiGet<EnhancedDashboardSummary>(`/dashboard/enhanced?period=${period}`),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useRecentActivity(limit: number = 10) {
  return useQuery({
    queryKey: ['dashboard', 'recent-activity', limit],
    queryFn: () => apiGet<RecentActivity[]>(`/dashboard/recent-activity?limit=${limit}`),
    staleTime: 1 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });
}
