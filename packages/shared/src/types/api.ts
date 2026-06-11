export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  statusCode?: number;
  timestamp?: string;
}

export interface PaginatedResponse<T = unknown> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DashboardSummary {
  activeBatches: number;
  averageFcr: number;
  mortalityLast7Days: number;
  outstandingPayments: number;
  totalEmployees: number;
  recentSales: {
    count: number;
    totalAmount: number;
  };
}

export interface DashboardTrend {
  value: number;
  previousValue: number;
  changePercent: number;
  direction: 'up' | 'down' | 'flat';
  sparkline: number[];
}

export interface EnhancedDashboardSummary extends DashboardSummary {
  mortalityTrend: DashboardTrend;
  salesTrend: DashboardTrend;
  averageFcrTrend: DashboardTrend;
  feedInventoryStatus: {
    totalItems: number;
    lowStockItems: number;
    totalValue: number;
  };
  pendingPayroll: {
    count: number;
    totalAmount: number;
  };
  attendanceRate: {
    rate: number;
    presentToday: number;
    totalActive: number;
  };
}

export interface ExecutiveDashboardSummary {
  cash: {
    totalBookBalance: number;
    bankBalance: number;
    onHandBalance: number;
    pendingCheques: number;
    lastReconciliationAt?: string | null;
  };
  payables: {
    overdueAmount: number;
    pendingApprovalCount: number;
  };
  receivables: {
    outstandingAmount: number;
  };
  profitability: {
    activeBatchCount: number;
    totalRevenue: number;
    totalCost: number;
    grossMargin: number;
  };
}

export interface DashboardExceptionsData {
  summary: {
    negativeStockRisk: number;
    paymentWithoutTreasuryLink: number;
    chequeAgeing: number;
    unreconciledBalances: number;
    overduePayables: number;
    overdueReceivables: number;
    expiredContracts: number;
    missingCostComponents: number;
  };
  negativeStockRisk: Array<{
    id: number;
    itemName: string;
    quantity: number;
    reorderLevel?: number | null;
  }>;
  paymentWithoutTreasuryLink: Array<{
    id: number;
    code?: string | null;
    date?: string | null;
    source: string;
    amount: number | string;
  }>;
  chequeAgeing: Array<{
    id: number;
    referenceNumber?: string | null;
    transactionDate: string;
    status: string;
    ageDays: number;
  }>;
  unreconciledBalances: Array<{
    financeAccountId: number;
    accountName: string;
    unclearedCount: number;
  }>;
  overduePayables: Array<{
    id: number;
    invoiceCode: string;
    dueDate: string;
    balanceDue: number;
  }>;
  overdueReceivables: Array<{
    id: number;
    saleCode: string;
    buyerName?: string | null;
    dueDate: string;
    balanceDue: number;
  }>;
  expiredContracts: Array<{
    id: number;
    contractCode: string;
    contractTitle: string;
    validTo?: string | null;
    status: string;
  }>;
  missingCostComponents: Array<{
    batchId: number;
    batchCode: string;
    missingPlacement: boolean;
    missingFeed: boolean;
    missingLabor: boolean;
    hasRevenue: boolean;
  }>;
}

export type DashboardPeriod = '7d' | '30d' | '90d' | 'ytd';

export interface BatchComparisonCurvePoint {
  age: number;
  value: number;
}

export interface BatchComparisonEntry {
  batchId: number;
  batchCode: string;
  siteName: string;
  chicksPlaced: number;
  currentBirdCount: number;
  mortalityRate: number;
  fcr: number;
  totalFeedConsumed: number;
  averageWeight: number;
  curves: {
    fcr: BatchComparisonCurvePoint[];
    growth: BatchComparisonCurvePoint[];
    mortality: BatchComparisonCurvePoint[];
    feedEfficiency: BatchComparisonCurvePoint[];
  };
}

export interface BatchComparisonData {
  batches: BatchComparisonEntry[];
}

export interface BatchProfitabilityEntry {
  batchId: number;
  batchCode: string;
  siteName: string;
  chicksPlaced: number;
  birdsSold: number;
  revenue: number;
  feedCost: number;
  laborCost: number;
  totalCost: number;
  grossMargin: number;
  profitMargin: number;
  costPerBird: number;
}

export interface BatchProfitabilityData {
  batches: BatchProfitabilityEntry[];
  totals: {
    totalRevenue: number;
    totalFeedCost: number;
    totalLaborCost: number;
    totalGrossMargin: number;
    averageProfitMargin: number;
  };
}

export interface HRAnalyticsData {
  attendanceByMonth: { month: string; presentCount: number; totalCount: number; rate: number }[];
  attendanceByEmployee: { employeeId: number; name: string; presentDays: number; totalDays: number; rate: number }[];
  leaveUtilization: { leaveType: string; totalAllocated: number; totalUsed: number; utilizationRate: number }[];
  payrollByMonth: { month: string; grossTotal: number; netTotal: number; employeeCount: number }[];
  overtimeByMonth: { month: string; totalHours: number; avgRate: number; totalCost: number }[];
}

export interface FeedAnalyticsData {
  fcrByBatch: { batchCode: string; placementDate: string; fcr: number }[];
  feedCostPerBird: { batchCode: string; costPerBird: number; totalFeedCost: number }[];
  inventoryTurnover: { ingredientName: string; currentStock: number; totalDistributed: number; turnoverRate: number; daysUntilReorder: number | null }[];
  productionEfficiency: { productionCode: string; plannedQty: number; actualQty: number; efficiency: number; productionDate: string }[];
}

export interface RecentActivity {
  id: number;
  type: 'batch' | 'sale' | 'employee' | 'feed' | 'payroll' | 'attendance';
  action: string;
  entityId: number;
  description: string;
  timestamp: string;
}
