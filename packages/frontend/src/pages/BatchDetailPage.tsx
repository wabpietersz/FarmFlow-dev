import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { BatchPerformancePanel } from '@/components/batches/BatchPerformancePanel';
import { BatchCarePanel } from '@/components/batches/BatchCarePanel';
import { useBatch, useCreateChickPlacement, useUpdateBatch, useCreateDailyRecord, useUpdateDailyRecord, useRecordMortality, useCreateVaccination } from '@/hooks/useBatches';
import { useInventoryItems, useInventorySuppliers, useSupplierContracts } from '@/hooks/useInventoryManagement';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableActionsHead, TableActionsCell } from '@/components/ui/table';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Plus, Activity, Skull, TrendingUp, Scale, Syringe, Calendar, Pencil, AlertTriangle, ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';
import { RowActions } from '@/components/ui/row-actions';
import { StatusBadge } from '@/components/ui/status-badge';

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

const editRecordSchema = z.object({
  birdCount: z.coerce.number().int().positive(),
  mortalityCount: z.coerce.number().int().min(0),
  mortalityCause: z.string().max(100).optional(),
  feedConsumption: z.coerce.number().min(0),
  waterConsumption: z.coerce.number().min(0).optional(),
  averageWeight: z.coerce.number().min(0).optional(),
  temperature: z.coerce.number().optional(),
  humidity: z.coerce.number().int().min(0).max(100).optional(),
  notes: z.string().max(1000).optional(),
});

const mortalitySchema = z.object({
  count: z.coerce.number().int().positive('Enter at least 1'),
  cause: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

const vaccinationSchema = z.object({
  vaccineType: z.string().min(1, 'Vaccine type is required').max(100),
  vaccinationDate: z.string().min(1, 'Date is required'),
  inventoryItemId: z.string().optional(),
  quantityUsed: z.coerce.number().positive().optional(),
  notes: z.string().max(1000).optional(),
}).superRefine((data, ctx) => {
  if ((data.inventoryItemId && !data.quantityUsed) || (!data.inventoryItemId && data.quantityUsed)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Inventory item and quantity must be entered together',
      path: ['quantityUsed'],
    });
  }
});

const chickPlacementSchema = z.object({
  supplierId: z.string().optional(),
  contractId: z.string().optional(),
  placementDate: z.string().min(1, 'Date is required'),
  invoiceReference: z.string().optional(),
  deliveredQuantity: z.coerce.number().int().positive(),
  mortalityOnArrival: z.coerce.number().int().min(0).default(0),
  unitCost: z.coerce.number().min(0),
  notes: z.string().max(1000).optional(),
});

const editBatchSchema = z.object({
  expectedDeliveryDate: z.string().optional(),
  actualDeliveryDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

type DailyRecordFormValues = z.infer<typeof dailyRecordSchema>;
type EditRecordFormValues = z.infer<typeof editRecordSchema>;
type MortalityFormValues = z.infer<typeof mortalitySchema>;
type VaccinationFormValues = z.infer<typeof vaccinationSchema>;
type ChickPlacementFormValues = z.infer<typeof chickPlacementSchema>;
type EditBatchFormValues = z.infer<typeof editBatchSchema>;

export default function BatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuthStore();
  const { data, isLoading } = useBatch(id);
  const updateMutation = useUpdateBatch(id!);
  const createRecordMutation = useCreateDailyRecord(id!);
  const updateRecordMutation = useUpdateDailyRecord(id!);
  const mortalityMutation = useRecordMortality(id!);
  const createVaxMutation = useCreateVaccination(id!);
  const createChickPlacementMutation = useCreateChickPlacement(id!);
  const vaccineInventoryQuery = useInventoryItems({ category: 'health', page: 1, limit: 200 });
  const suppliersQuery = useInventorySuppliers();
  const contractsQuery = useSupplierContracts({});

  const [showAddRecord, setShowAddRecord] = useState(false);
  const [showEditRecord, setShowEditRecord] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<number | null>(null);
  const [showMortality, setShowMortality] = useState(false);
  const [showAddVax, setShowAddVax] = useState(false);
  const [showChickPlacement, setShowChickPlacement] = useState(false);
  const [showStatusChange, setShowStatusChange] = useState(false);
  const [showEditBatch, setShowEditBatch] = useState(false);

  const batchData = data?.data;
  const batch = batchData?.batch;
  const chickPlacement = batchData?.chickPlacement;
  const records = batchData?.dailyRecords ?? [];
  const vaxRecords = batchData?.vaccinations ?? [];
  const stats = batchData?.stats;

  const mortalityForm = useForm<MortalityFormValues>({
    resolver: zodResolver(mortalitySchema),
    defaultValues: { count: 1, cause: '', notes: '' },
  });

  const editRecordForm = useForm<EditRecordFormValues>({
    resolver: zodResolver(editRecordSchema),
    defaultValues: {
      birdCount: 0,
      mortalityCount: 0,
      feedConsumption: 0,
    },
  });

  const recordForm = useForm<DailyRecordFormValues>({
    resolver: zodResolver(dailyRecordSchema),
    defaultValues: {
      recordDate: new Date().toISOString().split('T')[0],
      currentAge: 0,
      birdCount: 0,
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

  const chickPlacementForm = useForm<ChickPlacementFormValues>({
    resolver: zodResolver(chickPlacementSchema),
    defaultValues: {
      supplierId: chickPlacement?.supplierId ? String(chickPlacement.supplierId) : '',
      contractId: chickPlacement?.contractId ? String(chickPlacement.contractId) : '',
      placementDate: chickPlacement?.placementDate ? String(chickPlacement.placementDate).split('T')[0] : new Date().toISOString().split('T')[0],
      invoiceReference: chickPlacement?.invoiceReference ?? '',
      deliveredQuantity: chickPlacement?.deliveredQuantity ?? batch?.chicksPlaced ?? 0,
      mortalityOnArrival: chickPlacement?.mortalityOnArrival ?? 0,
      unitCost: chickPlacement?.unitCost ?? 0,
      notes: chickPlacement?.notes ?? '',
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

  const handleRecordMortality = async (values: MortalityFormValues) => {
    try {
      await mortalityMutation.mutateAsync({
        batchId: Number(id),
        count: values.count,
        cause: values.cause || undefined,
        notes: values.notes || undefined,
      });
      toast.success(`${values.count} mortality recorded`);
      mortalityForm.reset({ count: 1, cause: '', notes: '' });
      setShowMortality(false);
    } catch {
      toast.error('Failed to record mortality');
    }
  };

  const handleOpenDailyRecord = () => {
    const age = stats?.currentAge ? stats.currentAge + 1 : batch ? Math.floor((new Date().getTime() - new Date(batch.placementDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
    recordForm.reset({
      recordDate: new Date().toISOString().split('T')[0],
      currentAge: age,
      birdCount: stats?.currentBirdCount ?? batch?.chicksPlaced ?? 0,
      mortalityCount: 0,
      feedConsumption: 0,
    });
    setShowAddRecord(true);
  };

  // Auto-adjust bird count when mortality is entered in the daily record form
  const watchedMortality = recordForm.watch('mortalityCount');
  useEffect(() => {
    const baseBirdCount = stats?.currentBirdCount ?? batch?.chicksPlaced ?? 0;
    const mortality = watchedMortality || 0;
    recordForm.setValue('birdCount', Math.max(0, baseBirdCount - mortality));
  }, [watchedMortality, stats?.currentBirdCount, batch?.chicksPlaced, recordForm]);

  const handleOpenEditRecord = (record: { id: number; birdCount: number; mortalityCount: number; mortalityCause?: string | null; feedConsumption: number; waterConsumption?: number | null; averageWeight?: number | null; temperature?: number | null; humidity?: number | null; notes?: string | null }) => {
    setEditingRecordId(record.id);
    editRecordForm.reset({
      birdCount: record.birdCount,
      mortalityCount: record.mortalityCount,
      mortalityCause: record.mortalityCause ?? '',
      feedConsumption: Number(record.feedConsumption),
      waterConsumption: record.waterConsumption ? Number(record.waterConsumption) : undefined,
      averageWeight: record.averageWeight ? Number(record.averageWeight) : undefined,
      temperature: record.temperature ? Number(record.temperature) : undefined,
      humidity: record.humidity ?? undefined,
      notes: record.notes ?? '',
    });
    setShowEditRecord(true);
  };

  const handleUpdateRecord = async (values: EditRecordFormValues) => {
    if (!editingRecordId) return;
    try {
      await updateRecordMutation.mutateAsync({
        recordId: editingRecordId,
        data: {
          birdCount: values.birdCount,
          mortalityCount: values.mortalityCount,
          mortalityCause: values.mortalityCause || undefined,
          feedConsumption: values.feedConsumption,
          waterConsumption: values.waterConsumption || undefined,
          averageWeight: values.averageWeight || undefined,
          temperature: values.temperature || undefined,
          humidity: values.humidity || undefined,
          notes: values.notes || undefined,
        },
      });
      toast.success('Daily record updated');
      setShowEditRecord(false);
      setEditingRecordId(null);
    } catch {
      toast.error('Failed to update daily record');
    }
  };

  const handleAddVax = async (values: VaccinationFormValues) => {
    try {
      await createVaxMutation.mutateAsync({
        batchId: Number(id),
        vaccineType: values.vaccineType,
        vaccinationDate: values.vaccinationDate,
        inventoryItemId: values.inventoryItemId ? Number(values.inventoryItemId) : undefined,
        quantityUsed: values.quantityUsed || undefined,
        notes: values.notes || undefined,
      });
      toast.success('Vaccination recorded');
      vaxForm.reset();
      setShowAddVax(false);
    } catch {
      toast.error('Failed to record vaccination');
    }
  };

  const handleOpenChickPlacement = () => {
    if (!batch) {
      return;
    }

    chickPlacementForm.reset({
      supplierId: chickPlacement?.supplierId ? String(chickPlacement.supplierId) : '',
      contractId: chickPlacement?.contractId ? String(chickPlacement.contractId) : '',
      placementDate: chickPlacement?.placementDate ? String(chickPlacement.placementDate).split('T')[0] : String(batch.placementDate).split('T')[0],
      invoiceReference: chickPlacement?.invoiceReference ?? '',
      deliveredQuantity: chickPlacement?.deliveredQuantity ?? batch.chicksPlaced,
      mortalityOnArrival: chickPlacement?.mortalityOnArrival ?? 0,
      unitCost: chickPlacement?.unitCost ?? 0,
      notes: chickPlacement?.notes ?? '',
    });
    setShowChickPlacement(true);
  };

  const handleSaveChickPlacement = async (values: ChickPlacementFormValues) => {
    try {
      await createChickPlacementMutation.mutateAsync({
        supplierId: values.supplierId ? Number(values.supplierId) : undefined,
        contractId: values.contractId ? Number(values.contractId) : undefined,
        placementDate: values.placementDate,
        invoiceReference: values.invoiceReference || undefined,
        deliveredQuantity: values.deliveredQuantity,
        mortalityOnArrival: values.mortalityOnArrival || 0,
        unitCost: values.unitCost,
        notes: values.notes || undefined,
      });
      toast.success('Chick placement saved');
      setShowChickPlacement(false);
    } catch {
      toast.error('Failed to save chick placement');
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
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{batch.batchCode}</h1>
            <p className="text-sm text-muted-foreground">{batch.siteName} / Cage {batch.cageNumber}</p>
          </div>
          <StatusBadge status={batch.status} />
        </div>
        <div className="flex gap-2">
          {batch.status !== 'closed' && hasPermission('batches:update') && (
            <Button variant="outline" onClick={handleOpenEditBatch}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          )}
          {isActive && hasPermission('batches:update') && (
            <Button variant="outline" onClick={() => setShowStatusChange(true)}>Change Status</Button>
          )}
          {isActive && hasPermission('daily_records:create') && (
            <Button variant="destructive" onClick={() => setShowMortality(true)}>
              <AlertTriangle className="h-4 w-4" />
              Record Mortality
            </Button>
          )}
          {isActive && hasPermission('daily_records:create') && (
            <Button asChild>
              <Link to={`/batches/${id}/today`}>
                <ClipboardCheck className="h-4 w-4" />
                Today's check
              </Link>
            </Button>
          )}
          {isActive && hasPermission('daily_records:create') && (
            <Button variant="outline" onClick={handleOpenDailyRecord}>
              <Plus className="h-4 w-4" />
              Daily Record
            </Button>
          )}
          {isActive && hasPermission('vaccinations:create') && (
            <Button variant="outline" onClick={() => setShowAddVax(true)}>
              <Syringe className="h-4 w-4" />
              Vaccination
            </Button>
          )}
          {batch.status !== 'closed' && hasPermission('batches:update') && (
            <Button variant="outline" onClick={handleOpenChickPlacement}>
              <Plus className="h-4 w-4" />
              Chick Placement
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

      <Card>
        <CardHeader>
          <CardTitle>Chick Placement</CardTitle>
        </CardHeader>
        <CardContent>
          {chickPlacement ? (
            <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <div>
                <p className="text-muted-foreground">Supplier</p>
                <p className="font-medium">{chickPlacement.supplierName || '--'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Invoice / Contract</p>
                <p className="font-medium">{chickPlacement.invoiceReference || chickPlacement.contractCode || '--'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Accepted Birds</p>
                <p className="font-medium">{Number(chickPlacement.acceptedQuantity).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Opening Cost</p>
                <p className="font-medium">Rs. {Number(chickPlacement.batchOpeningCost).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Mortality on Arrival</p>
                <p className="font-medium">{Number(chickPlacement.mortalityOnArrival).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Unit Cost</p>
                <p className="font-medium">Rs. {Number(chickPlacement.unitCost).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Placement Date</p>
                <p className="font-medium">{new Date(chickPlacement.placementDate).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Delivered Quantity</p>
                <p className="font-medium">{Number(chickPlacement.deliveredQuantity).toLocaleString()}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No chick placement sourcing or opening cost recorded yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-info" />
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
              <Calendar className="h-5 w-5 text-success" />
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
              <TrendingUp className="h-5 w-5 text-primary" />
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
              <Skull className="h-5 w-5 text-danger" />
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
              <Scale className="h-5 w-5 text-warning" />
              <div>
                <p className="text-2xl font-bold">{stats?.latestWeight ? `${stats.latestWeight}g` : '--'}</p>
                <p className="text-xs text-muted-foreground">Avg Weight</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">Rs. {(stats?.totalInventoryCost ?? 0).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Inventory Cost</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <BatchPerformancePanel batchId={id!} canManage={hasPermission('batches:update')} />

      <BatchCarePanel batchId={id!} siteId={batch.siteId} canManage={hasPermission('vaccinations:create')} isOpen={batch.status !== 'closed'} />

      <Card>
        <CardHeader>
          <CardTitle>Inventory Consumption ({batchData?.inventoryConsumptions?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {batchData?.inventoryConsumptions?.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Line Cost</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchData.inventoryConsumptions.map((consumption) => (
                    <TableRow key={consumption.id}>
                      <TableCell>{new Date(consumption.consumptionDate).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{consumption.ingredientName}</TableCell>
                      <TableCell>{consumption.typeName}</TableCell>
                      <TableCell className="text-right">{Number(consumption.quantity).toLocaleString()} {consumption.unit}</TableCell>
                      <TableCell className="text-right">Rs. {Number(consumption.unitCost).toFixed(2)}</TableCell>
                      <TableCell className="text-right">Rs. {Number(consumption.lineCost).toFixed(2)}</TableCell>
                      <TableCell className="text-muted-foreground">{consumption.notes ?? '--'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No direct inventory consumption recorded for this batch yet.</p>
          )}
        </CardContent>
      </Card>

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
                    <TableActionsHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.slice(0, 14).map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{new Date(record.recordDate).toLocaleDateString()}</TableCell>
                      <TableCell>{record.currentAge}d</TableCell>
                      <TableCell>{record.birdCount.toLocaleString()}</TableCell>
                      <TableCell className={record.mortalityCount > 0 ? 'text-danger font-medium' : ''}>
                        {record.mortalityCount}
                      </TableCell>
                      <TableCell>{record.feedConsumption}</TableCell>
                      <TableCell>{record.waterConsumption ?? '--'}</TableCell>
                      <TableCell>{record.averageWeight ?? '--'}</TableCell>
                      <TableCell>{record.temperature ? `${record.temperature}°C` : '--'}</TableCell>
                      <TableActionsCell>
                        <RowActions
                          label={`record for ${new Date(record.recordDate).toLocaleDateString()}`}
                          actions={[{ label: 'Edit', icon: Pencil, hidden: !(hasPermission('daily_records:update') || hasPermission('batches:update')), onSelect: () => handleOpenEditRecord(record) }]}
                        />
                      </TableActionsCell>
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
                  <TableHead>Stock Usage</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vaxRecords.map((vax) => (
                  <TableRow key={vax.id}>
                    <TableCell>{new Date(vax.vaccinationDate).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{vax.vaccineType}</TableCell>
                    <TableCell>
                      {vax.quantityUsed
                        ? `${Number(vax.quantityUsed).toLocaleString()} ${vax.unit ?? ''} • Rs. ${Number(vax.inventoryCost ?? 0).toFixed(2)}`
                        : '--'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{vax.notes ?? '--'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Record Mortality Dialog — simple, fast entry */}
      <Dialog open={showMortality} onOpenChange={setShowMortality}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-danger" />
              Record Mortality
            </DialogTitle>
            <DialogDescription>
              How many birds died today in {batch.batchCode}?
              {stats && (
                <span className="block mt-1 text-xs">
                  Current flock: <strong>{stats.currentBirdCount.toLocaleString()}</strong> birds
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <Form {...mortalityForm}>
            <form onSubmit={mortalityForm.handleSubmit(handleRecordMortality)} className="space-y-4">
              <FormField control={mortalityForm.control} name="count" render={({ field }) => (
                <FormItem>
                  <FormLabel>Number of deaths</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} autoFocus className="text-2xl h-14 text-center font-bold" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={mortalityForm.control} name="cause" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cause (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Heat stress, Disease, Unknown" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={mortalityForm.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Any additional details..." rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowMortality(false)}>Cancel</Button>
                <Button type="submit" variant="destructive" disabled={mortalityMutation.isPending}>
                  {mortalityMutation.isPending ? 'Recording...' : 'Record Deaths'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add Daily Record Dialog — redesigned with sections */}
      <Dialog open={showAddRecord} onOpenChange={setShowAddRecord}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Daily Record</DialogTitle>
            <DialogDescription>End-of-day production data for {batch.batchCode}.</DialogDescription>
          </DialogHeader>
          <Form {...recordForm}>
            <form onSubmit={recordForm.handleSubmit(handleAddRecord)} className="space-y-5">
              {/* Date & Auto-computed fields */}
              <div className="grid grid-cols-3 gap-4">
                <FormField control={recordForm.control} name="recordDate" render={({ field }) => (
                  <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={recordForm.control} name="currentAge" render={({ field }) => (
                  <FormItem><FormLabel>Age (days)</FormLabel><FormControl><Input type="number" {...field} className="bg-muted" readOnly /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={recordForm.control} name="birdCount" render={({ field }) => (
                  <FormItem><FormLabel>Bird Count</FormLabel><FormControl><Input type="number" {...field} className="bg-muted" readOnly /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              {/* Mortality section */}
              <div className="rounded-md border border-danger/30 bg-danger-soft p-3 space-y-3">
                <p className="text-sm font-medium text-danger">Mortality</p>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={recordForm.control} name="mortalityCount" render={({ field }) => (
                    <FormItem><FormLabel>Deaths today</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={recordForm.control} name="mortalityCause" render={({ field }) => (
                    <FormItem><FormLabel>Cause</FormLabel><FormControl><Input placeholder="Optional" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </div>

              {/* Feed & Water */}
              <div className="rounded-md border p-3 space-y-3">
                <p className="text-sm font-medium">Feed &amp; Water</p>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={recordForm.control} name="feedConsumption" render={({ field }) => (
                    <FormItem><FormLabel>Feed consumed (kg)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={recordForm.control} name="waterConsumption" render={({ field }) => (
                    <FormItem><FormLabel>Water consumed (L)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="Optional" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </div>

              {/* Environment & Weight */}
              <div className="rounded-md border p-3 space-y-3">
                <p className="text-sm font-medium">Environment &amp; Weight</p>
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={recordForm.control} name="averageWeight" render={({ field }) => (
                    <FormItem><FormLabel>Avg weight (g)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="Optional" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={recordForm.control} name="temperature" render={({ field }) => (
                    <FormItem><FormLabel>Temp (°C)</FormLabel><FormControl><Input type="number" step="0.1" placeholder="Optional" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={recordForm.control} name="humidity" render={({ field }) => (
                    <FormItem><FormLabel>Humidity (%)</FormLabel><FormControl><Input type="number" placeholder="Optional" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </div>

              <FormField control={recordForm.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea placeholder="Optional notes..." rows={2} {...field} /></FormControl><FormMessage /></FormItem>
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

      {/* Edit Daily Record Dialog */}
      <Dialog open={showEditRecord} onOpenChange={(open) => { setShowEditRecord(open); if (!open) setEditingRecordId(null); }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Daily Record</DialogTitle>
            <DialogDescription>Update this record for {batch.batchCode}.</DialogDescription>
          </DialogHeader>
          <Form {...editRecordForm}>
            <form onSubmit={editRecordForm.handleSubmit(handleUpdateRecord)} className="space-y-5">
              <div className="rounded-md border border-danger/30 bg-danger-soft p-3 space-y-3">
                <p className="text-sm font-medium text-danger">Mortality &amp; Birds</p>
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={editRecordForm.control} name="birdCount" render={({ field }) => (
                    <FormItem><FormLabel>Bird Count</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={editRecordForm.control} name="mortalityCount" render={({ field }) => (
                    <FormItem><FormLabel>Deaths</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={editRecordForm.control} name="mortalityCause" render={({ field }) => (
                    <FormItem><FormLabel>Cause</FormLabel><FormControl><Input placeholder="Optional" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </div>
              <div className="rounded-md border p-3 space-y-3">
                <p className="text-sm font-medium">Feed &amp; Water</p>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={editRecordForm.control} name="feedConsumption" render={({ field }) => (
                    <FormItem><FormLabel>Feed (kg)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={editRecordForm.control} name="waterConsumption" render={({ field }) => (
                    <FormItem><FormLabel>Water (L)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="Optional" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </div>
              <div className="rounded-md border p-3 space-y-3">
                <p className="text-sm font-medium">Environment &amp; Weight</p>
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={editRecordForm.control} name="averageWeight" render={({ field }) => (
                    <FormItem><FormLabel>Avg weight (g)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="Optional" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={editRecordForm.control} name="temperature" render={({ field }) => (
                    <FormItem><FormLabel>Temp (°C)</FormLabel><FormControl><Input type="number" step="0.1" placeholder="Optional" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={editRecordForm.control} name="humidity" render={({ field }) => (
                    <FormItem><FormLabel>Humidity (%)</FormLabel><FormControl><Input type="number" placeholder="Optional" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </div>
              <FormField control={editRecordForm.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea placeholder="Optional notes..." rows={2} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setShowEditRecord(false); setEditingRecordId(null); }}>Cancel</Button>
                <Button type="submit" disabled={updateRecordMutation.isPending}>
                  {updateRecordMutation.isPending ? 'Saving...' : 'Save Changes'}
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
              <FormField control={vaxForm.control} name="inventoryItemId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Inventory Stock (optional)</FormLabel>
                  <Select value={field.value || 'none'} onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select vaccine stock" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No stock consumption</SelectItem>
                      {(vaccineInventoryQuery.data?.data ?? []).map((item) => (
                        <SelectItem key={item.id} value={String(item.id)}>
                          {item.ingredientName} ({Number(item.quantity).toLocaleString()} {item.unit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={vaxForm.control} name="quantityUsed" render={({ field }) => (
                <FormItem><FormLabel>Quantity Used</FormLabel><FormControl><Input type="number" step="0.01" placeholder="Optional" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
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

      <Dialog open={showChickPlacement} onOpenChange={setShowChickPlacement}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Chick Placement</DialogTitle>
            <DialogDescription>Capture sourcing and opening cost for {batch.batchCode}.</DialogDescription>
          </DialogHeader>
          <Form {...chickPlacementForm}>
            <form onSubmit={chickPlacementForm.handleSubmit(handleSaveChickPlacement)} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField control={chickPlacementForm.control} name="supplierId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier</FormLabel>
                    <Select value={field.value || 'none'} onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No supplier</SelectItem>
                        {(suppliersQuery.data?.data ?? []).map((supplier) => (
                          <SelectItem key={supplier.id} value={String(supplier.id)}>
                            {supplier.supplierName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={chickPlacementForm.control} name="contractId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract</FormLabel>
                    <Select value={field.value || 'none'} onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select contract" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No contract</SelectItem>
                        {(contractsQuery.data?.data ?? []).map((contract) => (
                          <SelectItem key={contract.id} value={String(contract.id)}>
                            {contract.contractCode} - {contract.contractTitle}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={chickPlacementForm.control} name="placementDate" render={({ field }) => (
                  <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={chickPlacementForm.control} name="invoiceReference" render={({ field }) => (
                  <FormItem><FormLabel>Invoice Reference</FormLabel><FormControl><Input placeholder="Optional" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={chickPlacementForm.control} name="deliveredQuantity" render={({ field }) => (
                  <FormItem><FormLabel>Delivered Quantity</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={chickPlacementForm.control} name="mortalityOnArrival" render={({ field }) => (
                  <FormItem><FormLabel>Mortality on Arrival</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={chickPlacementForm.control} name="unitCost" render={({ field }) => (
                  <FormItem><FormLabel>Unit Cost</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={chickPlacementForm.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea placeholder="Optional notes..." {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowChickPlacement(false)}>Cancel</Button>
                <Button type="submit" disabled={createChickPlacementMutation.isPending}>
                  {createChickPlacementMutation.isPending ? 'Saving...' : 'Save'}
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
