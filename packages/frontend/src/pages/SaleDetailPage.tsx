import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Banknote, CheckCircle2, CreditCard, DollarSign, Landmark, Plus, Receipt, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { SaleStatus } from '@farmflow/shared';
import { useAuthStore } from '@/store/authStore';
import { useCreatePayment, useSale, useUpdatePayment, useUpdateSale } from '@/hooks/useSales';
import { useTreasuryAccounts } from '@/hooks/useTreasury';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { draftSaleDetailSchema, receiptFormSchema, type DraftSaleDetailValues, type ReceiptFormValues } from '@/lib/validations/sales';
import { formatCurrency } from '@/lib/utils';
import { generateInvoicePDF } from '@/lib/generateInvoice';

const SALE_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-foreground',
  reviewed: 'bg-info-soft text-info',
  pending: 'bg-info-soft text-info',
  completed: 'bg-success-soft text-success',
  cancelled: 'bg-danger-soft text-danger',
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-warning-soft text-warning',
  completed: 'bg-success-soft text-success',
  bounced: 'bg-danger-soft text-danger',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  cheque: 'Cheque',
  bank_transfer: 'Bank Transfer',
};

function displaySaleStatus(status: SaleStatus | string) {
  return status === SaleStatus.Pending ? SaleStatus.Reviewed : status;
}

const defaultReceiptLine = {
  paymentAmount: 0,
  paymentMethod: 'cash' as const,
  financeAccountId: 0,
  referenceNumber: '',
  chequeNumber: '',
  chequeDate: '',
  bankName: '',
  notes: '',
};

const defaultLorryLine = {
  lorryNumber: '',
  birdsCount: 0,
  previousWeight: 0,
  loadedWeight: 0,
  notes: '',
};

export default function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuthStore();
  const { data, isLoading } = useSale(id);
  const createPaymentMutation = useCreatePayment(id!);
  const updatePaymentMutation = useUpdatePayment();
  const updateSaleMutation = useUpdateSale(id!);
  const { data: treasuryAccountsResponse, isLoading: treasuryAccountsLoading } = useTreasuryAccounts();
  const [showAddPayment, setShowAddPayment] = useState(false);

  const saleData = data?.data;
  const sale = saleData?.sale;
  const buyer = saleData?.buyer;
  const lorryLines = saleData?.lorryLines ?? [];
  const payments = saleData?.payments ?? [];
  const treasuryAccounts = treasuryAccountsResponse?.data?.filter((account) => account.status === 'active') ?? [];
  const treasuryAccountLookup = useMemo(
    () => new Map(treasuryAccounts.map((account) => [account.id, account])),
    [treasuryAccounts],
  );
  const totalPaid = saleData?.totalPaid ?? 0;
  const outstandingBalance = saleData?.outstandingBalance ?? 0;
  const availableBuyerCredit = saleData?.availableBuyerCredit ?? 0;
  const workflowStatus = sale ? displaySaleStatus(sale.status) : undefined;

  const isDraft = workflowStatus === SaleStatus.Draft;
  const isOtherIncome = sale?.saleType === 'other_income';
  const canRecordReceipt = sale ? [SaleStatus.Reviewed, SaleStatus.Pending, SaleStatus.Completed].includes(sale.status) : false;
  const canMarkCompleted = workflowStatus === SaleStatus.Reviewed && outstandingBalance <= 0.01;

  const draftForm = useForm<DraftSaleDetailValues>({
    resolver: zodResolver(draftSaleDetailSchema),
    defaultValues: {
      pricePerKg: 0,
      lorries: [defaultLorryLine],
      notes: '',
    },
  });

  const draftLorryFieldArray = useFieldArray({
    control: draftForm.control,
    name: 'lorries',
  });

  useEffect(() => {
    if (!sale) return;
    draftForm.reset({
      pricePerKg: Number(sale.pricePerKg),
      lorries: lorryLines.length
        ? lorryLines.map((line) => ({
            lorryNumber: line.lorryNumber,
            birdsCount: Number(line.birdsCount),
            previousWeight: Number(line.previousWeight),
            loadedWeight: Number(line.loadedWeight),
            notes: line.notes ?? '',
          }))
        : [defaultLorryLine],
      notes: sale.notes ?? '',
    });
  }, [draftForm, lorryLines, sale]);

  const watchedDraftLorries = draftForm.watch('lorries');
  const watchedDraftPrice = draftForm.watch('pricePerKg');
  const draftTotals = useMemo(() => {
    const totalBirds = (watchedDraftLorries ?? []).reduce((sum, lorry) => sum + (Number(lorry.birdsCount) || 0), 0);
    const totalWeight = (watchedDraftLorries ?? []).reduce((sum, lorry) => {
      const netWeight = (Number(lorry.loadedWeight) || 0) - (Number(lorry.previousWeight) || 0);
      return sum + (netWeight > 0 ? netWeight : 0);
    }, 0);
    return {
      totalBirds,
      totalWeight,
      totalAmount: totalWeight * (watchedDraftPrice ?? 0),
    };
  }, [watchedDraftLorries, watchedDraftPrice]);

  const receiptForm = useForm<ReceiptFormValues>({
    resolver: zodResolver(receiptFormSchema),
    defaultValues: {
      receiptDate: new Date().toISOString().split('T')[0],
      receiptNotes: '',
      lines: [{ ...defaultReceiptLine, financeAccountId: treasuryAccounts[0]?.id ?? 0 }],
    },
  });

  const receiptFieldArray = useFieldArray({
    control: receiptForm.control,
    name: 'lines',
  });

  const watchedReceiptLines = receiptForm.watch('lines');
  const receiptTotal = useMemo(
    () => (watchedReceiptLines ?? []).reduce((sum, line) => sum + (Number(line.paymentAmount) || 0), 0),
    [watchedReceiptLines],
  );

  useEffect(() => {
    if (!treasuryAccounts.length) return;
    const lines = receiptForm.getValues('lines');
    const needsDefaultAccount = lines.some((line) => !line.financeAccountId || line.financeAccountId <= 0);
    if (!needsDefaultAccount) return;
    receiptForm.setValue(
      'lines',
      lines.map((line) => ({
        ...line,
        financeAccountId: line.financeAccountId && line.financeAccountId > 0 ? line.financeAccountId : treasuryAccounts[0]!.id,
      })),
      { shouldValidate: false },
    );
  }, [receiptForm, treasuryAccounts]);

  const persistDraft = async (values: DraftSaleDetailValues, nextStatus?: 'reviewed') => {
    await updateSaleMutation.mutateAsync({
      pricePerKg: values.pricePerKg,
      notes: values.notes || null,
      lorries: values.lorries.map((lorry) => ({
        lorryNumber: lorry.lorryNumber,
        birdsCount: lorry.birdsCount,
        previousWeight: lorry.previousWeight,
        loadedWeight: lorry.loadedWeight,
        notes: lorry.notes || undefined,
      })),
      status: nextStatus,
    });
  };

  const handleSaveDraft = async (values: DraftSaleDetailValues) => {
    try {
      await persistDraft(values);
      toast.success('Draft sale updated');
    } catch {
      toast.error('Failed to update draft sale');
    }
  };

  const handleMarkReviewed = async (values: DraftSaleDetailValues) => {
    try {
      await persistDraft(values, 'reviewed');
      toast.success('Sale reviewed. Receipts are now enabled.');
    } catch {
      toast.error('Failed to review sale');
    }
  };

  /** Other income has no lorries to confirm: reviewing just opens it for receipts. */
  const handleReviewOtherIncome = async () => {
    try {
      await updateSaleMutation.mutateAsync({ status: 'reviewed' });
      toast.success('Sale reviewed. Receipts are now enabled.');
    } catch {
      toast.error('Failed to review sale');
    }
  };

  const handleMarkCompleted = async () => {
    try {
      await updateSaleMutation.mutateAsync({ status: 'completed' });
      toast.success('Sale marked as completed');
    } catch {
      toast.error('Failed to complete sale');
    }
  };

  const handleAddPayment = async (values: ReceiptFormValues) => {
    try {
      await createPaymentMutation.mutateAsync({
        receiptDate: values.receiptDate,
        receiptNotes: values.receiptNotes || undefined,
        lines: values.lines.map((line) => ({
          paymentAmount: line.paymentAmount,
          paymentMethod: line.paymentMethod,
          financeAccountId: line.financeAccountId,
          referenceNumber: line.referenceNumber || undefined,
          chequeNumber: line.chequeNumber || undefined,
          chequeDate: line.chequeDate || undefined,
          bankName: line.bankName || undefined,
          notes: line.notes || undefined,
        })),
      });
      toast.success('Receipt recorded');
      receiptForm.reset({
        receiptDate: new Date().toISOString().split('T')[0],
        receiptNotes: '',
        lines: [{ ...defaultReceiptLine, financeAccountId: treasuryAccounts[0]?.id ?? 0 }],
      });
      setShowAddPayment(false);
    } catch {
      toast.error('Failed to record receipt');
    }
  };

  const handleUpdatePaymentStatus = async (paymentId: string, newStatus: string) => {
    try {
      await updatePaymentMutation.mutateAsync({
        paymentId,
        data: { paymentStatus: newStatus },
      });
      toast.success(`Payment marked as ${newStatus}`);
    } catch {
      toast.error('Failed to update payment status');
    }
  };

  const handleCancelSale = async () => {
    try {
      await updateSaleMutation.mutateAsync({ status: 'cancelled' });
      toast.success('Sale cancelled');
    } catch {
      toast.error('Failed to cancel sale. The sale may already have payments or allocations.');
    }
  };

  const handleDownloadInvoice = () => {
    if (!sale || !buyer) return;
    generateInvoicePDF({
      saleCode: sale.saleCode,
      saleDate: String(sale.saleDate),
      buyer: {
        buyerName: buyer.buyerName,
        contactPerson: buyer.contactPerson ?? undefined,
        phoneNumber: buyer.phoneNumber ?? undefined,
        address: buyer.address ?? undefined,
      },
      batchCode: sale.batchCode ?? '',
      siteName: sale.siteName ?? '',
      line: isOtherIncome
        ? {
            description: sale.itemDescription ?? 'Other income',
            quantityText: `${Number(sale.quantity ?? 0).toLocaleString()} ${sale.unit ?? ''}`.trim(),
            rateText: `Rs. ${Number(sale.unitPrice ?? 0).toFixed(2)}${sale.unit ? `/${sale.unit}` : ''}`,
          }
        : undefined,
      totalBirds: sale.totalBirds,
      totalWeight: Number(sale.totalWeight),
      pricePerKg: Number(sale.pricePerKg),
      totalAmount: Number(sale.totalAmount),
      payments: payments.map((payment) => ({
        paymentDate: String(payment.paymentDate),
        paymentAmount: Number(payment.paymentAmount),
        paymentMethod: payment.paymentMethod as import('@farmflow/shared').PaymentMethod,
        paymentStatus: payment.paymentStatus as import('@farmflow/shared').PaymentStatus,
      })),
      totalPaid,
      outstandingBalance,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium">Sale not found</h3>
        <Button asChild variant="outline" className="mt-4"><Link to="/sales">Back to Sales</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon"><Link to="/sales"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{sale.saleCode}</h1>
            <p className="text-sm text-muted-foreground">
              <Link to={`/buyers/${sale.buyerId}`} className="hover:underline">{sale.buyerName}</Link> | {isOtherIncome ? sale.itemDescription : sale.batchCode}
            </p>
          </div>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${SALE_STATUS_COLORS[workflowStatus ?? sale.status] ?? ''}`}>
            {workflowStatus ?? sale.status}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {isDraft && hasPermission('sales:update') && (
            <Button onClick={isOtherIncome ? handleReviewOtherIncome : draftForm.handleSubmit(handleMarkReviewed)} disabled={updateSaleMutation.isPending}>
              <ShieldCheck className="h-4 w-4 mr-2" />
              Mark Reviewed
            </Button>
          )}
          {workflowStatus === SaleStatus.Reviewed && hasPermission('sales:update') && (
            <Button
              onClick={handleMarkCompleted}
              disabled={updateSaleMutation.isPending || !canMarkCompleted}
              title={canMarkCompleted ? undefined : 'Fully settle the sale before completing it'}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Mark Completed
            </Button>
          )}
          <Button variant="outline" onClick={handleDownloadInvoice}>
            <Receipt className="h-4 w-4 mr-2" />
            Invoice
          </Button>
          {canRecordReceipt && hasPermission('payments:create') && (
            <Button onClick={() => setShowAddPayment(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Receipt
            </Button>
          )}
          {sale.status !== 'cancelled' && hasPermission('sales:update') && (
            <Button variant="destructive" size="sm" onClick={handleCancelSale}>
              Cancel Sale
            </Button>
          )}
        </div>
      </div>

      {isDraft && (
        <Card className="border-warning/30 bg-warning-soft">
          <CardContent className="pt-6 text-sm text-warning">
            {isOtherIncome
              ? 'This sale is still in draft. Check the details and mark it reviewed to take payment.'
              : 'This sale is still in draft. Add the lorries and confirm the compiled totals before marking it reviewed. Receipts are disabled until review.'}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-info" />
              <div>
                <p className="text-2xl font-bold">{formatCurrency(Number(sale.totalAmount))}</p>
                <p className="text-xs text-muted-foreground">Total Amount</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-success" />
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totalPaid)}</p>
                <p className="text-xs text-muted-foreground">Applied Receipts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Banknote className={`h-5 w-5 ${outstandingBalance > 0 ? 'text-danger' : 'text-success'}`} />
              <div>
                <p className={`text-2xl font-bold ${outstandingBalance > 0 ? 'text-danger' : ''}`}>
                  {formatCurrency(outstandingBalance)}
                </p>
                <p className="text-xs text-muted-foreground">Outstanding</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{formatCurrency(availableBuyerCredit)}</p>
                <p className="text-xs text-muted-foreground">Available Credit</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Sale Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
            <div>
              <p className="text-muted-foreground">Sale Date</p>
              <p className="font-medium">{new Date(sale.saleDate).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Due</p>
              <p className="font-medium">{sale.dueDate ? new Date(sale.dueDate).toLocaleDateString() : '--'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Batch</p>
              <p className="font-medium">{sale.batchCode ?? '--'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Site</p>
              <p className="font-medium">{sale.siteName ?? '--'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Buyer</p>
              <p className="font-medium">{buyer?.buyerName ?? '--'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Contact</p>
              <p className="font-medium">{buyer?.contactPerson ?? '--'}</p>
            </div>
            {isOtherIncome ? (
              <>
                <div>
                  <p className="text-muted-foreground">Item</p>
                  <p className="font-medium">{sale.itemDescription}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Quantity</p>
                  <p className="font-medium">{Number(sale.quantity ?? 0).toLocaleString()} {sale.unit ?? ''}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Price per {sale.unit || 'unit'}</p>
                  <p className="font-medium">{formatCurrency(Number(sale.unitPrice ?? 0))}</p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="text-muted-foreground">Total Weight</p>
                  <p className="font-medium">{Number(sale.totalWeight).toLocaleString(undefined, { minimumFractionDigits: 2 })} kg</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Price per kg</p>
                  <p className="font-medium">{formatCurrency(Number(sale.pricePerKg))}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Birds Sold</p>
                  <p className="font-medium">{sale.totalBirds.toLocaleString()}</p>
                </div>
              </>
            )}
            <div>
              <p className="text-muted-foreground">Settlement</p>
              <p className="font-medium capitalize">{sale.settlementStatus?.replace('_', ' ') ?? 'unpaid'}</p>
            </div>
            {sale.notes && (
              <div className="col-span-full">
                <p className="text-muted-foreground">Notes</p>
                <p className="font-medium">{sale.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {isOtherIncome ? null : isDraft ? (
        <Card>
          <CardHeader><CardTitle>Sale Draft</CardTitle></CardHeader>
          <CardContent>
            <Form {...draftForm}>
              <form className="space-y-5" onSubmit={draftForm.handleSubmit(handleSaveDraft)}>
                <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                  <FormField
                    control={draftForm.control}
                    name="pricePerKg"
                  render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price per kg (Rs.)</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                        <p className="text-xs text-muted-foreground">
                          Formatted: {formatCurrency(Number(watchedDraftPrice) || 0)}
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={draftForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl><Textarea placeholder="Sale notes..." {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">Lorry Lines</h3>
                      <p className="text-sm text-muted-foreground">These totals will become the sale totals when you save the draft or review it.</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => draftLorryFieldArray.append(defaultLorryLine)}>
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
                        {draftLorryFieldArray.fields.map((field, index) => {
                          const row = watchedDraftLorries?.[index];
                          const netWeight = Math.max((Number(row?.loadedWeight) || 0) - (Number(row?.previousWeight) || 0), 0);
                          return (
                            <TableRow key={field.id} className="align-top">
                              <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                              <TableCell className="min-w-[160px]">
                                <FormField
                                  control={draftForm.control}
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
                                  control={draftForm.control}
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
                                  control={draftForm.control}
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
                                  control={draftForm.control}
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
                                  control={draftForm.control}
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
                                  disabled={draftLorryFieldArray.fields.length === 1}
                                  onClick={() => draftLorryFieldArray.remove(index)}
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
                    <p className="text-lg font-semibold text-foreground">{draftTotals.totalBirds.toLocaleString()}</p>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Weight</p>
                    <p className="text-lg font-semibold text-foreground">{draftTotals.totalWeight.toFixed(2)} kg</p>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Sale Amount</p>
                    <p className="text-lg font-semibold text-foreground">{formatCurrency(draftTotals.totalAmount)}</p>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="submit" variant="outline" disabled={updateSaleMutation.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Draft
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Lorries ({lorryLines.length})</CardTitle></CardHeader>
          <CardContent>
            {lorryLines.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No lorry lines recorded on this sale.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lorry</TableHead>
                    <TableHead>Birds</TableHead>
                    <TableHead>Previous Weight</TableHead>
                    <TableHead>After Weight</TableHead>
                    <TableHead>Net Weight</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lorryLines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-medium">{line.lorryNumber}</TableCell>
                      <TableCell>{line.birdsCount.toLocaleString()}</TableCell>
                      <TableCell>{Number(line.previousWeight).toFixed(2)} kg</TableCell>
                      <TableCell>{Number(line.loadedWeight).toFixed(2)} kg</TableCell>
                      <TableCell className="font-medium">{Number(line.netWeight).toFixed(2)} kg</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Receipts ({payments.length})</CardTitle></CardHeader>
        <CardContent>
          {!canRecordReceipt ? (
            <p className="text-sm text-muted-foreground text-center py-4">Review the draft sale before recording receipts.</p>
          ) : payments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No receipts recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="hidden lg:table-cell">Treasury</TableHead>
                    <TableHead className="hidden sm:table-cell">Cheque #</TableHead>
                    <TableHead>Status</TableHead>
                    {hasPermission('payments:update') && <TableHead className="w-[150px]" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{new Date(payment.paymentDate).toLocaleDateString()}</TableCell>
                      <TableCell className="text-muted-foreground">{payment.receiptCode ?? payment.referenceNumber ?? payment.id}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(Number(payment.paymentAmount))}</TableCell>
                      <TableCell>{PAYMENT_METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod}</TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        <div>
                          <p>
                            {payment.financeAccountName
                              || (payment.financeAccountId ? treasuryAccountLookup.get(payment.financeAccountId)?.accountName ?? `Account #${payment.financeAccountId}` : '--')}
                          </p>
                          {payment.treasuryTransactionId ? (
                            <div className="mt-1 text-[11px] text-success">Txn #{payment.treasuryTransactionId}</div>
                          ) : payment.source === 'receipt_line' ? (
                            <div className="mt-1 text-[11px] text-warning">Not posted</div>
                          ) : null}
                          {payment.treasuryReversalTransactionId ? (
                            <div className="text-[11px] text-danger">Reversal #{payment.treasuryReversalTransactionId}</div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">{payment.chequeNumber ?? '--'}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize ${PAYMENT_STATUS_COLORS[payment.paymentStatus] ?? ''}`}>
                          {payment.paymentStatus}
                        </span>
                      </TableCell>
                      {hasPermission('payments:update') && (
                        <TableCell>
                          {payment.paymentStatus === 'pending' && (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-success"
                                onClick={() => handleUpdatePaymentStatus(payment.id, 'completed')}
                                disabled={updatePaymentMutation.isPending}
                              >
                                Clear
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-danger"
                                onClick={() => handleUpdatePaymentStatus(payment.id, 'bounced')}
                                disabled={updatePaymentMutation.isPending}
                              >
                                Bounce
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddPayment} onOpenChange={setShowAddPayment}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[1120px]">
          <DialogHeader>
            <DialogTitle>Add Receipt</DialogTitle>
            <DialogDescription>
              Outstanding balance: {formatCurrency(outstandingBalance)}. Any extra receipt amount remains as buyer credit.
            </DialogDescription>
          </DialogHeader>
          {treasuryAccountsLoading ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-72 rounded-lg" />
            </div>
          ) : treasuryAccounts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 p-6 text-center">
              <Landmark className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-3 font-medium">Create a treasury account first</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Receipts must be assigned to a Treasury account so the incoming money updates the central finance balance.
              </p>
            </div>
          ) : (
            <Form {...receiptForm}>
              <form onSubmit={receiptForm.handleSubmit(handleAddPayment)} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={receiptForm.control}
                    name="receiptDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Receipt Date</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="rounded-lg bg-muted px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Receipt Total</p>
                    <p className="text-xl font-semibold text-foreground">{formatCurrency(receiptTotal)}</p>
                  </div>
                </div>

                <FormField
                  control={receiptForm.control}
                  name="receiptNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Receipt Notes</FormLabel>
                      <FormControl><Textarea placeholder="Optional header notes..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">Payment Lines</h3>
                      <p className="text-sm text-muted-foreground">Use multiple lines when the buyer pays with different methods. Each line must land in a treasury account.</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => receiptFieldArray.append({ ...defaultReceiptLine, financeAccountId: treasuryAccounts[0]?.id ?? 0 })}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Line
                    </Button>
                  </div>

                  <div className="overflow-x-auto">
                    <Table className="min-w-[1280px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60px]">#</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Treasury Account</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead>Cheque #</TableHead>
                          <TableHead>Cheque Date</TableHead>
                          <TableHead>Bank</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead className="w-[70px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {receiptFieldArray.fields.map((field, index) => {
                          const paymentMethod = watchedReceiptLines?.[index]?.paymentMethod;
                          const isCheque = paymentMethod === 'cheque';
                          const usesBank = paymentMethod === 'cheque' || paymentMethod === 'bank_transfer';
                          return (
                            <TableRow key={field.id} className="align-top">
                              <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                              <TableCell className="min-w-[150px]">
                                <FormField
                                  control={receiptForm.control}
                                  name={`lines.${index}.paymentAmount`}
                                  render={({ field }) => (
                                    <FormItem className="space-y-1">
                                      <FormLabel className="sr-only">Amount</FormLabel>
                                      <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </TableCell>
                              <TableCell className="min-w-[180px]">
                                <FormField
                                  control={receiptForm.control}
                                  name={`lines.${index}.paymentMethod`}
                                  render={({ field }) => (
                                    <FormItem className="space-y-1">
                                      <FormLabel className="sr-only">Payment Method</FormLabel>
                                      <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl>
                                          <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          <SelectItem value="cash">Cash</SelectItem>
                                          <SelectItem value="cheque">Cheque</SelectItem>
                                          <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </TableCell>
                              <TableCell className="min-w-[210px]">
                                <FormField
                                  control={receiptForm.control}
                                  name={`lines.${index}.financeAccountId`}
                                  render={({ field }) => (
                                    <FormItem className="space-y-1">
                                      <FormLabel className="sr-only">Treasury Account</FormLabel>
                                      <Select value={field.value ? String(field.value) : ''} onValueChange={(value) => field.onChange(Number(value))}>
                                        <FormControl>
                                          <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {treasuryAccounts.map((account) => (
                                            <SelectItem key={account.id} value={String(account.id)}>
                                              {account.accountName} • {account.accountCode}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </TableCell>
                              <TableCell className="min-w-[170px]">
                                <FormField
                                  control={receiptForm.control}
                                  name={`lines.${index}.referenceNumber`}
                                  render={({ field }) => (
                                    <FormItem className="space-y-1">
                                      <FormLabel className="sr-only">Reference</FormLabel>
                                      <FormControl><Input placeholder="Optional reference" {...field} /></FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </TableCell>
                              <TableCell className="min-w-[160px]">
                                <FormField
                                  control={receiptForm.control}
                                  name={`lines.${index}.chequeNumber`}
                                  render={({ field }) => (
                                    <FormItem className="space-y-1">
                                      <FormLabel className="sr-only">Cheque Number</FormLabel>
                                      <FormControl><Input placeholder="Cheque number" disabled={!isCheque} {...field} /></FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </TableCell>
                              <TableCell className="min-w-[170px]">
                                <FormField
                                  control={receiptForm.control}
                                  name={`lines.${index}.chequeDate`}
                                  render={({ field }) => (
                                    <FormItem className="space-y-1">
                                      <FormLabel className="sr-only">Cheque Date</FormLabel>
                                      <FormControl><Input type="date" disabled={!isCheque} {...field} /></FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </TableCell>
                              <TableCell className="min-w-[180px]">
                                <FormField
                                  control={receiptForm.control}
                                  name={`lines.${index}.bankName`}
                                  render={({ field }) => (
                                    <FormItem className="space-y-1">
                                      <FormLabel className="sr-only">Bank Name</FormLabel>
                                      <FormControl><Input placeholder="Bank name" disabled={!usesBank} {...field} /></FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </TableCell>
                              <TableCell className="min-w-[220px]">
                                <FormField
                                  control={receiptForm.control}
                                  name={`lines.${index}.notes`}
                                  render={({ field }) => (
                                    <FormItem className="space-y-1">
                                      <FormLabel className="sr-only">Line Notes</FormLabel>
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
                                  disabled={receiptFieldArray.fields.length === 1}
                                  onClick={() => receiptFieldArray.remove(index)}
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

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowAddPayment(false)}>Cancel</Button>
                  <Button type="submit" disabled={createPaymentMutation.isPending}>
                    {createPaymentMutation.isPending ? 'Recording...' : 'Record Receipt'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
