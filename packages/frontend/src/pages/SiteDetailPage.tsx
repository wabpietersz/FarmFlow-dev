import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSiteDetail, useCreateCage } from '@/hooks/useSitesManagement';
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
import { Plus, ArrowLeft, MapPin, Building2, Warehouse } from 'lucide-react';
import { toast } from 'sonner';

const createCageFormSchema = z.object({
  cageNumber: z.string().min(1, 'Cage number is required').max(50),
  capacity: z.coerce.number().int().positive('Capacity must be positive'),
});

type CreateCageFormValues = z.infer<typeof createCageFormSchema>;

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
  const { data, isLoading } = useSiteDetail(id);
  const [showAddCage, setShowAddCage] = useState(false);

  const siteId = Number(id);
  const createCageMutation = useCreateCage(siteId);

  const site = data?.data?.site;
  const siteCages = data?.data?.cages ?? [];

  const form = useForm<CreateCageFormValues>({
    resolver: zodResolver(createCageFormSchema),
    defaultValues: { cageNumber: '', capacity: 0 },
  });

  const handleCreateCage = async (values: CreateCageFormValues) => {
    try {
      await createCageMutation.mutateAsync({ ...values, siteId });
      toast.success('Cage added successfully');
      form.reset();
      setShowAddCage(false);
    } catch {
      toast.error('Failed to add cage');
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
          <Button size="sm" onClick={() => setShowAddCage(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Cage
          </Button>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddCage} onOpenChange={setShowAddCage}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Cage</DialogTitle>
            <DialogDescription>Add a new cage to {site.siteName}.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateCage)} className="space-y-4">
              <FormField
                control={form.control}
                name="cageNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cage Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. A1, B2, Cage-01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacity (birds)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g. 5000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAddCage(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createCageMutation.isPending}>
                  {createCageMutation.isPending ? 'Adding...' : 'Add Cage'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
