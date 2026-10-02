import { useState, useMemo } from 'react';
import { useFeedAnalytics, exportReportCsv } from '@/hooks/useReports';
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
} from 'recharts';
import { Download, Activity, DollarSign, Wheat, Factory } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';

const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-4)', 'var(--chart-3)'];

function getDefaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 6);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

export default function FeedAnalyticsTab() {
  const defaults = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);

  const { data: reportData, isLoading } = useFeedAnalytics({ startDate, endDate });
  const analytics = reportData?.data;

  const fcrByBatch = analytics?.fcrByBatch ?? [];
  const feedCostPerBird = analytics?.feedCostPerBird ?? [];
  const inventoryTurnover = analytics?.inventoryTurnover ?? [];
  const productionEfficiency = analytics?.productionEfficiency ?? [];

  const avgFcr = useMemo(() => {
    const validFcrs = fcrByBatch.filter((b) => b.fcr > 0);
    return validFcrs.length > 0 ? validFcrs.reduce((s, b) => s + b.fcr, 0) / validFcrs.length : 0;
  }, [fcrByBatch]);

  const avgCostPerBird = useMemo(() => {
    const valid = feedCostPerBird.filter((b) => b.costPerBird > 0);
    return valid.length > 0 ? valid.reduce((s, b) => s + b.costPerBird, 0) / valid.length : 0;
  }, [feedCostPerBird]);

  const lowStockCount = inventoryTurnover.filter((i) => i.daysUntilReorder === 0).length;

  const avgEfficiency = useMemo(() => {
    return productionEfficiency.length > 0
      ? productionEfficiency.reduce((s, p) => s + p.efficiency, 0) / productionEfficiency.length
      : 0;
  }, [productionEfficiency]);

  const handleExport = async () => {
    try {
      await exportReportCsv('feed-analytics', { startDate, endDate });
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
        <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { title: 'Avg FCR', value: avgFcr > 0 ? avgFcr.toFixed(3) : '--', icon: Activity },
          { title: 'Avg Feed Cost/Bird', value: formatCurrency(avgCostPerBird), icon: DollarSign },
          { title: 'Low Stock Items', value: String(lowStockCount), icon: Wheat },
          { title: 'Avg Production Efficiency', value: `${avgEfficiency.toFixed(1)}%`, icon: Factory },
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* FCR Trend by Batch */}
        <Card>
          <CardHeader>
            <CardTitle>FCR Trend by Batch</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : fcrByBatch.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No FCR data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={fcrByBatch}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="batchCode" fontSize={12} angle={-45} textAnchor="end" height={60} />
                  <YAxis fontSize={12} domain={['auto', 'auto']} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="fcr" name="FCR" stroke={CHART_COLORS[0]} strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Feed Cost per Bird */}
        <Card>
          <CardHeader>
            <CardTitle>Feed Cost per Bird by Batch</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : feedCostPerBird.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No feed cost data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={feedCostPerBird}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="batchCode" fontSize={12} angle={-45} textAnchor="end" height={60} />
                  <YAxis fontSize={12} tickFormatter={(v: number) => `Rs. ${v.toFixed(0)}`} />
                  <Tooltip formatter={(value: number | undefined) => [formatCurrency(value ?? 0), 'Cost/Bird']} />
                  <Legend />
                  <Bar dataKey="costPerBird" name="Cost per Bird" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Inventory Turnover Table */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Status</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : inventoryTurnover.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No inventory data</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingredient</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventoryTurnover.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{item.ingredientName}</TableCell>
                      <TableCell className="text-right">{item.currentStock.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <StatusBadge status={item.daysUntilReorder === 0 ? 'low' : 'ok'} label={item.daysUntilReorder === 0 ? 'Low stock' : 'OK'} tone={item.daysUntilReorder === 0 ? 'danger' : undefined} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Production Efficiency Table */}
      <Card>
        <CardHeader>
          <CardTitle>Production Efficiency</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : productionEfficiency.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No production data</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Production Code</TableHead>
                    <TableHead className="text-right">Planned (kg)</TableHead>
                    <TableHead className="text-right">Actual (kg)</TableHead>
                    <TableHead className="text-right">Efficiency</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productionEfficiency.map((prod, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{prod.productionCode}</TableCell>
                      <TableCell className="text-right">{prod.plannedQty.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{prod.actualQty.toLocaleString()}</TableCell>
                      <TableCell className={`text-right font-medium ${
                        prod.efficiency >= 95 ? 'text-success' : prod.efficiency >= 80 ? 'text-warning' : 'text-danger'
                      }`}>
                        {prod.efficiency.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(prod.productionDate).toLocaleDateString()}
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
