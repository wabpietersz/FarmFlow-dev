import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useSiteDetail, useUpdateSite, useCreateCage, useUpdateCage } from '@/hooks/useSitesManagement';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, ArrowLeft, MapPin, Building2, Warehouse, Pencil } from 'lucide-react';
import { toast } from 'sonner';

const createCageFormSchema = z.object({
  cageNumber: z.string().min(1, 'Cage number is required').max(50),
  capacity: z.coerce.number().int().positive('Capacity must be positive'),
});

const editCageFormSchema = z.object({
  cageNumber: z.string().min(1, 'Cage number is required').max(50),
  capacity: z.coerce.number().int().positive('Capacity must be positive'),
  status: z.enum(['empty', 'occupied', 'maintenance']),
});

const editSiteFormSchema = z.object({
  siteName: z.string().min(1, 'Site name is required').max(100),
  location: z.string().min(1, 'Location is required').max(255),
  capacity: z.coerce.number().int().positive('Capacity must be positive'),
});

type CreateCageFormValues = z.infer<typeof createCageFormSchema>;
type EditCageFormValues = z.infer<typeof editCageFormSchema>;
type EditSiteFormValues = z.infer<typeof editSiteFormSchema>;

const cageStatusVariant = (status: string) => {
  switch (status) {
    case 'empty': return 'secondary' as const;
    case 'occupied': return 'default' as const;
    case 'maintenance': return 'destructive' as const;
    default: return 'outline' as const;
  }
};

export default function SiteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuthStore();
  const { data, isLoading } = useSiteDetail(id);
  const [showAddCage, setShowAddCage] = useState(false);
  const [showEditCage, setShowEditCage] = useState(false);
  const [showEditSite, setShowEditSite] = useState(false);
  const [editingCageId, setEditingCageId] = useState<number | null>(null);

  const siteId = Number(id);
  const createCageMutation = useCreateCage(siteId);
  const updateCageMutation = useUpdateCage(siteId);
  const updateSiteMutation = useUpdateSite(siteId);

  const site = data?.data?.site;
  const siteCages = data?.data?.cages ?? [];

  const cageForm = useForm<CreateCageFormValues>({
    resolver: zodResolver(createCageFormSchema),
    defaultValues: { cageNumber: '', capacity: 0 },
  });

  const editCageForm = useForm<EditCageFormValues>({
    resolver: zodResolver(editCageFormSchema),
    defaultValues: { cageNumber: '', capacity: 0, status: 'empty' },
  });

  const editSiteForm = useForm<EditSiteFormValues>({
    resolver: zodResolver(editSiteFormSchema),
    defaultValues: { siteName: '', location: '', capacity: 0 },
  });

  const handleCreateCage = async (values: CreateCageFormValues) => {
    try {
      await createCageMutation.mutateAsync({ ...values, siteId });
      toast.success('Cage added successfully');
      cageForm.reset();
      setShowAddCage(false);
    } catch {
      toast.error('Failed to add cage');
    }
  };

  const handleEditCage = (cage: { id: number; cageNumber: string; capacity: number; status: string }) => {
    setEditingCageId(cage.id);
    editCageForm.reset({
      cageNumber: cage.cageNumber,
      capacity: cage.capacity,
      status: cage.status as 'empty' | 'occupied' | 'maintenance',
    });
    setShowEditCage(true);
  };

  const handleUpdateCage = async (values: EditCageFormValues) => {
    if (!editingCageId) return;
    try {
      await updateCageMutation.mutateAsync({ cageId: editingCageId, data: values });
      toast.success('Cage updated');
      setShowEditCage(false);
      setEditingCageId(null);
    } catch {
      toast.error('Failed to update cage');
    }
  };

  const handleOpenEditSite = () => {
    if (!site) return;
    editSiteForm.reset({
      siteName: site.siteName,
      location: site.location,
      capacity: site.capacity,
    });
    setShowEditSite(true);
  };

  const handleUpdateSite = async (values: EditSiteFormValues) => {
    try {
      await updateSiteMutation.mutateAsync(values);
      toast.success('Site updated');
      setShowEditSite(false);
    } catch {
      toast.error('Failed to update site');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!site) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium">Site not found</h3>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/sites">Back to Sites</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link to="/sites"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{site.siteName}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <MapPin className="h-4 w-4" />
              {site.location}
            </div>
          </div>
        </div>
        {hasPermission('sites:update') && (
          <Button variant="outline" onClick={handleOpenEditSite}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit Site
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{site.capacity.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Capacity</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{siteCages.length}</p>
                <p className="text-xs text-muted-foreground">Total Cages</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{siteCages.filter((c) => c.status === 'occupied').length}</p>
                <p className="text-xs text-muted-foreground">Occupied Cages</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Cages</CardTitle>
          {hasPermission('sites:create') && (
            <Button size="sm" onClick={() => setShowAddCage(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Cage
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {siteCages.length === 0 ? (
            <div className="text-center py-8">
              <Warehouse className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No cages yet. Add your first cage.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cage Number</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Current Batch</TableHead>
                  {hasPermission('sites:update') && <TableHead className="w-[80px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {siteCages.map((cage) => (
                  <TableRow key={cage.id}>
                    <TableCell className="font-medium">{cage.cageNumber}</TableCell>
                    <TableCell>{cage.capacity.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={cageStatusVariant(cage.status)} className="capitalize">
                        {cage.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {cage.currentBatch ? (
                        <Link
                          to={`/batches/${cage.currentBatch.id}`}
                          className="text-primary hover:underline"
                        >
                          {cage.currentBatch.batchCode}
                          <span className="text-muted-foreground ml-2 text-xs">
                            ({cage.currentBatch.chicksPlaced.toLocaleString()} birds)
                          </span>
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    {hasPermission('sites:update') && (
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleEditCage(cage)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Cage Dialog */}
      <Dialog open={showAddCage} onOpenChange={setShowAddCage}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Cage</DialogTitle>
            <DialogDescription>Add a new cage to {site.siteName}.</DialogDescription>
          </DialogHeader>
          <Form {...cageForm}>
            <form onSubmit={cageForm.handleSubmit(handleCreateCage)} className="space-y-4">
              <FormField
                control={cageForm.control}
                name="cageNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cage Number</FormLabel>
                    <FormControl><Input placeholder="e.g. A1, B2, Cage-01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={cageForm.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacity (birds)</FormLabel>
                    <FormControl><Input type="number" placeholder="e.g. 5000" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAddCage(false)}>Cancel</Button>
                <Button type="submit" disabled={createCageMutation.isPending}>
                  {createCageMutation.isPending ? 'Adding...' : 'Add Cage'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Cage Dialog */}
      <Dialog open={showEditCage} onOpenChange={(open) => { setShowEditCage(open); if (!open) setEditingCageId(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit Cage</DialogTitle>
            <DialogDescription>Update cage details.</DialogDescription>
          </DialogHeader>
          <Form {...editCageForm}>
            <form onSubmit={editCageForm.handleSubmit(handleUpdateCage)} className="space-y-4">
              <FormField
                control={editCageForm.control}
                name="cageNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cage Number</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editCageForm.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacity (birds)</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editCageForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="empty">Empty</SelectItem>
                        <SelectItem value="occupied">Occupied</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowEditCage(false)}>Cancel</Button>
                <Button type="submit" disabled={updateCageMutation.isPending}>
                  {updateCageMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Site Dialog */}
      <Dialog open={showEditSite} onOpenChange={setShowEditSite}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit Site</DialogTitle>
            <DialogDescription>Update site information.</DialogDescription>
          </DialogHeader>
          <Form {...editSiteForm}>
            <form onSubmit={editSiteForm.handleSubmit(handleUpdateSite)} className="space-y-4">
              <FormField
                control={editSiteForm.control}
                name="siteName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Site Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editSiteForm.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editSiteForm.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Capacity (birds)</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowEditSite(false)}>Cancel</Button>
                <Button type="submit" disabled={updateSiteMutation.isPending}>
                  {updateSiteMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
