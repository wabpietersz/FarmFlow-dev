import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useSale, useCreatePayment, useUpdatePayment, useUpdateSale } from '@/hooks/useSales';
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
import { paymentFormSchema, type PaymentFormValues } from '@/lib/validations/sales';
import { ArrowLeft, Plus, DollarSign, CreditCard, Banknote, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { generateInvoicePDF } from '@/lib/generateInvoice';

const SALE_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  bounced: 'bg-red-100 text-red-800',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  cheque: 'Cheque',
  bank_transfer: 'Bank Transfer',
};

export default function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuthStore();
  const { data, isLoading } = useSale(id);
  const createPaymentMutation = useCreatePayment(id!);
  const updatePaymentMutation = useUpdatePayment();
  const updateSaleMutation = useUpdateSale(id!);

  const [showAddPayment, setShowAddPayment] = useState(false);

  const saleData = data?.data;
  const sale = saleData?.sale;
  const buyer = saleData?.buyer;
  const payments = saleData?.payments ?? [];
  const totalPaid = saleData?.totalPaid ?? 0;
  const outstandingBalance = saleData?.outstandingBalance ?? 0;

  const paymentForm = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      paymentAmount: 0,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: undefined,
      chequeNumber: '',
      chequeDate: '',
      bankName: '',
      notes: '',
    },
  });

  const watchedMethod = paymentForm.watch('paymentMethod');

  const handleAddPayment = async (values: PaymentFormValues) => {
    try {
      await createPaymentMutation.mutateAsync({
        paymentAmount: values.paymentAmount,
        paymentDate: values.paymentDate,
        paymentMethod: values.paymentMethod as unknown as import('@farmflow/shared').PaymentMethod,
        chequeNumber: values.chequeNumber || undefined,
        chequeDate: values.chequeDate || undefined,
        bankName: values.bankName || undefined,
        notes: values.notes || undefined,
      });
      toast.success('Payment recorded');
      paymentForm.reset();
      setShowAddPayment(false);
    } catch {
      toast.error('Failed to record payment');
    }
  };

  const handleUpdatePaymentStatus = async (paymentId: number, newStatus: string) => {
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
      toast.error('Failed to cancel sale. There may be completed payments.');
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
      totalBirds: sale.totalBirds,
      totalWeight: Number(sale.totalWeight),
      pricePerKg: Number(sale.pricePerKg),
      totalAmount: Number(sale.totalAmount),
      payments: payments.map((p) => ({
        paymentDate: String(p.paymentDate),
        paymentAmount: Number(p.paymentAmount),
        paymentMethod: p.paymentMethod,
        paymentStatus: p.paymentStatus,
      })),
      totalPaid,
      outstandingBalance,
    });
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

  if (!sale) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium">Sale not found</h3>
        <Button asChild variant="outline" className="mt-4"><Link to="/sales">Back to Sales</Link></Button>
      </div>
    );
  }

  const isPending = sale.status === 'pending';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon"><Link to="/sales"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{sale.saleCode}</h1>
            <p className="text-sm text-muted-foreground">{sale.buyerName} | {sale.batchCode}</p>
          </div>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${SALE_STATUS_COLORS[sale.status] ?? ''}`}>
            {sale.status}
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadInvoice}>
            <Receipt className="h-4 w-4 mr-2" />
            Invoice
          </Button>
          {isPending && hasPermission('payments:create') && (
            <Button onClick={() => setShowAddPayment(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Payment
            </Button>
          )}
          {isPending && hasPermission('sales:update') && (
            <Button variant="destructive" size="sm" onClick={handleCancelSale}>
              Cancel Sale
            </Button>
          )}
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
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
              <CreditCard className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totalPaid)}</p>
                <p className="text-xs text-muted-foreground">Total Paid</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Banknote className={`h-5 w-5 ${outstandingBalance > 0 ? 'text-red-600' : 'text-green-600'}`} />
              <div>
                <p className={`text-2xl font-bold ${outstandingBalance > 0 ? 'text-red-600' : ''}`}>
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
              <Receipt className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">{sale.totalBirds.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Birds Sold</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sale Details Card */}
      <Card>
        <CardHeader><CardTitle>Sale Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Sale Date</p>
              <p className="font-medium">{new Date(sale.saleDate).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Batch</p>
              <p className="font-medium">{sale.batchCode}</p>
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
              <p className="text-muted-foreground">Total Weight</p>
              <p className="font-medium">{Number(sale.totalWeight).toLocaleString(undefined, { minimumFractionDigits: 2 })} kg</p>
            </div>
            <div>
              <p className="text-muted-foreground">Contact</p>
              <p className="font-medium">{buyer?.contactPerson ?? '--'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Price per kg</p>
              <p className="font-medium">Rs. {Number(sale.pricePerKg).toFixed(2)}</p>
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

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payments ({payments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No payments recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="hidden sm:table-cell">Cheque #</TableHead>
                    <TableHead>Status</TableHead>
                    {hasPermission('payments:update') && <TableHead className="w-[150px]" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{new Date(payment.paymentDate).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(Number(payment.paymentAmount))}</TableCell>
                      <TableCell>{PAYMENT_METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod}</TableCell>
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
                                className="text-green-600"
                                onClick={() => handleUpdatePaymentStatus(payment.id, 'completed')}
                                disabled={updatePaymentMutation.isPending}
                              >
                                Clear
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600"
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

      {/* Add Payment Dialog */}
      <Dialog open={showAddPayment} onOpenChange={setShowAddPayment}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Payment</DialogTitle>
            <DialogDescription>
              Outstanding balance: {formatCurrency(outstandingBalance)}
            </DialogDescription>
          </DialogHeader>
          <Form {...paymentForm}>
            <form onSubmit={paymentForm.handleSubmit(handleAddPayment)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={paymentForm.control}
                  name="paymentAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (Rs.)</FormLabel>
                      <FormControl><Input type="number" step="0.01" max={outstandingBalance} placeholder="0.00" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={paymentForm.control}
                  name="paymentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={paymentForm.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
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
              {watchedMethod === 'cheque' && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={paymentForm.control}
                    name="chequeNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cheque Number</FormLabel>
                        <FormControl><Input placeholder="e.g. 123456" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={paymentForm.control}
                    name="chequeDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cheque Date</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
              {(watchedMethod === 'cheque' || watchedMethod === 'bank_transfer') && (
                <FormField
                  control={paymentForm.control}
                  name="bankName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bank Name</FormLabel>
                      <FormControl><Input placeholder="e.g. FNB" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={paymentForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl><Textarea placeholder="Any notes..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAddPayment(false)}>Cancel</Button>
                <Button type="submit" disabled={createPaymentMutation.isPending}>
                  {createPaymentMutation.isPending ? 'Recording...' : 'Record Payment'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
