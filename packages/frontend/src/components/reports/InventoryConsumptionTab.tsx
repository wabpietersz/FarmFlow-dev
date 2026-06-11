import { useState } from 'react';
import { Download, Package2 } from 'lucide-react';
import { toast } from 'sonner';
import { useBatches } from '@/hooks/useBatches';
import { useSites } from '@/hooks/useSites';
import {
  exportReportCsv,
  useBatchInventoryConsumption,
  type BatchInventoryConsumptionRow,
} from '@/hooks/useReports';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function getDefaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 3);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

export default function InventoryConsumptionTab() {
  const defaults = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [siteId, setSiteId] = useState('');
  const [batchId, setBatchId] = useState('');

  const { data: sitesData } = useSites();
  const { data: batchesData } = useBatches({ limit: 100 });
  const sites = (sitesData as unknown as { data: { id: number; siteName: string }[] })?.data ?? [];
  const batches = batchesData?.data ?? [];

  const filters = {
    startDate,
    endDate,
    ...(siteId ? { siteId: Number(siteId) } : {}),
    ...(batchId ? { batchId: Number(batchId) } : {}),
  };

  const { data, isLoading } = useBatchInventoryConsumption(filters);
  const rows: BatchInventoryConsumptionRow[] = data?.data?.rows ?? [];
  const totals = data?.data?.totals;

  const handleExport = async () => {
    try {
      await exportReportCsv('batch-inventory-consumption', {
        startDate,
        endDate,
        ...(siteId ? { siteId } : {}),
        ...(batchId ? { batchId } : {}),
      });
      toast.success('Report exported successfully');
    } catch {
      toast.error('Failed to export report');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">From</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-[160px]" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">To</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-[160px]" />
          </div>
        </div>
        <Select value={siteId || 'all'} onValueChange={(value) => setSiteId(value === 'all' ? '' : value)}>
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
        <Select value={batchId || 'all'} onValueChange={(value) => setBatchId(value === 'all' ? '' : value)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="All Batches" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Batches</SelectItem>
            {batches.map((batch) => (
              <SelectItem key={batch.id} value={String(batch.id)}>{batch.batchCode}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Quantity Consumed</p>
            <p className="text-2xl font-semibold">{(totals?.totalQuantity ?? 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Cost</p>
            <p className="text-2xl font-semibold">Rs. {(totals?.totalCost ?? 0).toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package2 className="h-5 w-5" />
            Batch Inventory Consumption
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading report...</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No inventory consumption data for the selected filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Line Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.batchCode}</TableCell>
                      <TableCell>{row.siteName || '--'}</TableCell>
                      <TableCell>{row.ingredientName}</TableCell>
                      <TableCell>{row.typeName}</TableCell>
                      <TableCell>{new Date(row.consumptionDate).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">{Number(row.quantity).toLocaleString()} {row.unit}</TableCell>
                      <TableCell className="text-right">Rs. {Number(row.unitCost).toFixed(2)}</TableCell>
                      <TableCell className="text-right">Rs. {Number(row.lineCost).toFixed(2)}</TableCell>
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
