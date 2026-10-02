import { useMemo, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import {
  useBatchPerformance,
  useSalesSummary,
  useMortalityTrends,
  useFinancialOverview,
  useBuyerOutstandingAdvanceSummary,
  usePayrollDisbursementSummary,
  usePettyCashOutstandingSummary,
  useSupplierPaymentSummary,
  exportReportCsv,
  type BatchPerformanceItem,
  type MortalityTrendPoint,
  type FinancialOverviewData,
} from '@/hooks/useReports';
import { useSites } from '@/hooks/useSites';
import { useBatches } from '@/hooks/useBatches';
import { useBuyers } from '@/hooks/useSales';
import BatchComparisonTab from '@/components/reports/BatchComparisonTab';
import BatchProfitabilityTab from '@/components/reports/BatchProfitabilityTab';
import HRAnalyticsTab from '@/components/reports/HRAnalyticsTab';
import FeedAnalyticsTab from '@/components/reports/FeedAnalyticsTab';
import InventoryConsumptionTab from '@/components/reports/InventoryConsumptionTab';
import CostAllocationTab from '@/components/reports/CostAllocationTab';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Activity,
  Layers,
  CircleDollarSign,
  Users,
  Wheat,
  Package2,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatCurrencyCompact } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';

const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-4)', 'var(--chart-3)', 'var(--chart-5)', 'var(--danger)'];

function getDefaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

const formatNumber = (v: number) => v.toLocaleString();

const formatPercent = (v: number) => `${v.toFixed(1)}%`;

// --- Summary Metric Card ---

function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  loading,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | null;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
          </div>
          <div className="flex items-center gap-1">
            {trend === 'up' && <TrendingUp className="h-4 w-4 text-success" />}
            {trend === 'down' && <TrendingDown className="h-4 w-4 text-danger" />}
            <Icon className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Filter Row ---

function FilterRow({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  children,
}: {
  startDate: string;
  endDate: string;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end">
      <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">From</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="w-full sm:w-[160px]"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">To</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="w-full sm:w-[160px]"
          />
        </div>
      </div>
      {children ? <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">{children}</div> : null}
    </div>
  );
}

// --- Tab: Batch Performance ---

function BatchPerformanceTab() {
  const defaults = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [siteId, setSiteId] = useState<string>('');

  const { data: sitesData } = useSites();
  const sites = (sitesData as unknown as { data: { id: number; siteName: string }[] })?.data ?? [];

  const filters = {
    startDate,
    endDate,
    ...(siteId ? { siteId: Number(siteId) } : {}),
  };

  const { data: reportData, isLoading } = useBatchPerformance(filters);

  const batchData = (reportData as unknown as { data?: BatchPerformanceItem[] })?.data ?? (reportData as unknown as BatchPerformanceItem[]) ?? [];
  const batches: BatchPerformanceItem[] = Array.isArray(batchData) ? batchData : [];

  const totalBatches = batches.length;
  const avgFcr = batches.length > 0
    ? batches.reduce((sum, b) => sum + (b.fcr ?? 0), 0) / (batches.filter((b) => b.fcr > 0).length || 1)
    : 0;
  const totalMortality = batches.reduce((sum, b) => sum + b.totalMortality, 0);
  const totalBirds = batches.reduce((sum, b) => sum + b.chicksPlaced, 0);

  const handleExport = async () => {
    try {
      await exportReportCsv('batch-performance', { startDate, endDate, ...(siteId ? { siteId } : {}) });
      toast.success('Report exported successfully');
    } catch {
      toast.error('Failed to export report');
    }
  };

  return (
    <div className="space-y-6">
      <FilterRow
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
      >
        <Select value={siteId || 'all'} onValueChange={(v) => setSiteId(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Sites" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sites</SelectItem>
            {sites.map((site) => (
              <SelectItem key={site.id} value={String(site.id)}>
                {site.siteName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handleExport} className="w-full gap-2 sm:w-auto">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </FilterRow>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Batches" value={formatNumber(totalBatches)} icon={BarChart3} loading={isLoading} />
        <MetricCard title="Avg FCR" value={avgFcr ? avgFcr.toFixed(2) : '--'} icon={TrendingUp} loading={isLoading} />
        <MetricCard title="Total Mortality" value={formatNumber(totalMortality)} icon={Activity} loading={isLoading} />
        <MetricCard title="Total Birds" value={formatNumber(totalBirds)} icon={BarChart3} loading={isLoading} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Batch Details</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : batches.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">No batch data found</h3>
              <p className="text-sm text-muted-foreground">Try adjusting the date range or filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch Code</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead className="text-right">Placed</TableHead>
                    <TableHead className="text-right">Current</TableHead>
                    <TableHead className="text-right">Mortality %</TableHead>
                    <TableHead className="text-right">FCR</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch) => (
                    <TableRow key={batch.batchId}>
                      <TableCell className="font-medium">{batch.batchCode}</TableCell>
                      <TableCell className="text-muted-foreground">{batch.siteName}</TableCell>
                      <TableCell className="text-right">{formatNumber(batch.chicksPlaced)}</TableCell>
                      <TableCell className="text-right">{formatNumber(batch.currentBirdCount)}</TableCell>
                      <TableCell className="text-right">{formatPercent(batch.mortalityRate)}</TableCell>
                      <TableCell className="text-right">{batch.fcr > 0 ? batch.fcr.toFixed(2) : '--'}</TableCell>
                      <TableCell>
                        <StatusBadge status={batch.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Tab: Sales Summary ---

function SalesSummaryTab() {
  const defaults = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [buyerId, setBuyerId] = useState<string>('');

  const { data: buyersData } = useBuyers({ status: 'active', limit: 100 });
  const buyers = buyersData?.data ?? [];

  const filters = {
    startDate,
    endDate,
    ...(buyerId ? { buyerId: Number(buyerId) } : {}),
  };

  const { data: reportData, isLoading } = useSalesSummary(filters);
  const salesSummary = reportData?.data;

  const totalSales = salesSummary?.totalSales ?? 0;
  const totalRevenue = salesSummary?.totalRevenue ?? 0;
  const avgPricePerBird = salesSummary?.averagePricePerBird ?? 0;
  const outstanding = salesSummary?.totalOutstanding ?? 0;
  const byMonth = salesSummary?.byMonth ?? [];
  const byBuyer = salesSummary?.byBuyer ?? [];

  const pieData = useMemo(() => {
    if (byBuyer.length === 0) return [];
    const sorted = [...byBuyer].sort((a, b) => b.revenue - a.revenue);
    const top5 = sorted.slice(0, 5);
    const otherTotal = sorted.slice(5).reduce((sum, item) => sum + item.revenue, 0);
    const result: { name: string; value: number }[] = top5.map((item) => ({
      name: item.buyerName ?? 'Unknown',
      value: item.revenue,
    }));
    if (otherTotal > 0) {
      result.push({ name: 'Other', value: otherTotal });
    }
    return result;
  }, [byBuyer]);

  const barData = useMemo(() => {
    return byMonth.map((item) => ({
      month: item.month,
      revenue: item.revenue,
      count: item.count,
    }));
  }, [byMonth]);

  const handleExport = async () => {
    try {
      await exportReportCsv('sales-summary', { startDate, endDate, ...(buyerId ? { buyerId } : {}) });
      toast.success('Report exported successfully');
    } catch {
      toast.error('Failed to export report');
    }
  };

  return (
    <div className="space-y-6">
      <FilterRow startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate}>
        <Select value={buyerId || 'all'} onValueChange={(v) => setBuyerId(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Buyers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Buyers</SelectItem>
            {buyers.map((buyer) => (
              <SelectItem key={buyer.id} value={String(buyer.id)}>{buyer.buyerName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handleExport} className="w-full gap-2 sm:w-auto">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </FilterRow>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Sales" value={formatNumber(totalSales)} icon={BarChart3} loading={isLoading} />
        <MetricCard title="Total Revenue" value={formatCurrency(totalRevenue)} icon={DollarSign} loading={isLoading} />
        <MetricCard title="Avg Price/Bird" value={formatCurrency(avgPricePerBird)} icon={TrendingUp} loading={isLoading} />
        <MetricCard title="Outstanding Balance" value={formatCurrency(outstanding)} icon={DollarSign} loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Revenue by Month</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[300px] w-full" /> : barData.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">No sales data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v: unknown) => formatCurrencyCompact(Number(v))} />
                  <Tooltip formatter={(value: unknown) => [formatCurrency(Number(value)), 'Revenue']} labelStyle={{ fontWeight: 'bold' }} />
                  <Legend />
                  <Bar dataKey="revenue" name="Revenue" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Revenue by Buyer</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[300px] w-full" /> : pieData.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">No buyer data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} (${((percent ?? 0) * 100).toFixed(0)}%)`} labelLine>
                    {pieData.map((_, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value: unknown) => [formatCurrency(Number(value)), 'Revenue']} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// --- Tab: Mortality Trends ---

function MortalityTrendsTab() {
  const defaults = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [siteId, setSiteId] = useState<string>('');
  const [batchId, setBatchId] = useState<string>('');

  const { data: sitesData } = useSites();
  const sites = (sitesData as unknown as { data: { id: number; siteName: string }[] })?.data ?? [];

  const { data: batchesData } = useBatches({ limit: 100, ...(siteId ? { siteId: Number(siteId) } : {}) });
  const batchesList = batchesData?.data ?? [];

  const filters = {
    startDate, endDate,
    ...(siteId ? { siteId: Number(siteId) } : {}),
    ...(batchId ? { batchId: Number(batchId) } : {}),
  };

  const { data: reportData, isLoading } = useMortalityTrends(filters);
  const rawData = (reportData as unknown as { data?: MortalityTrendPoint[] })?.data ?? (reportData as unknown as MortalityTrendPoint[]) ?? [];
  const trendData: MortalityTrendPoint[] = Array.isArray(rawData) ? rawData : [];

  const chartData = useMemo(() => {
    return trendData.map((point) => ({
      date: new Date(point.date).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' }),
      mortality: point.totalMortality,
      cumulative: point.cumulativeMortality,
    }));
  }, [trendData]);

  const totalMortality = trendData.length > 0 ? trendData[trendData.length - 1].cumulativeMortality : 0;
  const avgDailyMortality = trendData.length > 0 ? trendData.reduce((sum, p) => sum + p.totalMortality, 0) / trendData.length : 0;

  const handleExport = async () => {
    try {
      await exportReportCsv('mortality-trends', { startDate, endDate, ...(siteId ? { siteId } : {}), ...(batchId ? { batchId } : {}) });
      toast.success('Report exported successfully');
    } catch { toast.error('Failed to export report'); }
  };

  return (
    <div className="space-y-6">
      <FilterRow startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate}>
        <Select value={siteId || 'all'} onValueChange={(v) => { setSiteId(v === 'all' ? '' : v); setBatchId(''); }}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="All Sites" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sites</SelectItem>
            {sites.map((site) => <SelectItem key={site.id} value={String(site.id)}>{site.siteName}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={batchId || 'all'} onValueChange={(v) => setBatchId(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="All Batches" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Batches</SelectItem>
            {batchesList.map((batch) => <SelectItem key={batch.id} value={String(batch.id)}>{batch.batchCode}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handleExport} className="w-full gap-2 sm:w-auto"><Download className="h-4 w-4" />Export CSV</Button>
      </FilterRow>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard title="Total Mortality" value={formatNumber(totalMortality)} icon={Activity} loading={isLoading} />
        <MetricCard title="Avg Daily Mortality" value={avgDailyMortality.toFixed(1)} icon={TrendingDown} loading={isLoading} />
        <MetricCard title="Days Tracked" value={formatNumber(trendData.length)} icon={BarChart3} loading={isLoading} />
      </div>

      <Card>
        <CardHeader><CardTitle>Daily Mortality Trend</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-[400px] w-full" /> : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground">No mortality data for this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis yAxisId="daily" fontSize={12} />
                <YAxis yAxisId="cumulative" orientation="right" fontSize={12} />
                <Tooltip /><Legend />
                <Line yAxisId="daily" type="monotone" dataKey="mortality" name="Daily Mortality" stroke={CHART_COLORS[2]} strokeWidth={2} dot={false} />
                <Line yAxisId="cumulative" type="monotone" dataKey="cumulative" name="Cumulative" stroke={CHART_COLORS[0]} strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Tab: Financial Overview ---

function FinancialOverviewTab() {
  const defaults = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);

  const { data: reportData, isLoading } = useFinancialOverview({ startDate, endDate });
  const { data: buyerSummaryData, isLoading: buyerSummaryLoading } = useBuyerOutstandingAdvanceSummary();
  const { data: payrollSummaryData, isLoading: payrollSummaryLoading } = usePayrollDisbursementSummary({ startDate, endDate });
  const { data: pettyCashSummaryData, isLoading: pettyCashSummaryLoading } = usePettyCashOutstandingSummary();
  const { data: supplierPaymentSummaryData, isLoading: supplierPaymentSummaryLoading } = useSupplierPaymentSummary({ startDate, endDate });
  const fin = reportData?.data as unknown as FinancialOverviewData | undefined;

  const recentTransactions = fin?.recentTransactions ?? [];
  const buyerSummary = buyerSummaryData?.data;
  const payrollSummary = payrollSummaryData?.data;
  const pettyCashSummary = pettyCashSummaryData?.data;
  const supplierPaymentSummary = supplierPaymentSummaryData?.data;

  const handleExport = async () => {
    try {
      await exportReportCsv('financial-overview', { startDate, endDate });
      toast.success('Report exported successfully');
    } catch {
      toast.error('Failed to export report');
    }
  };

  return (
    <div className="space-y-6">
      <FilterRow startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate}>
        <Button variant="outline" size="sm" onClick={handleExport} className="w-full gap-2 sm:w-auto"><Download className="h-4 w-4" />Export CSV</Button>
      </FilterRow>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Sales Revenue" value={formatCurrency(fin?.salesRevenue ?? 0)} icon={DollarSign} loading={isLoading} />
        <MetricCard title="Treasury Inflows" value={formatCurrency(fin?.treasuryInflows ?? 0)} icon={TrendingUp} trend="up" loading={isLoading} />
        <MetricCard title="Treasury Outflows" value={formatCurrency(fin?.treasuryOutflows ?? 0)} icon={TrendingDown} trend={(fin?.treasuryOutflows ?? 0) > 0 ? 'down' : null} loading={isLoading} />
        <MetricCard title="Net Cash Movement" value={formatCurrency(fin?.netCashMovement ?? 0)} icon={Activity} trend={(fin?.netCashMovement ?? 0) >= 0 ? 'up' : 'down'} loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Customer Receipts" value={formatCurrency(fin?.customerReceiptInflows ?? 0)} icon={CircleDollarSign} loading={isLoading} />
        <MetricCard title="Payroll Outflows" value={formatCurrency(fin?.payrollOutflows ?? 0)} icon={Users} loading={isLoading} />
        <MetricCard title="Supplier Payments" value={formatCurrency(fin?.supplierPaymentOutflows ?? 0)} icon={Package2} loading={isLoading} />
        <MetricCard title="Petty Cash Net" value={formatCurrency(fin?.pettyCashNet ?? 0)} icon={TrendingDown} trend={(fin?.pettyCashNet ?? 0) >= 0 ? 'up' : 'down'} loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Recent Treasury Activity</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[300px] w-full" /> : recentTransactions.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">No transactions for this period</div>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((tx) => (
                  <div key={tx.transactionId} className="flex items-center justify-between rounded-lg bg-muted p-3">
                    <div>
                      <p className="font-medium text-sm">{tx.transactionCode}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {tx.transactionType.replace(/_/g, ' ')} • {new Date(tx.transactionDate).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[tx.counterpartyName, tx.accountNames, tx.sourceCodeSnapshot].filter(Boolean).join(' • ') || 'No reconciliation detail'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">{formatCurrency(tx.netAmount)}</p>
                      <p className={`text-xs capitalize ${tx.status === 'cleared' ? 'text-success' : tx.status === 'bounced' ? 'text-danger' : 'text-info'}`}>{tx.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Cash Movement Summary</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[300px] w-full" /> : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">Commercial Revenue</p>
                    <p className="mt-2 text-xl font-bold">{formatCurrency(fin?.salesRevenue ?? 0)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Kept separate from treasury cash totals.</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">Net Treasury Cash</p>
                    <p className={`mt-2 text-xl font-bold ${(fin?.netCashMovement ?? 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                      {formatCurrency(fin?.netCashMovement ?? 0)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatCurrency(fin?.treasuryInflows ?? 0)} in minus {formatCurrency(fin?.treasuryOutflows ?? 0)} out
                    </p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={[
                      { label: 'Receipts', value: fin?.customerReceiptInflows ?? 0 },
                      { label: 'Payroll', value: fin?.payrollOutflows ?? 0 },
                      { label: 'Suppliers', value: fin?.supplierPaymentOutflows ?? 0 },
                      { label: 'Petty Cash', value: Math.abs(fin?.pettyCashNet ?? 0) },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={(value: unknown) => [formatCurrency(Number(value))]} />
                    <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Buyer Outstanding / Advance Summary</CardTitle></CardHeader>
        <CardContent>
          {buyerSummaryLoading ? <Skeleton className="h-[240px] w-full" /> : !buyerSummary ? (
            <div className="flex items-center justify-center h-[160px] text-muted-foreground">No buyer ledger summary available.</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm text-muted-foreground">Outstanding</p>
                  <p className="mt-2 text-xl font-bold text-danger">{formatCurrency(buyerSummary.totals.outstandingBalance)}</p>
                </div>
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm text-muted-foreground">Advance Credit</p>
                  <p className="mt-2 text-xl font-bold text-success">{formatCurrency(buyerSummary.totals.advanceCredit)}</p>
                </div>
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm text-muted-foreground">Applied Receipts</p>
                  <p className="mt-2 text-xl font-bold">{formatCurrency(buyerSummary.totals.totalAppliedToSales)}</p>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Buyer</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Advance</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {buyerSummary.rows.slice(0, 8).map((row) => (
                    <TableRow key={row.buyerId}>
                      <TableCell className="font-medium">{row.buyerName}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.outstandingBalance)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.advanceCredit)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.netBalance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Payroll Disbursement Summary</CardTitle></CardHeader>
          <CardContent>
            {payrollSummaryLoading ? <Skeleton className="h-[240px] w-full" /> : !payrollSummary ? (
              <div className="flex items-center justify-center h-[160px] text-muted-foreground">No payroll treasury disbursements for this period.</div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-sm text-muted-foreground">Total Disbursed</p>
                    <p className="mt-2 text-xl font-bold">{formatCurrency(payrollSummary.totals.totalDisbursed)}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-sm text-muted-foreground">Cheque Disbursed</p>
                    <p className="mt-2 text-xl font-bold">{formatCurrency(payrollSummary.totals.chequeDisbursed)}</p>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollSummary.rows.slice(0, 6).map((row) => (
                      <TableRow key={row.payrollId}>
                        <TableCell className="font-medium">{row.employeeName}</TableCell>
                        <TableCell>{row.financeAccountName || '--'}</TableCell>
                        <TableCell>{row.paymentMethod?.replace(/_/g, ' ') || '--'}{row.chequeNumber ? ` • ${row.chequeNumber}` : ''}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Supplier Payment Summary</CardTitle></CardHeader>
          <CardContent>
            {supplierPaymentSummaryLoading ? <Skeleton className="h-[240px] w-full" /> : !supplierPaymentSummary ? (
              <div className="flex items-center justify-center h-[160px] text-muted-foreground">No supplier treasury payments for this period.</div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-sm text-muted-foreground">Total Disbursed</p>
                    <p className="mt-2 text-xl font-bold">{formatCurrency(supplierPaymentSummary.totals.totalDisbursed)}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-sm text-muted-foreground">Bank Transfer Portion</p>
                    <p className="mt-2 text-xl font-bold">{formatCurrency(supplierPaymentSummary.totals.bankTransferDisbursed)}</p>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplierPaymentSummary.rows.slice(0, 6).map((row) => (
                      <TableRow key={row.supplierPaymentId}>
                        <TableCell className="font-medium">{row.paymentCode}</TableCell>
                        <TableCell>{row.supplierName || '--'}</TableCell>
                        <TableCell>{row.financeAccountName || '--'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Petty Cash Outstanding Summary</CardTitle></CardHeader>
        <CardContent>
          {pettyCashSummaryLoading ? <Skeleton className="h-[240px] w-full" /> : !pettyCashSummary ? (
            <div className="flex items-center justify-center h-[160px] text-muted-foreground">No petty cash allocations recorded.</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm text-muted-foreground">Allocated</p>
                  <p className="mt-2 text-xl font-bold">{formatCurrency(pettyCashSummary.totals.totalAllocated)}</p>
                </div>
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm text-muted-foreground">Approved</p>
                  <p className="mt-2 text-xl font-bold">{formatCurrency(pettyCashSummary.totals.totalApprovedExpenses)}</p>
                </div>
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm text-muted-foreground">Submitted</p>
                  <p className="mt-2 text-xl font-bold">{formatCurrency(pettyCashSummary.totals.totalSubmittedExpenses)}</p>
                </div>
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm text-muted-foreground">Outstanding</p>
                  <p className="mt-2 text-xl font-bold">{formatCurrency(pettyCashSummary.totals.totalOutstanding)}</p>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Allocation</TableHead>
                    <TableHead>Holder</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pettyCashSummary.rows.slice(0, 8).map((row) => (
                    <TableRow key={row.allocationId}>
                      <TableCell className="font-medium">{row.allocationCode}</TableCell>
                      <TableCell>{row.allocatedToName || '--'}</TableCell>
                      <TableCell>{row.pettyCashAccountName || '--'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.outstandingAmount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Main Reports Page ---

export default function ReportsPage() {
  const { hasPermission } = useAuthStore();
  const [activeTab, setActiveTab] = useState('batch-performance');

  if (!hasPermission('reports:read')) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You do not have permission to view reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Reports</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="sm:hidden">
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select report" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="batch-performance">Batch Performance</SelectItem>
              <SelectItem value="sales">Sales</SelectItem>
              <SelectItem value="mortality">Mortality</SelectItem>
              <SelectItem value="financial">Financial</SelectItem>
              <SelectItem value="batch-comparison">Comparison</SelectItem>
              {hasPermission('reports:financial:read') && (
                <SelectItem value="profitability">Profitability</SelectItem>
              )}
              {hasPermission('reports:financial:read') && (
                <SelectItem value="inventory-consumption">Inventory Usage</SelectItem>
              )}
              {hasPermission('reports:financial:read') && (
                <SelectItem value="cost-allocation">Cost Allocation</SelectItem>
              )}
              <SelectItem value="hr-analytics">HR & Attendance</SelectItem>
              <SelectItem value="feed-analytics">Feed Analytics</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="hidden overflow-x-auto overflow-y-hidden scrollbar-none pb-1 sm:block">
          <TabsList className="flex w-max">
            <TabsTrigger value="batch-performance" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Batch Performance
            </TabsTrigger>
            <TabsTrigger value="sales" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Sales
            </TabsTrigger>
            <TabsTrigger value="mortality" className="gap-2">
              <Activity className="h-4 w-4" />
              Mortality
            </TabsTrigger>
            <TabsTrigger value="financial" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Financial
            </TabsTrigger>
            <TabsTrigger value="batch-comparison" className="gap-2">
              <Layers className="h-4 w-4" />
              Comparison
            </TabsTrigger>
            {hasPermission('reports:financial:read') && (
              <TabsTrigger value="profitability" className="gap-2">
                <CircleDollarSign className="h-4 w-4" />
                Profitability
              </TabsTrigger>
            )}
            {hasPermission('reports:financial:read') && (
              <TabsTrigger value="inventory-consumption" className="gap-2">
                <Package2 className="h-4 w-4" />
                Inventory Usage
              </TabsTrigger>
            )}
            {hasPermission('reports:financial:read') && (
              <TabsTrigger value="cost-allocation" className="gap-2">
                <Layers className="h-4 w-4" />
                Cost Allocation
              </TabsTrigger>
            )}
            <TabsTrigger value="hr-analytics" className="gap-2">
              <Users className="h-4 w-4" />
              HR & Attendance
            </TabsTrigger>
            <TabsTrigger value="feed-analytics" className="gap-2">
              <Wheat className="h-4 w-4" />
              Feed Analytics
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="batch-performance">
          <BatchPerformanceTab />
        </TabsContent>

        <TabsContent value="sales">
          <SalesSummaryTab />
        </TabsContent>

        <TabsContent value="mortality">
          <MortalityTrendsTab />
        </TabsContent>

        <TabsContent value="financial">
          <FinancialOverviewTab />
        </TabsContent>

        <TabsContent value="batch-comparison">
          <BatchComparisonTab />
        </TabsContent>

        {hasPermission('reports:financial:read') && (
          <TabsContent value="profitability">
            <BatchProfitabilityTab />
          </TabsContent>
        )}

        {hasPermission('reports:financial:read') && (
          <TabsContent value="inventory-consumption">
            <InventoryConsumptionTab />
          </TabsContent>
        )}

        {hasPermission('reports:financial:read') && (
          <TabsContent value="cost-allocation">
            <CostAllocationTab />
          </TabsContent>
        )}

        <TabsContent value="hr-analytics">
          <HRAnalyticsTab />
        </TabsContent>

        <TabsContent value="feed-analytics">
          <FeedAnalyticsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
