import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useBatch, useUpdateBatch, useCreateDailyRecord, useCreateVaccination } from '@/hooks/useBatches';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Plus, Activity, Skull, TrendingUp, Scale, Syringe, Calendar, Pencil } from 'lucide-react';
import { toast } from 'sonner';

const dailyRecordSchema = z.object({
  recordDate: z.string().min(1, 'Date is required'),
  currentAge: z.coerce.number().int().min(0),
  birdCount: z.coerce.number().int().positive(),
  mortalityCount: z.coerce.number().int().min(0).default(0),
  mortalityCause: z.string().max(100).optional(),
  waterConsumption: z.coerce.number().min(0).optional(),
  feedConsumption: z.coerce.number().min(0, 'Feed is required'),
  averageWeight: z.coerce.number().min(0).optional(),
  temperature: z.coerce.number().optional(),
  humidity: z.coerce.number().int().min(0).max(100).optional(),
  notes: z.string().max(1000).optional(),
});

const vaccinationSchema = z.object({
  vaccineType: z.string().min(1, 'Vaccine type is required').max(100),
  vaccinationDate: z.string().min(1, 'Date is required'),
  notes: z.string().max(1000).optional(),
});

const editBatchSchema = z.object({
  expectedDeliveryDate: z.string().optional(),
  actualDeliveryDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

type DailyRecordFormValues = z.infer<typeof dailyRecordSchema>;
type VaccinationFormValues = z.infer<typeof vaccinationSchema>;
type EditBatchFormValues = z.infer<typeof editBatchSchema>;

const BATCH_STATUS_COLORS: Record<string, string> = {
  placement: 'bg-blue-100 text-blue-800',
  growing: 'bg-green-100 text-green-800',
  ready_for_sale: 'bg-yellow-100 text-yellow-800',
  sold: 'bg-gray-100 text-gray-800',
  culled: 'bg-red-100 text-red-800',
};

export default function BatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuthStore();
  const { data, isLoading } = useBatch(id);
  const updateMutation = useUpdateBatch(id!);
  const createRecordMutation = useCreateDailyRecord(id!);
  const createVaxMutation = useCreateVaccination(id!);

  const [showAddRecord, setShowAddRecord] = useState(false);
  const [showAddVax, setShowAddVax] = useState(false);
  const [showStatusChange, setShowStatusChange] = useState(false);
  const [showEditBatch, setShowEditBatch] = useState(false);

  const batchData = data?.data;
  const batch = batchData?.batch;
  const records = batchData?.dailyRecords ?? [];
  const vaxRecords = batchData?.vaccinations ?? [];
  const stats = batchData?.stats;

  const recordForm = useForm<DailyRecordFormValues>({
    resolver: zodResolver(dailyRecordSchema),
    defaultValues: {
      recordDate: new Date().toISOString().split('T')[0],
      currentAge: stats?.currentAge ? stats.currentAge + 1 : 0,
      birdCount: stats?.currentBirdCount ?? 0,
      mortalityCount: 0,
      feedConsumption: 0,
    },
  });

  const vaxForm = useForm<VaccinationFormValues>({
    resolver: zodResolver(vaccinationSchema),
    defaultValues: {
      vaccineType: '',
      vaccinationDate: new Date().toISOString().split('T')[0],
      notes: '',
    },
  });

  const editBatchForm = useForm<EditBatchFormValues>({
    resolver: zodResolver(editBatchSchema),
    defaultValues: {
      expectedDeliveryDate: '',
      actualDeliveryDate: '',
      notes: '',
    },
  });

  const handleAddRecord = async (values: DailyRecordFormValues) => {
    try {
      await createRecordMutation.mutateAsync({
        ...values,
        batchId: Number(id),
        mortalityCause: values.mortalityCause || undefined,
        waterConsumption: values.waterConsumption || undefined,
        averageWeight: values.averageWeight || undefined,
        temperature: values.temperature || undefined,
        humidity: values.humidity || undefined,
        notes: values.notes || undefined,
      });
      toast.success('Daily record added');
      recordForm.reset();
      setShowAddRecord(false);
    } catch {
      toast.error('Failed to add daily record');
    }
  };

  const handleAddVax = async (values: VaccinationFormValues) => {
    try {
      await createVaxMutation.mutateAsync({
        batchId: Number(id),
        vaccineType: values.vaccineType,
        vaccinationDate: values.vaccinationDate,
        notes: values.notes || undefined,
      });
      toast.success('Vaccination recorded');
      vaxForm.reset();
      setShowAddVax(false);
    } catch {
      toast.error('Failed to record vaccination');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateMutation.mutateAsync({ status: newStatus });
      toast.success(`Batch status updated to ${newStatus.replace(/_/g, ' ')}`);
      setShowStatusChange(false);
    } catch {
      toast.error('Failed to update batch status');
    }
  };

  const handleOpenEditBatch = () => {
    if (!batch) return;
    editBatchForm.reset({
      expectedDeliveryDate: batch.expectedDeliveryDate ? String(batch.expectedDeliveryDate).split('T')[0] : '',
      actualDeliveryDate: batch.actualDeliveryDate ? String(batch.actualDeliveryDate).split('T')[0] : '',
      notes: batch.notes ?? '',
    });
    setShowEditBatch(true);
  };

  const handleUpdateBatch = async (values: EditBatchFormValues) => {
    try {
      await updateMutation.mutateAsync({
        expectedDeliveryDate: values.expectedDeliveryDate || undefined,
        actualDeliveryDate: values.actualDeliveryDate || undefined,
        notes: values.notes || undefined,
      });
      toast.success('Batch updated');
      setShowEditBatch(false);
    } catch {
      toast.error('Failed to update batch');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium">Batch not found</h3>
        <Button asChild variant="outline" className="mt-4"><Link to="/batches">Back to Batches</Link></Button>
      </div>
    );
  }

  const isActive = ['placement', 'growing', 'ready_for_sale'].includes(batch.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon"><Link to="/batches"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{batch.batchCode}</h1>
            <p className="text-sm text-muted-foreground">{batch.siteName} / Cage {batch.cageNumber}</p>
          </div>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${BATCH_STATUS_COLORS[batch.status] ?? ''}`}>
            {batch.status.replace(/_/g, ' ')}
          </span>
        </div>
        <div className="flex gap-2">
          {hasPermission('batches:update') && (
            <Button variant="outline" onClick={handleOpenEditBatch}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          {isActive && hasPermission('batches:update') && (
            <Button variant="outline" onClick={() => setShowStatusChange(true)}>Change Status</Button>
          )}
          {isActive && hasPermission('daily_records:create') && (
            <Button variant="outline" onClick={() => setShowAddRecord(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Daily Record
            </Button>
          )}
          {isActive && hasPermission('vaccinations:create') && (
            <Button variant="outline" onClick={() => setShowAddVax(true)}>
              <Syringe className="h-4 w-4 mr-2" />
              Vaccination
            </Button>
          )}
        </div>
      </div>

      {/* Batch Info */}
      <Card>
        <CardHeader><CardTitle>Batch Information</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Placement Date</p>
              <p className="font-medium">{new Date(batch.placementDate).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Chicks Placed</p>
              <p className="font-medium">{batch.chicksPlaced.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Expected Delivery</p>
              <p className="font-medium">{batch.expectedDeliveryDate ? new Date(batch.expectedDeliveryDate).toLocaleDateString() : '--'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Actual Delivery</p>
              <p className="font-medium">{batch.actualDeliveryDate ? new Date(batch.actualDeliveryDate).toLocaleDateString() : '--'}</p>
            </div>
            {batch.notes && (
              <div className="col-span-full">
                <p className="text-muted-foreground">Notes</p>
                <p className="font-medium">{batch.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{stats?.currentBirdCount?.toLocaleString() ?? '--'}</p>
                <p className="text-xs text-muted-foreground">Current Birds</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{stats?.currentAge ?? 0}</p>
                <p className="text-xs text-muted-foreground">Age (days)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">{stats?.fcr ?? '--'}</p>
                <p className="text-xs text-muted-foreground">FCR</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Skull className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-2xl font-bold">{stats?.mortalityRate ?? 0}%</p>
                <p className="text-xs text-muted-foreground">Mortality ({stats?.totalMortality ?? 0})</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">{stats?.latestWeight ? `${stats.latestWeight}g` : '--'}</p>
                <p className="text-xs text-muted-foreground">Avg Weight</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Records */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Records ({records.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No daily records yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead>Birds</TableHead>
                    <TableHead>Mortality</TableHead>
                    <TableHead>Feed (kg)</TableHead>
                    <TableHead>Water (L)</TableHead>
                    <TableHead>Avg Weight (g)</TableHead>
                    <TableHead>Temp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.slice(0, 14).map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{new Date(record.recordDate).toLocaleDateString()}</TableCell>
                      <TableCell>{record.currentAge}d</TableCell>
                      <TableCell>{record.birdCount.toLocaleString()}</TableCell>
                      <TableCell className={record.mortalityCount > 0 ? 'text-red-600 font-medium' : ''}>
                        {record.mortalityCount}
                      </TableCell>
                      <TableCell>{record.feedConsumption}</TableCell>
                      <TableCell>{record.waterConsumption ?? '--'}</TableCell>
                      <TableCell>{record.averageWeight ?? '--'}</TableCell>
                      <TableCell>{record.temperature ? `${record.temperature}°C` : '--'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vaccinations */}
      <Card>
        <CardHeader>
          <CardTitle>Vaccinations ({vaxRecords.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {vaxRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No vaccinations recorded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Vaccine</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vaxRecords.map((vax) => (
                  <TableRow key={vax.id}>
                    <TableCell>{new Date(vax.vaccinationDate).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{vax.vaccineType}</TableCell>
                    <TableCell className="text-muted-foreground">{vax.notes ?? '--'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Daily Record Dialog */}
      <Dialog open={showAddRecord} onOpenChange={setShowAddRecord}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add Daily Record</DialogTitle>
            <DialogDescription>Record today's production data for {batch.batchCode}.</DialogDescription>
          </DialogHeader>
          <Form {...recordForm}>
            <form onSubmit={recordForm.handleSubmit(handleAddRecord)} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <FormField control={recordForm.control} name="recordDate" render={({ field }) => (
                  <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={recordForm.control} name="currentAge" render={({ field }) => (
                  <FormItem><FormLabel>Age (days)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={recordForm.control} name="birdCount" render={({ field }) => (
                  <FormItem><FormLabel>Bird Count</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <FormField control={recordForm.control} name="mortalityCount" render={({ field }) => (
                  <FormItem><FormLabel>Mortality</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={recordForm.control} name="feedConsumption" render={({ field }) => (
                  <FormItem><FormLabel>Feed (kg)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={recordForm.control} name="waterConsumption" render={({ field }) => (
                  <FormItem><FormLabel>Water (L)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <FormField control={recordForm.control} name="averageWeight" render={({ field }) => (
                  <FormItem><FormLabel>Avg Weight (g)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={recordForm.control} name="temperature" render={({ field }) => (
                  <FormItem><FormLabel>Temp (°C)</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={recordForm.control} name="humidity" render={({ field }) => (
                  <FormItem><FormLabel>Humidity (%)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={recordForm.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea placeholder="Optional notes..." {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAddRecord(false)}>Cancel</Button>
                <Button type="submit" disabled={createRecordMutation.isPending}>
                  {createRecordMutation.isPending ? 'Saving...' : 'Save Record'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add Vaccination Dialog */}
      <Dialog open={showAddVax} onOpenChange={setShowAddVax}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Record Vaccination</DialogTitle>
            <DialogDescription>Record a vaccination for {batch.batchCode}.</DialogDescription>
          </DialogHeader>
          <Form {...vaxForm}>
            <form onSubmit={vaxForm.handleSubmit(handleAddVax)} className="space-y-4">
              <FormField control={vaxForm.control} name="vaccineType" render={({ field }) => (
                <FormItem><FormLabel>Vaccine Type</FormLabel><FormControl><Input placeholder="e.g. Newcastle, Gumboro" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={vaxForm.control} name="vaccinationDate" render={({ field }) => (
                <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={vaxForm.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea placeholder="Optional notes..." {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAddVax(false)}>Cancel</Button>
                <Button type="submit" disabled={createVaxMutation.isPending}>
                  {createVaxMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Change Status Dialog */}
      <Dialog open={showStatusChange} onOpenChange={setShowStatusChange}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle>Change Batch Status</DialogTitle>
            <DialogDescription>Update the status of {batch.batchCode}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {batch.status === 'placement' && (
              <Button className="w-full" onClick={() => handleStatusChange('growing')}>Move to Growing</Button>
            )}
            {(batch.status === 'placement' || batch.status === 'growing') && (
              <Button className="w-full" variant="outline" onClick={() => handleStatusChange('ready_for_sale')}>Mark Ready for Sale</Button>
            )}
            {batch.status === 'ready_for_sale' && (
              <Button className="w-full" onClick={() => handleStatusChange('sold')}>Mark as Sold</Button>
            )}
            <Button className="w-full" variant="destructive" onClick={() => handleStatusChange('culled')}>Mark as Culled</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Batch Dialog */}
      <Dialog open={showEditBatch} onOpenChange={setShowEditBatch}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Edit Batch</DialogTitle>
            <DialogDescription>Update batch details for {batch.batchCode}.</DialogDescription>
          </DialogHeader>
          <Form {...editBatchForm}>
            <form onSubmit={editBatchForm.handleSubmit(handleUpdateBatch)} className="space-y-4">
              <FormField
                control={editBatchForm.control}
                name="expectedDeliveryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Delivery Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editBatchForm.control}
                name="actualDeliveryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Actual Delivery Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editBatchForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl><Textarea placeholder="Additional notes..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowEditBatch(false)}>Cancel</Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
