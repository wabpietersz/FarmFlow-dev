import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import {
  useBatchProfitability,
  exportReportCsv,
  type BatchProfitabilityEntry,
} from '@/hooks/useReports';
import { useSites } from '@/hooks/useSites';
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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Download, DollarSign, TrendingUp, TrendingDown, CircleDollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';

function getDefaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 6);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

export default function BatchProfitabilityTab() {
  const { hasPermission } = useAuthStore();
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

  const { data: reportData, isLoading } = useBatchProfitability(filters);
  const batchData: BatchProfitabilityEntry[] = reportData?.data?.batches ?? [];
  const totals = reportData?.data?.totals;

  if (!hasPermission('reports:financial:read')) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <CircleDollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">Access Restricted</h3>
          <p className="text-sm text-muted-foreground">Financial reports require elevated permissions.</p>
        </div>
      </div>
    );
  }

  const chartData = batchData.map((b) => ({
    name: b.batchCode,
    margin: b.profitMargin,
    revenue: b.revenue,
    cost: b.totalCost,
  }));

  const handleExport = async () => {
    try {
      await exportReportCsv('batch-profitability', { startDate, endDate, ...(siteId ? { siteId } : {}) });
      toast.success('Report exported successfully');
    } catch {
      toast.error('Failed to export report');
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
        <div className="flex gap-3 items-end">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">From</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-[160px]" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">To</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-[160px]" />
          </div>
        </div>
        <Select value={siteId || 'all'} onValueChange={(v) => setSiteId(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Sites" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sites</SelectItem>
            {sites.map((site) => (
              <SelectItem key={site.id} value={String(site.id)}>{site.siteName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { title: 'Total Revenue', value: formatCurrency(totals?.totalRevenue ?? 0), icon: DollarSign },
          { title: 'Total Feed Cost', value: formatCurrency(totals?.totalFeedCost ?? 0), icon: TrendingDown },
          { title: 'Total Inventory Cost', value: formatCurrency(totals?.totalInventoryCost ?? 0), icon: TrendingDown },
          { title: 'Avg Profit Margin', value: `${(totals?.averageProfitMargin ?? 0).toFixed(1)}%`, icon: TrendingUp },
        ].map((card) => (
          <Card key={card.title}>
            <CardContent className="pt-6">
              {isLoading ? (
                <>
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-32" />
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                    <p className="text-2xl font-bold text-foreground">{card.value}</p>
                  </div>
                  <card.icon className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Profit Margin Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Profit Margin by Batch</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[350px] w-full" />
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-[350px] text-muted-foreground">
              No profitability data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" fontSize={12} tickFormatter={(v: number) => `${v}%`} />
                <YAxis dataKey="name" type="category" fontSize={12} width={100} />
                <Tooltip formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)}%`, 'Profit Margin']} />
                <Legend />
                <Bar dataKey="margin" name="Profit Margin %" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.margin >= 0 ? 'var(--success)' : 'var(--danger)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* P&L Table */}
      <Card>
        <CardHeader>
          <CardTitle>Batch Profit & Loss</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : batchData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No data available</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead className="text-right">Birds Sold</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Chicks</TableHead>
                    <TableHead className="text-right">Feed Cost</TableHead>
                    <TableHead className="text-right">Inventory Cost</TableHead>
                    <TableHead className="text-right">Labor Cost</TableHead>
                    <TableHead className="text-right">Farm &amp; Overheads</TableHead>
                    <TableHead className="text-right">Gross Margin</TableHead>
                    <TableHead className="text-right">Margin %</TableHead>
                    <TableHead className="text-right">Cost/Bird</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchData.map((batch) => (
                    <TableRow key={batch.batchId}>
                      <TableCell className="font-medium">{batch.batchCode}</TableCell>
                      <TableCell className="text-muted-foreground">{batch.siteName}</TableCell>
                      <TableCell className="text-right">{batch.birdsSold.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{formatCurrency(batch.revenue)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(batch.chickCost ?? 0)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(batch.feedCost)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(batch.inventoryCost)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(batch.laborCost)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(batch.operationalExpenseCost)}</TableCell>
                      <TableCell className={`text-right font-medium ${batch.grossMargin >= 0 ? 'text-success' : 'text-danger'}`}>
                        {formatCurrency(batch.grossMargin)}
                      </TableCell>
                      <TableCell className={`text-right ${batch.profitMargin >= 0 ? 'text-success' : 'text-danger'}`}>
                        {batch.profitMargin.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(batch.costPerBird)}</TableCell>
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
