import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useBatches, useCreateBatch } from '@/hooks/useBatches';
import { useSites } from '@/hooks/useSites';
import { useCages } from '@/hooks/useSitesManagement';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BatchHistory } from '@/components/batches/BatchHistory';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Egg, Eye } from 'lucide-react';
import { toast } from 'sonner';

const createBatchFormSchema = z.object({
  batchCode: z.string().min(1, 'Batch code is required').max(50),
  siteId: z.coerce.number({ required_error: 'Site is required' }).int().positive('Site is required'),
  cageId: z.coerce.number({ required_error: 'Cage is required' }).int().positive('Cage is required'),
  chicksPlaced: z.coerce.number().int().positive('Must be a positive number'),
  placementDate: z.string().min(1, 'Placement date is required'),
  expectedDeliveryDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

type CreateBatchFormValues = z.infer<typeof createBatchFormSchema>;

const BATCH_STATUS_COLORS: Record<string, string> = {
  placement: 'bg-info-soft text-info',
  growing: 'bg-success-soft text-success',
  ready_for_sale: 'bg-warning-soft text-warning',
  sold: 'bg-muted text-foreground',
  culled: 'bg-danger-soft text-danger',
  closed: 'bg-foreground text-background',
};

export default function BatchesPage() {
  const { hasPermission } = useAuthStore();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data, isLoading } = useBatches({
    page,
    limit: 20,
    status: statusFilter || undefined,
  });

  const { data: sitesResponse } = useSites();
  const createMutation = useCreateBatch();

  const batchList = data?.data ?? [];
  const totalPages = data?.totalPages ?? 0;
  const total = data?.total ?? 0;
  const sites = sitesResponse?.data ?? [];

  const form = useForm<CreateBatchFormValues>({
    resolver: zodResolver(createBatchFormSchema),
    defaultValues: {
      batchCode: '',
      siteId: undefined,
      cageId: undefined,
      chicksPlaced: 0,
      placementDate: new Date().toISOString().split('T')[0],
      expectedDeliveryDate: '',
      notes: '',
    },
  });

  const selectedSiteId = form.watch('siteId');
  const { data: cagesData } = useCages(selectedSiteId);
  const availableCages = (cagesData?.data ?? []).filter((c) => c.status === 'empty');

  const handleCreate = async (values: CreateBatchFormValues) => {
    try {
      await createMutation.mutateAsync({
        ...values,
        expectedDeliveryDate: values.expectedDeliveryDate || undefined,
        notes: values.notes || undefined,
      });
      toast.success('Batch created successfully');
      form.reset();
      setShowCreateDialog(false);
    } catch {
      toast.error('Failed to create batch');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Batches</h1>
        {hasPermission('batches:create') && (
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Batch
          </Button>
        )}
      </div>

      <Tabs defaultValue="current">
        <TabsList>
          <TabsTrigger value="current">All batches</TabsTrigger>
          <TabsTrigger value="history">Compare closed batches</TabsTrigger>
        </TabsList>
        <TabsContent value="history" className="pt-4"><BatchHistory /></TabsContent>
        <TabsContent value="current" className="pt-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Select value={statusFilter || 'all'} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="placement">Placement</SelectItem>
                <SelectItem value="growing">Growing</SelectItem>
                <SelectItem value="ready_for_sale">Ready for Sale</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
                <SelectItem value="culled">Culled</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : batchList.length === 0 ? (
            <div className="text-center py-12">
              <Egg className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">No batches found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {statusFilter ? 'Try adjusting the status filter.' : 'Create your first batch to start tracking.'}
              </p>
              {hasPermission('batches:create') && !statusFilter && (
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Batch
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch Code</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead className="hidden sm:table-cell">Cage</TableHead>
                    <TableHead>Birds</TableHead>
                    <TableHead>Placement</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchList.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell>
                        <Link
                          to={`/batches/${batch.id}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {batch.batchCode}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{batch.siteName ?? '--'}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">{batch.cageNumber ?? '--'}</TableCell>
                      <TableCell>{batch.chicksPlaced.toLocaleString()}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(batch.placementDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize ${BATCH_STATUS_COLORS[batch.status] ?? ''}`}>
                          {batch.status.replace(/_/g, ' ')}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="icon">
                          <Link to={`/batches/${batch.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of {total}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>

      {/* Create Batch Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Batch</DialogTitle>
            <DialogDescription>Place a new batch of chicks in an available cage.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4">
              <FormField
                control={form.control}
                name="batchCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Batch Code</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. B-2026-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="siteId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Site</FormLabel>
                      <Select
                        value={field.value ? String(field.value) : ''}
                        onValueChange={(v) => {
                          field.onChange(Number(v));
                          form.setValue('cageId', undefined as unknown as number);
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select site" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sites.map((site) => (
                            <SelectItem key={site.id} value={String(site.id)}>
                              {site.siteName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cageId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cage</FormLabel>
                      <Select
                        value={field.value ? String(field.value) : ''}
                        onValueChange={(v) => field.onChange(Number(v))}
                        disabled={!selectedSiteId}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={selectedSiteId ? 'Select cage' : 'Select site first'} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableCages.length === 0 ? (
                            <SelectItem value="none" disabled>No empty cages</SelectItem>
                          ) : (
                            availableCages.map((cage) => (
                              <SelectItem key={cage.id} value={String(cage.id)}>
                                {cage.cageNumber} ({cage.capacity.toLocaleString()} cap.)
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="chicksPlaced"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Chicks</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g. 5000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="placementDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Placement Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="expectedDeliveryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected Delivery (Optional)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Any additional notes..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Batch'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
