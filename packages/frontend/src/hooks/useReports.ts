import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import api from '@/lib/api';

// --- Parameter interfaces ---

interface BatchPerformanceParams {
  siteId?: number;
  startDate?: string;
  endDate?: string;
  batchId?: number;
}

interface SalesSummaryParams {
  startDate?: string;
  endDate?: string;
  buyerId?: number;
}

interface MortalityTrendsParams {
  siteId?: number;
  startDate?: string;
  endDate?: string;
  batchId?: number;
}

interface FeedConsumptionParams {
  siteId?: number;
  startDate?: string;
  endDate?: string;
  batchId?: number;
}

interface FinancialOverviewParams {
  startDate?: string;
  endDate?: string;
}

// --- Response interfaces (matching backend) ---

export interface BatchPerformanceItem {
  batchId: number;
  batchCode: string;
  siteId: number;
  siteName: string | null;
  chicksPlaced: number;
  currentBirdCount: number;
  totalMortality: number;
  mortalityRate: number;
  totalFeedConsumed: number;
  averageWeight: number;
  fcr: number;
  batchAge: number;
  status: string;
  placementDate: string;
}

export interface SalesSummaryData {
  totalSales: number;
  totalRevenue: number;
  totalBirds: number;
  averagePricePerBird: number;
  totalPaid: number;
  totalOutstanding: number;
  byBuyer: {
    buyerId: number;
    buyerName: string | null;
    count: number;
    revenue: number;
    paid: number;
    outstanding: number;
  }[];
  byMonth: {
    month: string;
    count: number;
    revenue: number;
  }[];
}

export interface MortalityTrendPoint {
  date: string;
  totalMortality: number;
  cumulativeMortality: number;
}

export interface FeedConsumptionData {
  daily: {
    date: string;
    totalFeedConsumed: number;
    avgFeedPerBird: number;
  }[];
  inventory: {
    id: number;
    ingredientName: string;
    quantity: number;
    unit: string;
    costPerUnit: number;
    reorderLevel: number | null;
    lastRestockDate: string | null;
    lowStock: boolean;
  }[];
}

export interface FinancialOverviewData {
  totalRevenue: number;
  totalPaid: number;
  totalOutstanding: number;
  paymentsByMethod: {
    method: string;
    total: number;
    count: number;
  }[];
  recentTransactions: {
    paymentId: number;
    saleCode: string;
    amount: string;
    method: string;
    date: string;
    status: string;
  }[];
  dateRange: { start: string; end: string };
}

// --- Query string builder ---

function buildQueryString(params: Record<string, unknown> | object): string {
  return new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();
}

// --- Report hooks ---

export function useBatchPerformance(params: BatchPerformanceParams = {}) {
  const queryString = buildQueryString(params);

  return useQuery({
    queryKey: ['reports', 'batch-performance', params],
    queryFn: () => apiGet<BatchPerformanceItem[]>(`/reports/batch-performance?${queryString}`),
  });
}

export function useSalesSummary(params: SalesSummaryParams = {}) {
  const queryString = buildQueryString(params);

  return useQuery({
    queryKey: ['reports', 'sales-summary', params],
    queryFn: () => apiGet<SalesSummaryData>(`/reports/sales-summary?${queryString}`),
  });
}

export function useMortalityTrends(params: MortalityTrendsParams = {}) {
  const queryString = buildQueryString(params);

  return useQuery({
    queryKey: ['reports', 'mortality-trends', params],
    queryFn: () => apiGet<MortalityTrendPoint[]>(`/reports/mortality-trends?${queryString}`),
  });
}

export function useFeedConsumption(params: FeedConsumptionParams = {}) {
  const queryString = buildQueryString(params);

  return useQuery({
    queryKey: ['reports', 'feed-consumption', params],
    queryFn: () => apiGet<FeedConsumptionData>(`/reports/feed-consumption?${queryString}`),
  });
}

export function useFinancialOverview(params: FinancialOverviewParams = {}) {
  const queryString = buildQueryString(params);

  return useQuery({
    queryKey: ['reports', 'financial-overview', params],
    queryFn: () => apiGet<FinancialOverviewData>(`/reports/financial-overview?${queryString}`),
  });
}

// --- CSV export function ---

export async function exportReportCsv(
  reportType: string,
  params: Record<string, string> = {},
): Promise<void> {
  const queryString = new URLSearchParams({
    reportType,
    ...params,
  }).toString();

  const response = await api.get(`/reports/export/csv?${queryString}`, {
    responseType: 'blob',
  });

  const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  // Extract filename from Content-Disposition header if available
  const contentDisposition = response.headers['content-disposition'];
  let filename = `${reportType}-report.csv`;
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
    if (match?.[1]) {
      filename = match[1];
    }
  }

  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
