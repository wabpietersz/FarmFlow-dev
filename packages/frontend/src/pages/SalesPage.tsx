import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarClock, Eye, Leaf, Plus, ShoppingCart, Trash2, Users2, Wallet } from 'lucide-react';
import type { SaleBooking } from '@farmflow/shared';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { useSales, useBuyers, useCreateSale, useCreateBuyer, useUpdateBuyer, useDeleteBuyer } from '@/hooks/useSales';
import { useBatches } from '@/hooks/useBatches';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { buyerFormSchema, saleFormSchema, type BuyerFormValues, type SaleFormValues } from '@/lib/validations/sales';
import { formatCurrency } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/api';
import { BookingsTab } from '@/components/sales/BookingsTab';
import { ReceivablesTab } from '@/components/sales/ReceivablesTab';
import { OtherIncomeDialog } from '@/components/sales/OtherIncomeDialog';
import { CreditLimitDialog, readCreditBlock, type CreditBlock } from '@/components/sales/CreditLimitDialog';

const SALE_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-foreground',
  reviewed: 'bg-info-soft text-info',
  pending: 'bg-info-soft text-info',
  completed: 'bg-success-soft text-success',
  cancelled: 'bg-danger-soft text-danger',
};

const SETTLEMENT_STATUS_COLORS: Record<string, string> = {
  unpaid: 'bg-danger-soft text-danger',
  partially_paid: 'bg-warning-soft text-warning',
  paid: 'bg-success-soft text-success',
};

const BUYER_STATUS_COLORS: Record<string, string> = {
  active: 'bg-success-soft text-success',
  inactive: 'bg-muted text-foreground',
};

function displaySaleStatus(status: string) {
  return status === 'pending' ? 'reviewed' : status;
}

const defaultLorry = {
  lorryNumber: '',
  birdsCount: 0,
  previousWeight: 0,
  loadedWeight: 0,
  notes: '',
};

export default function SalesPage() {
  const { hasPermission } = useAuthStore();
  const [params, setParams] = useSearchParams();
  const activeTab = params.get('tab') ?? 'sales';
  const setActiveTab = (tab: string) => setParams({ tab }, { replace: true });
  const [fromBooking, setFromBooking] = useState<SaleBooking | null>(null);
  const [showOtherIncome, setShowOtherIncome] = useState(false);
  const [creditBlock, setCreditBlock] = useState<{ block: CreditBlock; values: SaleFormValues } | null>(null);
  const [salesPage, setSalesPage] = useState(1);
  const [salesStatusFilter, setSalesStatusFilter] = useState('');
  const [showCreateSale, setShowCreateSale] = useState(false);
  const [buyersPage, setBuyersPage] = useState(1);
  const [buyerSearch, setBuyerSearch] = useState('');
  const [showBuyerDialog, setShowBuyerDialog] = useState(false);
  const [editingBuyer, setEditingBuyer] = useState<{ id: number; buyerName: string; contactPerson?: string | null; phoneNumber?: string | null; email?: string | null; address?: string | null; creditTerms: number; creditLimit?: number | string | null } | null>(null);

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

  const saleForm = useForm<SaleFormValues>({
    resolver: zodResolver(saleFormSchema),
    defaultValues: {
      batchId: undefined,
      buyerId: undefined,
      saleDate: new Date().toISOString().split('T')[0],
      pricePerKg: 0,
      lorries: [defaultLorry],
      notes: '',
    },
  });

  const lorryFieldArray = useFieldArray({
    control: saleForm.control,
    name: 'lorries',
  });

  const watchedLorries = saleForm.watch('lorries');
  const watchedPriceKg = saleForm.watch('pricePerKg');

  const lorryTotals = useMemo(() => {
    const totalBirds = (watchedLorries ?? []).reduce((sum, lorry) => sum + (Number(lorry.birdsCount) || 0), 0);
    const totalWeight = (watchedLorries ?? []).reduce((sum, lorry) => {
      const netWeight = (Number(lorry.loadedWeight) || 0) - (Number(lorry.previousWeight) || 0);
      return sum + (netWeight > 0 ? netWeight : 0);
    }, 0);
    return {
      totalBirds,
      totalWeight,
      totalAmount: totalWeight * (watchedPriceKg ?? 0),
    };
  }, [watchedLorries, watchedPriceKg]);

  const buyerForm = useForm<BuyerFormValues>({
    resolver: zodResolver(buyerFormSchema),
    defaultValues: { buyerName: '', contactPerson: '', phoneNumber: '', email: '', address: '', creditTerms: 0, creditLimit: '' },
  });

  const resetSaleForm = () => saleForm.reset({
    batchId: undefined,
    buyerId: undefined,
    saleDate: new Date().toISOString().split('T')[0],
    pricePerKg: 0,
    lorries: [defaultLorry],
    notes: '',
  });

  /** Open the sale form filled in from a booking. */
  const makeSaleFromBooking = (booking: SaleBooking) => {
    setFromBooking(booking);
    saleForm.reset({
      batchId: booking.batchId,
      buyerId: booking.buyerId,
      saleDate: booking.catchDate,
      pricePerKg: booking.pricePerKg,
      lorries: [{ ...defaultLorry, birdsCount: booking.expectedBirds }],
      notes: booking.notes ?? '',
    });
    setShowCreateSale(true);
  };

  const handleCreateSale = async (values: SaleFormValues, creditOverrideReason?: string) => {
    try {
      await createSaleMutation.mutateAsync({
        saleType: 'live_birds',
        batchId: values.batchId,
        buyerId: values.buyerId,
        bookingId: fromBooking?.id,
        saleDate: values.saleDate,
        pricePerKg: values.pricePerKg,
        lorries: values.lorries.map((lorry) => ({
          lorryNumber: lorry.lorryNumber,
          birdsCount: lorry.birdsCount,
          previousWeight: lorry.previousWeight,
          loadedWeight: lorry.loadedWeight,
          notes: lorry.notes || undefined,
        })),
        notes: values.notes || undefined,
        creditOverrideReason,
      });
      toast.success(fromBooking ? `Sale created from ${fromBooking.bookingCode}` : 'Sale created in draft');
      resetSaleForm();
      setFromBooking(null);
      setShowCreateSale(false);
    } catch (error) {
      const block = readCreditBlock(error);
      if (block) { setCreditBlock({ block, values }); return; }
      toast.error(getApiErrorMessage(error, 'Failed to create sale'));
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
          creditLimit: values.creditLimit === '' || values.creditLimit == null ? null : Number(values.creditLimit),
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
          creditLimit: values.creditLimit === '' || values.creditLimit == null ? null : Number(values.creditLimit),
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
      creditLimit: buyer.creditLimit != null ? Number(buyer.creditLimit) : '',
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
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Sales</h1>
          <p className="mt-1 text-muted-foreground">Bookings, bird sales, other income and who owes you.</p>
        </div>
        {hasPermission('sales:create') && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setShowOtherIncome(true)} className="w-full sm:w-auto">
              <Leaf className="h-4 w-4 mr-2" />
              Other income
            </Button>
            <Button onClick={() => { setFromBooking(null); resetSaleForm(); setShowCreateSale(true); }} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              New Sale
            </Button>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="sm:hidden">
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select view" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sales">Sales</SelectItem>
              <SelectItem value="bookings">Bookings</SelectItem>
              <SelectItem value="receivables">Owed to you</SelectItem>
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
            <TabsTrigger value="bookings" className="gap-2">
              <CalendarClock className="h-4 w-4" />
              Bookings
            </TabsTrigger>
            <TabsTrigger value="receivables" className="gap-2">
              <Wallet className="h-4 w-4" />
              Owed to you
            </TabsTrigger>
            <TabsTrigger value="buyers" className="gap-2">
              <Users2 className="h-4 w-4" />
              Buyers
            </TabsTrigger>
          </TabsList>
        </div>

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
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="reviewed">Reviewed</SelectItem>
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
                  <Table className="min-w-[980px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sale Code</TableHead>
                        <TableHead>What</TableHead>
                        <TableHead>Buyer</TableHead>
                        <TableHead>Birds / qty</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Outstanding</TableHead>
                        <TableHead>Settlement</TableHead>
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
                          <TableCell className="text-muted-foreground">
                            {sale.saleType === 'other_income'
                              ? <span><span className="font-medium text-foreground">{sale.itemDescription}</span>{sale.batchCode ? ` · ${sale.batchCode}` : sale.siteName ? ` · ${sale.siteName}` : ''}</span>
                              : sale.batchCode ?? '--'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            <Link to={`/buyers/${sale.buyerId}`} className="hover:underline">
                              {sale.buyerName ?? '--'}
                            </Link>
                          </TableCell>
                          <TableCell>
                            {sale.saleType === 'other_income'
                              ? `${Number(sale.quantity ?? 0).toLocaleString()} ${sale.unit ?? ''}`
                              : sale.totalBirds.toLocaleString()}
                          </TableCell>
                          <TableCell className="font-medium">{formatCurrency(Number(sale.totalAmount))}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(sale.outstandingBalance ?? 0)}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize ${SETTLEMENT_STATUS_COLORS[sale.settlementStatus ?? 'unpaid'] ?? 'bg-muted text-foreground'}`}>
                              {(sale.settlementStatus ?? 'unpaid').replace('_', ' ')}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{new Date(sale.saleDate).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize ${SALE_STATUS_COLORS[displaySaleStatus(sale.status)] ?? ''}`}>
                              {displaySaleStatus(sale.status)}
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

        <TabsContent value="bookings">
          <BookingsTab canBook={hasPermission('sales:create')} onMakeSale={makeSaleFromBooking} />
        </TabsContent>

        <TabsContent value="receivables">
          <ReceivablesTab />
        </TabsContent>

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
                  <Table className="min-w-[1120px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden sm:table-cell">Contact</TableHead>
                        <TableHead className="hidden sm:table-cell">Phone</TableHead>
                        <TableHead className="hidden md:table-cell">Email</TableHead>
                        <TableHead>Outstanding</TableHead>
                        <TableHead>Advance</TableHead>
                        <TableHead>Net Balance</TableHead>
                        <TableHead>Terms / limit</TableHead>
                        <TableHead>Status</TableHead>
                        {hasPermission('sales:update') && <TableHead className="w-[100px]" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {buyersList.map((buyer) => (
                        <TableRow key={buyer.id}>
                          <TableCell className="font-medium">
                            <Link to={`/buyers/${buyer.id}`} className="hover:underline">
                              {buyer.buyerName}
                            </Link>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground">{buyer.contactPerson ?? '--'}</TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground">{buyer.phoneNumber ?? '--'}</TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">{buyer.email ?? '--'}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(buyer.outstandingBalance ?? 0)}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(buyer.advanceCredit ?? 0)}</TableCell>
                          <TableCell className={`font-medium ${(buyer.netBalance ?? 0) > 0 ? 'text-danger' : 'text-success'}`}>
                            {formatCurrency(Math.abs(buyer.netBalance ?? 0))} {(buyer.netBalance ?? 0) > 0 ? 'due' : 'credit'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {buyer.creditTerms ? `${buyer.creditTerms} days` : 'On delivery'}
                            {buyer.creditLimit != null ? <span className="block text-xs">limit {formatCurrency(Number(buyer.creditLimit))}</span> : null}
                          </TableCell>
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
                                  <Button variant="ghost" size="sm" className="text-danger" onClick={() => handleDeactivateBuyer(buyer.id)}>
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

      <Dialog open={showCreateSale} onOpenChange={(open) => { setShowCreateSale(open); if (!open) setFromBooking(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[1080px]">
          <DialogHeader>
            <DialogTitle>{fromBooking ? `Sale from ${fromBooking.bookingCode}` : 'Create New Sale'}</DialogTitle>
            <DialogDescription>
              {fromBooking
                ? `Booked ${fromBooking.expectedBirds.toLocaleString()} birds for ${fromBooking.buyerName}. Enter the actual lorries and weights.`
                : 'Record a batch sale and the lorries dispatched to the buyer.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...saleForm}>
            <form onSubmit={saleForm.handleSubmit((values) => handleCreateSale(values))} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
              </div>

              <FormField
                control={saleForm.control}
                name="pricePerKg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price per kg (Rs.)</FormLabel>
                    <FormControl><Input type="number" step="0.01" placeholder="e.g. 35.00" {...field} /></FormControl>
                    <p className="text-xs text-muted-foreground">
                      Formatted: {formatCurrency(Number(watchedPriceKg) || 0)}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">Lorries</h3>
                    <p className="text-sm text-muted-foreground">Each lorry compiles into the sale totals automatically.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => lorryFieldArray.append(defaultLorry)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Lorry
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <Table className="min-w-[980px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px]">#</TableHead>
                        <TableHead>Lorry</TableHead>
                        <TableHead>Birds</TableHead>
                        <TableHead>Previous Weight</TableHead>
                        <TableHead>After Weight</TableHead>
                        <TableHead>Net Weight</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="w-[70px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lorryFieldArray.fields.map((field, index) => {
                        const row = watchedLorries?.[index];
                        const netWeight = Math.max((Number(row?.loadedWeight) || 0) - (Number(row?.previousWeight) || 0), 0);
                        return (
                          <TableRow key={field.id} className="align-top">
                            <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                            <TableCell className="min-w-[160px]">
                              <FormField
                                control={saleForm.control}
                                name={`lorries.${index}.lorryNumber`}
                                render={({ field }) => (
                                  <FormItem className="space-y-1">
                                    <FormLabel className="sr-only">Lorry</FormLabel>
                                    <FormControl><Input placeholder="e.g. CAB-1023" {...field} /></FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </TableCell>
                            <TableCell className="min-w-[120px]">
                              <FormField
                                control={saleForm.control}
                                name={`lorries.${index}.birdsCount`}
                                render={({ field }) => (
                                  <FormItem className="space-y-1">
                                    <FormLabel className="sr-only">Birds</FormLabel>
                                    <FormControl><Input type="number" {...field} /></FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </TableCell>
                            <TableCell className="min-w-[150px]">
                              <FormField
                                control={saleForm.control}
                                name={`lorries.${index}.previousWeight`}
                                render={({ field }) => (
                                  <FormItem className="space-y-1">
                                    <FormLabel className="sr-only">Previous Weight</FormLabel>
                                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </TableCell>
                            <TableCell className="min-w-[150px]">
                              <FormField
                                control={saleForm.control}
                                name={`lorries.${index}.loadedWeight`}
                                render={({ field }) => (
                                  <FormItem className="space-y-1">
                                    <FormLabel className="sr-only">After Weight</FormLabel>
                                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </TableCell>
                            <TableCell className="min-w-[130px]">
                              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium text-foreground">
                                {netWeight.toFixed(2)} kg
                              </div>
                            </TableCell>
                            <TableCell className="min-w-[220px]">
                              <FormField
                                control={saleForm.control}
                                name={`lorries.${index}.notes`}
                                render={({ field }) => (
                                  <FormItem className="space-y-1">
                                    <FormLabel className="sr-only">Notes</FormLabel>
                                    <FormControl><Input placeholder="Optional notes" {...field} /></FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={lorryFieldArray.fields.length === 1}
                                onClick={() => lorryFieldArray.remove(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="grid gap-3 rounded-lg border bg-muted/40 px-4 py-3 md:grid-cols-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Birds</p>
                  <p className="text-lg font-semibold text-foreground">{lorryTotals.totalBirds.toLocaleString()}</p>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Weight</p>
                  <p className="text-lg font-semibold text-foreground">{lorryTotals.totalWeight.toFixed(2)} kg</p>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Sale Amount</p>
                  <p className="text-lg font-semibold text-foreground">{formatCurrency(lorryTotals.totalAmount)}</p>
                </div>
              </div>

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
                <FormField
                  control={buyerForm.control}
                  name="creditLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Credit limit (Rs)</FormLabel>
                      <FormControl><Input type="number" inputMode="decimal" min="0" placeholder="No limit" {...field} value={field.value ?? ''} /></FormControl>
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
                    <FormControl><Textarea placeholder="Buyer address" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowBuyerDialog(false)}>Cancel</Button>
                <Button type="submit" disabled={createBuyerMutation.isPending || updateBuyerMutation.isPending}>
                  {editingBuyer ? 'Save Changes' : 'Create Buyer'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      {showOtherIncome ? <OtherIncomeDialog onClose={() => setShowOtherIncome(false)} /> : null}
      <CreditLimitDialog
        block={creditBlock?.block ?? null}
        pending={createSaleMutation.isPending}
        onClose={() => setCreditBlock(null)}
        onConfirm={(reason) => { const values = creditBlock!.values; setCreditBlock(null); void handleCreateSale(values, reason); }}
      />
    </div>
  );
}
