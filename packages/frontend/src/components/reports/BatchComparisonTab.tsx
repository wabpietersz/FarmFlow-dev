import { useState, useMemo } from 'react';
import {
  useBatchComparison,
  exportReportCsv,
  type BatchComparisonEntry,
} from '@/hooks/useReports';
import { useBatches } from '@/hooks/useBatches';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Download, Layers, Check } from 'lucide-react';
import { toast } from 'sonner';

const CHART_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#ca8a04', '#7c3aed', '#06b6d4'];

type CurveType = 'fcr' | 'growth' | 'mortality' | 'feedEfficiency';

const CURVE_LABELS: Record<CurveType, string> = {
  fcr: 'FCR',
  growth: 'Growth (Weight in g)',
  mortality: 'Cumulative Mortality %',
  feedEfficiency: 'Daily Feed/Bird (kg)',
};

export default function BatchComparisonTab() {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [curveType, setCurveType] = useState<CurveType>('fcr');

  const { data: batchesData } = useBatches({ limit: 50 });
  const batchesList = batchesData?.data ?? [];

  const { data: reportData, isLoading } = useBatchComparison({ batchIds: selectedIds });
  const comparisonBatches: BatchComparisonEntry[] = reportData?.data?.batches ?? [];

  const toggleBatch = (id: number) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  };

  // Build overlay chart data: merge all batch curves into a single dataset keyed by age
  const chartData = useMemo(() => {
    if (comparisonBatches.length === 0) return [];
    const ageMap = new Map<number, Record<string, number>>();
    comparisonBatches.forEach((batch) => {
      const curve = batch.curves[curveType];
      curve.forEach((point) => {
        if (!ageMap.has(point.age)) ageMap.set(point.age, { age: point.age });
        ageMap.get(point.age)![batch.batchCode] = point.value;
      });
    });
    return Array.from(ageMap.values()).sort((a, b) => a.age - b.age);
  }, [comparisonBatches, curveType]);

  const handleExport = async () => {
    try {
      await exportReportCsv('batch-comparison', { batchIds: selectedIds.join(',') });
      toast.success('Report exported successfully');
    } catch {
      toast.error('Failed to export report');
    }
  };

  return (
    <div className="space-y-6">
      {/* Batch Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Batches to Compare (2-4)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {batchesList.map((batch) => {
              const isSelected = selectedIds.includes(batch.id);
              return (
                <Button
                  key={batch.id}
                  variant={isSelected ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleBatch(batch.id)}
                  className="gap-1"
                  disabled={!isSelected && selectedIds.length >= 4}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                  {batch.batchCode}
                </Button>
              );
            })}
          </div>
          {selectedIds.length < 2 && (
            <p className="text-sm text-muted-foreground mt-2">Select at least 2 batches to compare</p>
          )}
        </CardContent>
      </Card>

      {selectedIds.length >= 2 && (
        <>
          {/* Curve Type Selector + Export */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex gap-2">
              {(Object.keys(CURVE_LABELS) as CurveType[]).map((type) => (
                <Button
                  key={type}
                  variant={curveType === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurveType(type)}
                >
                  {CURVE_LABELS[type]}
                </Button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>

          {/* Overlay Chart */}
          <Card>
            <CardHeader>
              <CardTitle>{CURVE_LABELS[curveType]} Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[400px] w-full" />
              ) : chartData.length === 0 ? (
                <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                  <div className="text-center">
                    <Layers className="h-12 w-12 mx-auto mb-4" />
                    <p>No daily record data available for comparison</p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="age" fontSize={12} label={{ value: 'Age (days)', position: 'insideBottom', offset: -5 }} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Legend />
                    {comparisonBatches.map((batch, idx) => (
                      <Line
                        key={batch.batchId}
                        type="monotone"
                        dataKey={batch.batchCode}
                        stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Summary Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle>Summary Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Batch</TableHead>
                        <TableHead>Site</TableHead>
                        <TableHead className="text-right">Placed</TableHead>
                        <TableHead className="text-right">Current</TableHead>
                        <TableHead className="text-right">Mortality %</TableHead>
                        <TableHead className="text-right">FCR</TableHead>
                        <TableHead className="text-right">Feed (kg)</TableHead>
                        <TableHead className="text-right">Avg Weight (g)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comparisonBatches.map((batch) => (
                        <TableRow key={batch.batchId}>
                          <TableCell className="font-medium">{batch.batchCode}</TableCell>
                          <TableCell className="text-muted-foreground">{batch.siteName}</TableCell>
                          <TableCell className="text-right">{batch.chicksPlaced.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{batch.currentBirdCount.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{batch.mortalityRate.toFixed(2)}%</TableCell>
                          <TableCell className="text-right">{batch.fcr > 0 ? batch.fcr.toFixed(2) : '--'}</TableCell>
                          <TableCell className="text-right">{batch.totalFeedConsumed.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{batch.averageWeight.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
