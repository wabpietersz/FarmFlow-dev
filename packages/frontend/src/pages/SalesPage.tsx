import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useSales, useBuyers, useCreateSale, useCreateBuyer, useUpdateBuyer, useDeleteBuyer } from '@/hooks/useSales';
import { useBatches } from '@/hooks/useBatches';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { saleFormSchema, buyerFormSchema, type SaleFormValues, type BuyerFormValues } from '@/lib/validations/sales';
import { Plus, Eye, ShoppingCart, Users2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';

const SALE_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const BUYER_STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
};

export default function SalesPage() {
  const { hasPermission } = useAuthStore();
  const [activeTab, setActiveTab] = useState('sales');

  // Sales state
  const [salesPage, setSalesPage] = useState(1);
  const [salesStatusFilter, setSalesStatusFilter] = useState('');
  const [showCreateSale, setShowCreateSale] = useState(false);

  // Buyers state
  const [buyersPage, setBuyersPage] = useState(1);
  const [buyerSearch, setBuyerSearch] = useState('');
  const [showBuyerDialog, setShowBuyerDialog] = useState(false);
  const [editingBuyer, setEditingBuyer] = useState<{ id: number; buyerName: string; contactPerson?: string | null; phoneNumber?: string | null; email?: string | null; address?: string | null; creditTerms: number } | null>(null);

  // Data hooks
  const { data: salesData, isLoading: salesLoading } = useSales({
    page: salesPage,
    limit: 20,
    status: salesStatusFilter || undefined,
  });
  const { data: buyersData, isLoading: buyersLoading } = useBuyers({
    page: buyersPage,
    limit: 20,
    search: buyerSearch || undefined,
  });
  const { data: batchesData } = useBatches({ limit: 100 });
  const { data: activeBuyersData } = useBuyers({ status: 'active', limit: 100 });

  const createSaleMutation = useCreateSale();
  const createBuyerMutation = useCreateBuyer();
  const updateBuyerMutation = useUpdateBuyer(editingBuyer ? String(editingBuyer.id) : '0');
  const deleteBuyerMutation = useDeleteBuyer();

  const salesList = salesData?.data ?? [];
  const salesTotalPages = salesData?.totalPages ?? 0;
  const salesTotal = salesData?.total ?? 0;
  const buyersList = buyersData?.data ?? [];
  const buyersTotalPages = buyersData?.totalPages ?? 0;
  const buyersTotal = buyersData?.total ?? 0;
  const availableBatches = (batchesData?.data ?? []).filter((b) => b.status === 'growing' || b.status === 'ready_for_sale');
  const activeBuyers = activeBuyersData?.data ?? [];

  // Sale form
  const saleForm = useForm<SaleFormValues>({
    resolver: zodResolver(saleFormSchema),
    defaultValues: {
      batchId: undefined,
      buyerId: undefined,
      saleDate: new Date().toISOString().split('T')[0],
      totalBirds: 0,
      totalWeight: 0,
      pricePerKg: 0,
      notes: '',
    },
  });

  const watchedWeight = saleForm.watch('totalWeight');
  const watchedPriceKg = saleForm.watch('pricePerKg');
  const calculatedTotal = (watchedWeight ?? 0) * (watchedPriceKg ?? 0);

  // Buyer form
  const buyerForm = useForm<BuyerFormValues>({
    resolver: zodResolver(buyerFormSchema),
    defaultValues: { buyerName: '', contactPerson: '', phoneNumber: '', email: '', address: '', creditTerms: 0 },
  });

  const handleCreateSale = async (values: SaleFormValues) => {
    try {
      await createSaleMutation.mutateAsync({
        ...values,
        notes: values.notes || undefined,
      });
      toast.success('Sale created successfully');
      saleForm.reset();
      setShowCreateSale(false);
    } catch {
      toast.error('Failed to create sale');
    }
  };

  const handleSaveBuyer = async (values: BuyerFormValues) => {
    try {
      if (editingBuyer) {
        await updateBuyerMutation.mutateAsync({
          buyerName: values.buyerName,
          contactPerson: values.contactPerson || null,
          phoneNumber: values.phoneNumber || null,
          email: values.email || null,
          address: values.address || null,
          creditTerms: values.creditTerms,
        });
        toast.success('Buyer updated');
      } else {
        await createBuyerMutation.mutateAsync({
          buyerName: values.buyerName,
          contactPerson: values.contactPerson || null,
          phoneNumber: values.phoneNumber || null,
          email: values.email || null,
          address: values.address || null,
          creditTerms: values.creditTerms,
        });
        toast.success('Buyer created');
      }
      buyerForm.reset();
      setShowBuyerDialog(false);
      setEditingBuyer(null);
    } catch {
      toast.error(editingBuyer ? 'Failed to update buyer' : 'Failed to create buyer');
    }
  };

  const handleEditBuyer = (buyer: typeof editingBuyer) => {
    if (!buyer) return;
    setEditingBuyer(buyer);
    buyerForm.reset({
      buyerName: buyer.buyerName,
      contactPerson: buyer.contactPerson ?? '',
      phoneNumber: buyer.phoneNumber ?? '',
      email: buyer.email ?? '',
      address: buyer.address ?? '',
      creditTerms: buyer.creditTerms,
    });
    setShowBuyerDialog(true);
  };

  const handleDeactivateBuyer = async (buyerId: number) => {
    try {
      await deleteBuyerMutation.mutateAsync(buyerId);
      toast.success('Buyer deactivated');
    } catch {
      toast.error('Failed to deactivate buyer. They may have pending sales.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">Sales & Buyers</h1>
        <div className="flex w-full gap-2 sm:w-auto">
          {hasPermission('sales:create') && (
            <Button onClick={() => setShowCreateSale(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              New Sale
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="sm:hidden">
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select view" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sales">Sales</SelectItem>
              <SelectItem value="buyers">Buyers</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="hidden sm:block">
          <TabsList>
            <TabsTrigger value="sales" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Sales
            </TabsTrigger>
            <TabsTrigger value="buyers" className="gap-2">
              <Users2 className="h-4 w-4" />
              Buyers
            </TabsTrigger>
          </TabsList>
        </div>

        {/* SALES TAB */}
        <TabsContent value="sales">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <Select value={salesStatusFilter || 'all'} onValueChange={(v) => { setSalesStatusFilter(v === 'all' ? '' : v); setSalesPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {salesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : salesList.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-1">No sales found</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {salesStatusFilter ? 'Try adjusting the filter.' : 'Create your first sale to start tracking.'}
                  </p>
                  {hasPermission('sales:create') && !salesStatusFilter && (
                    <Button onClick={() => setShowCreateSale(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      New Sale
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <Table className="min-w-[760px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sale Code</TableHead>
                        <TableHead>Batch</TableHead>
                        <TableHead className="hidden sm:table-cell">Buyer</TableHead>
                        <TableHead>Birds</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[50px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesList.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell>
                            <Link to={`/sales/${sale.id}`} className="font-medium text-foreground hover:underline">
                              {sale.saleCode}
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{sale.batchCode ?? '--'}</TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground">{sale.buyerName ?? '--'}</TableCell>
                          <TableCell>{sale.totalBirds.toLocaleString()}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(Number(sale.totalAmount))}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(sale.saleDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize ${SALE_STATUS_COLORS[sale.status] ?? ''}`}>
                              {sale.status}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button asChild variant="ghost" size="icon">
                              <Link to={`/sales/${sale.id}`}><Eye className="h-4 w-4" /></Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Showing {(salesPage - 1) * 20 + 1} to {Math.min(salesPage * 20, salesTotal)} of {salesTotal}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={salesPage <= 1} onClick={() => setSalesPage((p) => p - 1)}>Previous</Button>
                      <Button variant="outline" size="sm" disabled={salesPage >= salesTotalPages} onClick={() => setSalesPage((p) => p + 1)}>Next</Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* BUYERS TAB */}
        <TabsContent value="buyers">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <Input
                  placeholder="Search buyers..."
                  value={buyerSearch}
                  onChange={(e) => { setBuyerSearch(e.target.value); setBuyersPage(1); }}
                  className="w-full sm:w-[250px]"
                />
                {hasPermission('sales:create') && (
                  <Button onClick={() => { setEditingBuyer(null); buyerForm.reset(); setShowBuyerDialog(true); }} className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    New Buyer
                  </Button>
                )}
              </div>

              {buyersLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : buyersList.length === 0 ? (
                <div className="text-center py-12">
                  <Users2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-1">No buyers found</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {buyerSearch ? 'Try adjusting the search.' : 'Add your first buyer.'}
                  </p>
                </div>
              ) : (
                <>
                  <Table className="min-w-[860px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden sm:table-cell">Contact</TableHead>
                        <TableHead className="hidden sm:table-cell">Phone</TableHead>
                        <TableHead className="hidden md:table-cell">Email</TableHead>
                        <TableHead>Credit (days)</TableHead>
                        <TableHead>Status</TableHead>
                        {hasPermission('sales:update') && <TableHead className="w-[100px]" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {buyersList.map((buyer) => (
                        <TableRow key={buyer.id}>
                          <TableCell className="font-medium">{buyer.buyerName}</TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground">{buyer.contactPerson ?? '--'}</TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground">{buyer.phoneNumber ?? '--'}</TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">{buyer.email ?? '--'}</TableCell>
                          <TableCell>{buyer.creditTerms}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize ${BUYER_STATUS_COLORS[buyer.status ?? 'active'] ?? ''}`}>
                              {buyer.status ?? 'active'}
                            </span>
                          </TableCell>
                          {hasPermission('sales:update') && (
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => handleEditBuyer(buyer)}>Edit</Button>
                                {buyer.status === 'active' && (
                                  <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDeactivateBuyer(buyer.id)}>
                                    Deactivate
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Showing {(buyersPage - 1) * 20 + 1} to {Math.min(buyersPage * 20, buyersTotal)} of {buyersTotal}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={buyersPage <= 1} onClick={() => setBuyersPage((p) => p - 1)}>Previous</Button>
                      <Button variant="outline" size="sm" disabled={buyersPage >= buyersTotalPages} onClick={() => setBuyersPage((p) => p + 1)}>Next</Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Sale Dialog */}
      <Dialog open={showCreateSale} onOpenChange={setShowCreateSale}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Sale</DialogTitle>
            <DialogDescription>Record a sale from a batch to a buyer.</DialogDescription>
          </DialogHeader>
          <Form {...saleForm}>
            <form onSubmit={saleForm.handleSubmit(handleCreateSale)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={saleForm.control}
                  name="batchId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Batch</FormLabel>
                      <Select value={field.value ? String(field.value) : ''} onValueChange={(v) => field.onChange(Number(v))}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableBatches.length === 0 ? (
                            <SelectItem value="none" disabled>No batches ready</SelectItem>
                          ) : (
                            availableBatches.map((batch) => (
                              <SelectItem key={batch.id} value={String(batch.id)}>
                                {batch.batchCode}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={saleForm.control}
                  name="buyerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Buyer</FormLabel>
                      <Select value={field.value ? String(field.value) : ''} onValueChange={(v) => field.onChange(Number(v))}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select buyer" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {activeBuyers.length === 0 ? (
                            <SelectItem value="none" disabled>No active buyers</SelectItem>
                          ) : (
                            activeBuyers.map((buyer) => (
                              <SelectItem key={buyer.id} value={String(buyer.id)}>
                                {buyer.buyerName}
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
                control={saleForm.control}
                name="saleDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sale Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={saleForm.control}
                  name="totalBirds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of Birds</FormLabel>
                      <FormControl><Input type="number" placeholder="e.g. 500" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={saleForm.control}
                  name="totalWeight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Weight (kg)</FormLabel>
                      <FormControl><Input type="number" step="0.01" placeholder="e.g. 750.00" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={saleForm.control}
                  name="pricePerKg"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price per kg (Rs.)</FormLabel>
                      <FormControl><Input type="number" step="0.01" placeholder="e.g. 35.00" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {calculatedTotal > 0 && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <span className="text-muted-foreground">Total Amount: </span>
                  <span className="font-bold text-foreground">{formatCurrency(calculatedTotal)}</span>
                </div>
              )}
              <FormField
                control={saleForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl><Textarea placeholder="Any additional notes..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreateSale(false)}>Cancel</Button>
                <Button type="submit" disabled={createSaleMutation.isPending}>
                  {createSaleMutation.isPending ? 'Creating...' : 'Create Sale'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Buyer Create/Edit Dialog */}
      <Dialog open={showBuyerDialog} onOpenChange={(open) => { setShowBuyerDialog(open); if (!open) setEditingBuyer(null); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingBuyer ? 'Edit Buyer' : 'New Buyer'}</DialogTitle>
            <DialogDescription>{editingBuyer ? 'Update buyer details.' : 'Add a new buyer to the system.'}</DialogDescription>
          </DialogHeader>
          <Form {...buyerForm}>
            <form onSubmit={buyerForm.handleSubmit(handleSaveBuyer)} className="space-y-4">
              <FormField
                control={buyerForm.control}
                name="buyerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Buyer Name</FormLabel>
                    <FormControl><Input placeholder="e.g. Fresh Mart" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={buyerForm.control}
                  name="contactPerson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Person</FormLabel>
                      <FormControl><Input placeholder="e.g. John Smith" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={buyerForm.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl><Input placeholder="e.g. +27 12 345 6789" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={buyerForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input type="email" placeholder="buyer@example.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={buyerForm.control}
                  name="creditTerms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Credit Terms (days)</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={buyerForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl><Textarea placeholder="Full address..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setShowBuyerDialog(false); setEditingBuyer(null); }}>Cancel</Button>
                <Button type="submit" disabled={createBuyerMutation.isPending || updateBuyerMutation.isPending}>
                  {(createBuyerMutation.isPending || updateBuyerMutation.isPending) ? 'Saving...' : editingBuyer ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
