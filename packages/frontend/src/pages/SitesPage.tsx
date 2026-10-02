import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useSitesManagement, useCreateSite } from '@/hooks/useSitesManagement';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { ArrowRight, Plus, Building2, MapPin, Warehouse, Egg } from 'lucide-react';
import { toast } from 'sonner';

const createSiteFormSchema = z.object({
  siteName: z.string().min(1, 'Site name is required').max(100),
  location: z.string().min(1, 'Location is required').max(255),
  capacity: z.coerce.number().int().positive('Capacity must be positive'),
});

type CreateSiteFormValues = z.infer<typeof createSiteFormSchema>;

export default function SitesPage() {
  const { hasPermission } = useAuthStore();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data, isLoading } = useSitesManagement();
  const createMutation = useCreateSite();

  const allSites = data?.data ?? [];

  const form = useForm<CreateSiteFormValues>({
    resolver: zodResolver(createSiteFormSchema),
    defaultValues: { siteName: '', location: '', capacity: 0 },
  });

  const handleCreate = async (values: CreateSiteFormValues) => {
    try {
      await createMutation.mutateAsync(values);
      toast.success('Site created successfully');
      form.reset();
      setShowCreateDialog(false);
    } catch {
      toast.error('Failed to create site');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Sites &amp; houses</h1>
        {hasPermission('sites:read') && (
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus />
            Add site
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : allSites.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">No sites yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Add your first farm site to get started.</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus />
              Add site
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {allSites.map((site) => (
            <Link
              key={site.id}
              to={`/sites/${site.id}`}
              aria-label={`Open ${site.siteName}`}
              className="group rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full gap-4 transition-colors group-hover:border-primary/40 group-hover:bg-muted/40">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle>{site.siteName}</CardTitle>
                    <StatusBadge status={site.status} />
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" />
                    {site.location}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4 shrink-0" />
                    Capacity: {site.capacity.toLocaleString()} birds
                  </div>
                  <div className="mt-auto flex items-center gap-4 border-t pt-3">
                    <div className="flex items-center gap-1.5 text-sm">
                      <Warehouse className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{site.totalCages}</span>
                      <span className="text-muted-foreground">cages</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm">
                      <Egg className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{site.activeBatches}</span>
                      <span className="text-muted-foreground">active batches</span>
                    </div>
                    <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Site</DialogTitle>
            <DialogDescription>Create a new farm site to manage cages and batches.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4">
              <FormField
                control={form.control}
                name="siteName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Site Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Main Farm, North Wing" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Johannesburg, South Africa" {...field} />
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
                      <Input type="number" placeholder="e.g. 50000" {...field} />
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
                  {createMutation.isPending ? 'Creating...' : 'Create Site'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
