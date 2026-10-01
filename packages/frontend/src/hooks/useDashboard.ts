import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { DashboardSummary, EnhancedDashboardSummary, DashboardExceptionsData, DashboardPeriod, ExecutiveDashboardSummary, RecentActivity } from '@farmflow/shared';

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

export function useExecutiveDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'executive'],
    queryFn: () => apiGet<ExecutiveDashboardSummary>('/dashboard/executive'),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useDashboardExceptions() {
  return useQuery({
    queryKey: ['dashboard', 'exceptions'],
    queryFn: () => apiGet<DashboardExceptionsData>('/dashboard/exceptions'),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export interface HomeTodo {
  key: string;
  title: string;
  detail: string;
  href: string;
  tone: 'warning' | 'danger' | 'info';
}

export interface HomeBatchCard {
  id: number;
  batchCode: string;
  siteName: string;
  ageDays: number;
  liveBirds: number;
  mortalityPct: number;
  averageWeightKg: number | null;
  costSoFar: number;
  costPerKgLive: number | null;
  note: string;
  tone: 'ok' | 'warning';
}

export interface HomeDashboard {
  money: null | {
    cashOnHand: number;
    accountCount: number;
    moneyInThisMonth: number;
    moneyOutThisMonth: number;
    moneyInLastMonth: number;
    moneyOutLastMonth: number;
    spendByGroup: Array<{ group: string; amount: number }>;
  };
  /** Owner view: this month's result and who owes whom (financial-report users only) */
  business: null | {
    monthProfit: number;
    monthIncome: number;
    monthExpenses: number;
    owedToYou: number;
    owedToYouOverdue: number;
    youOwe: number;
    youOweOverdue: number;
    approvalsWaiting: number;
  };
  liveBirds: number | null;
  batches: HomeBatchCard[] | null;
  todos: HomeTodo[];
}

export function useHomeDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'home'],
    queryFn: () => apiGet<HomeDashboard>('/dashboard/home'),
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
