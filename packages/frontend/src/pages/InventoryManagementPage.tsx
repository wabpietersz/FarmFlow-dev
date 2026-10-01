import { useMemo, useState } from 'react';
import { Package, ShoppingCart, Truck, Plus, Pencil, Factory, Eye, FileText, Receipt, ScanSearch, Warehouse, ClipboardList } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { parseApiError } from '@/lib/api';
import { CategorySelect, CostCentreSelect, EMPTY_FINANCE_TAGS, FinanceTagFields, financeTagsToPayload, type FinanceTagValue } from '@/components/finance/FinanceTagFields';
import { useBatches } from '@/hooks/useBatches';
import { useStockLocations } from '@/hooks/useStock';
import { StoresTab } from '@/components/stock/StoresTab';
import { RequisitionsTab } from '@/components/stock/RequisitionsTab';
import { InvoiceMatchBadge } from '@/components/stock/InvoiceMatchBadge';
import {
  useConsumeInventoryItem,
  useCreateSupplierContract,
  useCreateSupplierInvoice,
  useCreateSupplierPayment,
  useBatchAllocations,
  useCreateInventoryItem,
  useCreateInventoryPurchaseOrder,
  useCreateInventorySupplier,
  useInventoryItem,
  useInventoryItems,
  useInventoryItemTypes,
  useInventoryMovements,
  useInventoryPurchaseOrder,
  useInventoryPurchaseOrders,
  useLotTrace,
  usePayablesSummary,
  useSupplierContract,
  useSupplierContracts,
  useSupplierInvoice,
  useSupplierInvoices,
  useSupplierPayments,
  useInventorySuppliers,
  useReceiveInventoryPurchaseOrder,
  useUpdateInventoryItem,
  useUpdateInventoryPurchaseOrderStatus,
  useUpdateInventorySupplier,
  type InventoryItem,
  type InventorySupplier,
} from '@/hooks/useInventoryManagement';
import { useChequeLeaves, useTreasuryAccounts } from '@/hooks/useTreasury';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type SupplierForm = {
  supplierName: string;
  contactPerson: string;
  phoneNumber: string;
  email: string;
  address: string;
  status: string;
  defaultCategoryId: string;
};

type InventoryForm = {
  itemTypeId: string;
  itemCode: string;
  ingredientName: string;
  description: string;
  supplierId: string;
  quantity: string;
  unit: string;
  costPerUnit: string;
  reorderLevel: string;
};

type ConsumeForm = {
  batchId: string;
  quantity: string;
  consumptionDate: string;
  notes: string;
};

type PurchaseOrderForm = {
  supplierId: string;
  contractId: string;
  costCentreId: string;
  orderDate: string;
  expectedDeliveryDate: string;
  notes: string;
  items: Array<{
    inventoryItemId: string;
    orderedQuantity: string;
    unitPrice: string;
    unit: string;
  }>;
};

type ContractForm = {
  supplierId: string;
  contractType: string;
  contractTitle: string;
  description: string;
  status: string;
  validFrom: string;
  validTo: string;
  currencyCode: string;
  paymentTermsDays: string;
  commercialTerms: string;
  attachmentUrls: string;
  alertDaysBeforeExpiry: string;
  terms: Array<{
    termType: string;
    termKey: string;
    termValue: string;
    sortOrder: string;
  }>;
};

type SupplierInvoiceForm = {
  supplierId: string;
  purchaseOrderId: string;
  contractId: string;
  invoiceReference: string;
  invoiceDate: string;
  dueDate: string;
  invoiceAmount: string;
  currencyCode: string;
  status: string;
  notes: string;
};

type SupplierPaymentForm = {
  paymentDate: string;
  financeAccountId: string;
  paymentMethod: 'bank_transfer' | 'cash' | 'cheque';
  amount: string;
  referenceNumber: string;
  chequeLeafId: string;
  notes: string;
  tags: FinanceTagValue;
};

const EMPTY_SUPPLIER_FORM: SupplierForm = {
  supplierName: '',
  contactPerson: '',
  phoneNumber: '',
  email: '',
  address: '',
  status: 'active',
  defaultCategoryId: '',
};

const EMPTY_INVENTORY_FORM: InventoryForm = {
  itemTypeId: '',
  itemCode: '',
  ingredientName: '',
  description: '',
  supplierId: '',
  quantity: '',
  unit: 'unit',
  costPerUnit: '',
  reorderLevel: '',
};

const EMPTY_CONSUME_FORM: ConsumeForm = {
  batchId: '',
  quantity: '',
  consumptionDate: new Date().toISOString().split('T')[0],
  notes: '',
};

const EMPTY_PO_FORM: PurchaseOrderForm = {
  supplierId: '',
  contractId: '',
  costCentreId: '',
  orderDate: new Date().toISOString().split('T')[0],
  expectedDeliveryDate: '',
  notes: '',
  items: [{ inventoryItemId: '', orderedQuantity: '', unitPrice: '', unit: 'unit' }],
};

const EMPTY_CONTRACT_FORM: ContractForm = {
  supplierId: '',
  contractType: 'supplier',
  contractTitle: '',
  description: '',
  status: 'draft',
  validFrom: new Date().toISOString().split('T')[0],
  validTo: '',
  currencyCode: 'LKR',
  paymentTermsDays: '0',
  commercialTerms: '',
  attachmentUrls: '',
  alertDaysBeforeExpiry: '30',
  terms: [{ termType: 'commercial', termKey: '', termValue: '', sortOrder: '0' }],
};

const EMPTY_SUPPLIER_INVOICE_FORM: SupplierInvoiceForm = {
  supplierId: '',
  purchaseOrderId: '',
  contractId: '',
  invoiceReference: '',
  invoiceDate: new Date().toISOString().split('T')[0],
  dueDate: new Date().toISOString().split('T')[0],
  invoiceAmount: '',
  currencyCode: 'LKR',
  status: 'recorded',
  notes: '',
};

const EMPTY_SUPPLIER_PAYMENT_FORM: SupplierPaymentForm = {
  paymentDate: new Date().toISOString().split('T')[0],
  financeAccountId: '',
  paymentMethod: 'bank_transfer',
  amount: '',
  referenceNumber: '',
  chequeLeafId: '',
  notes: '',
  tags: EMPTY_FINANCE_TAGS,
};

function ReceivePODialogContent({
  poId,
  batches,
  onClose,
}: {
  poId: number;
  batches: Array<{ id: number; batchCode: string }>;
  onClose: () => void;
}) {
  const { data } = useInventoryPurchaseOrder(poId);
  const receiveMutation = useReceiveInventoryPurchaseOrder();
  const detail = data?.data;
  const items = detail?.items ?? [];

  const [receiveForm, setReceiveForm] = useState<Record<number, { receivedQuantity: string; batchId: string; allocatedQuantity: string; expiryDate: string }>>({});
  const stores = (useStockLocations().data?.data ?? []).filter((l) => l.status === 'active');
  const [storeId, setStoreId] = useState('');

  const handleReceive = async () => {
    try {
      const payload = items
        .map((item) => {
          const form = receiveForm[item.id];
          if (!form?.receivedQuantity) return null;
          const receivedQuantity = Number(form.receivedQuantity);
          if (!receivedQuantity || receivedQuantity <= 0) return null;
          const batchAllocations = form.batchId && form.allocatedQuantity
            ? [{ batchId: Number(form.batchId), quantity: Number(form.allocatedQuantity) }]
            : [];
          return {
            itemId: item.id,
            receivedQuantity,
            expiryDate: form.expiryDate || null,
            batchAllocations,
          };
        })
        .filter((item): item is { itemId: number; receivedQuantity: number; expiryDate: string | null; batchAllocations: Array<{ batchId: number; quantity: number }> } => item !== null);

      if (payload.length === 0) {
        toast.error('Enter at least one received quantity');
        return;
      }

      await receiveMutation.mutateAsync({ id: poId, items: payload, locationId: storeId ? Number(storeId) : null });
      toast.success('Purchase order receipt recorded');
      onClose();
    } catch (error) {
      parseApiError(error, 'Failed to receive purchase order');
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Receive Purchase Order</DialogTitle>
        <DialogDescription>
          Receive stock into a store and, for medicine and supplies, optionally use some straight away on a batch.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label>Receive into</Label>
        <Select value={storeId || 'auto'} onValueChange={(value) => setStoreId(value === 'auto' ? '' : value)}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Automatic (feed → mill store, farm orders → farm store)</SelectItem>
            {stores.map((store) => <SelectItem key={store.id} value={String(store.id)}>{store.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        {items.map((item) => {
          const remaining = Number(item.orderedQuantity) - Number(item.receivedQuantity);
          const form = receiveForm[item.id] ?? { receivedQuantity: '', batchId: '', allocatedQuantity: '', expiryDate: '' };
          return (
            <div key={item.id} className="space-y-3 rounded-md border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{item.ingredientName}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.typeName} • Remaining {remaining.toLocaleString()} {item.unit}
                  </p>
                </div>
                <Badge variant={item.isFeed ? 'secondary' : 'outline'}>
                  {item.isFeed ? 'Feed item' : 'Batch allocatable'}
                </Badge>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="grid gap-2">
                  <Label>Receive Quantity</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.receivedQuantity}
                    onChange={(e) => setReceiveForm((prev) => ({
                      ...prev,
                      [item.id]: { ...form, receivedQuantity: e.target.value },
                    }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Expiry date (if any)</Label>
                  <Input
                    type="date"
                    value={form.expiryDate}
                    onChange={(e) => setReceiveForm((prev) => ({
                      ...prev,
                      [item.id]: { ...form, expiryDate: e.target.value },
                    }))}
                  />
                </div>
                {!item.isFeed ? (
                  <>
                    <div className="grid gap-2">
                      <Label>Allocate to Batch</Label>
                      <Select
                        value={form.batchId || 'none'}
                        onValueChange={(value) => setReceiveForm((prev) => ({
                          ...prev,
                          [item.id]: { ...form, batchId: value === 'none' ? '' : value },
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Optional batch" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No batch allocation</SelectItem>
                          {batches.map((batch) => (
                            <SelectItem key={batch.id} value={String(batch.id)}>
                              {batch.batchCode}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Allocated Quantity</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.allocatedQuantity}
                        onChange={(e) => setReceiveForm((prev) => ({
                          ...prev,
                          [item.id]: { ...form, allocatedQuantity: e.target.value },
                        }))}
                      />
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleReceive} disabled={receiveMutation.isPending}>Receive</Button>
      </DialogFooter>
    </>
  );
}

function PurchaseOrderDetailDialogContent({
  poId,
}: {
  poId: number;
}) {
  const { data, isLoading, error } = useInventoryPurchaseOrder(poId);
  const detail = data?.data;
  const payments = detail?.payments ?? [];
  const invoices = detail?.invoices ?? [];
  const paymentSummary = detail?.paymentSummary ?? {
    totalPaid: 0,
    pendingAmount: 0,
    totalInvoiced: 0,
    outstandingAmount: 0,
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Purchase Order Detail</DialogTitle>
        <DialogDescription>
          Review ordered items together with supplier payments and Treasury references.
        </DialogDescription>
      </DialogHeader>

      {isLoading ? (
        <div className="py-6 text-sm text-muted-foreground">Loading purchase order detail...</div>
      ) : error ? (
        <div className="py-6 text-sm text-destructive">Failed to load purchase order detail.</div>
      ) : detail ? (
        <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
          <div className="grid gap-3 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">PO Total</p>
                <p className="mt-2 text-xl font-semibold">Rs. {Number(detail.purchaseOrder.totalCost).toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Paid</p>
                <p className="mt-2 text-xl font-semibold">Rs. {paymentSummary.totalPaid.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending</p>
                <p className="mt-2 text-xl font-semibold">Rs. {paymentSummary.pendingAmount.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Outstanding</p>
                <p className="mt-2 text-xl font-semibold">Rs. {paymentSummary.outstandingAmount.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Invoiced</p>
                <p className="mt-2 text-xl font-semibold">Rs. {Number(paymentSummary.totalInvoiced ?? 0).toFixed(2)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="rounded-md border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{detail.purchaseOrder.orderCode}</p>
                <p className="text-sm text-muted-foreground">{detail.purchaseOrder.supplierName || '--'}</p>
              </div>
              <Badge variant="outline">{detail.purchaseOrder.status}</Badge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Order Date</p>
                <p className="mt-1">{new Date(detail.purchaseOrder.orderDate).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Expected Delivery</p>
                <p className="mt-1">
                  {detail.purchaseOrder.expectedDeliveryDate
                    ? new Date(detail.purchaseOrder.expectedDeliveryDate).toLocaleDateString()
                    : '--'}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Actual Delivery</p>
                <p className="mt-1">
                  {detail.purchaseOrder.actualDeliveryDate
                    ? new Date(detail.purchaseOrder.actualDeliveryDate).toLocaleDateString()
                    : '--'}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="text-base font-semibold">Supplier Payments</h3>
              <p className="text-sm text-muted-foreground">Treasury-linked supplier disbursements recorded against this purchase order.</p>
            </div>
            {payments.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                No supplier payments recorded for this purchase order yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Treasury</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{payment.paymentCode}</p>
                          <p className="text-xs text-muted-foreground">{payment.referenceNumber || payment.chequeNumber || '--'}</p>
                        </div>
                      </TableCell>
                      <TableCell>{new Date(payment.paymentDate).toLocaleDateString()}</TableCell>
                      <TableCell>{payment.paymentMethod.replace('_', ' ')}</TableCell>
                      <TableCell>{payment.financeAccountName || `Account #${payment.financeAccountId}`}</TableCell>
                      <TableCell><Badge variant="outline">{payment.paymentStatus}</Badge></TableCell>
                      <TableCell className="text-right font-medium">Rs. {Number(payment.amount).toFixed(2)}</TableCell>
                      <TableCell>{payment.treasuryTransactionId ? `Txn #${payment.treasuryTransactionId}` : '--'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="text-base font-semibold">Linked Invoices</h3>
              <p className="text-sm text-muted-foreground">Operational invoice capture against this purchase order and current payable balance.</p>
            </div>
            {invoices.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                No supplier invoices linked to this purchase order yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Balance Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.invoiceCode}</TableCell>
                      <TableCell>{invoice.invoiceReference}</TableCell>
                      <TableCell>{new Date(invoice.dueDate).toLocaleDateString()}</TableCell>
                      <TableCell><Badge variant="outline">{invoice.status}</Badge></TableCell>
                      <TableCell className="text-right">Rs. {Number(invoice.invoiceAmount).toFixed(2)}</TableCell>
                      <TableCell className="text-right">Rs. {Number(invoice.balanceDue ?? 0).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="text-base font-semibold">Order Items</h3>
              <p className="text-sm text-muted-foreground">Ordered and received quantities for each inventory line.</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Ordered</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Unit Price</TableHead>
                  <TableHead className="text-right">Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.ingredientName}</p>
                        <p className="text-xs text-muted-foreground">{item.itemCode || '--'}</p>
                      </div>
                    </TableCell>
                    <TableCell>{item.typeName}</TableCell>
                    <TableCell>{Number(item.orderedQuantity).toLocaleString()} {item.unit}</TableCell>
                    <TableCell>{Number(item.receivedQuantity).toLocaleString()} {item.unit}</TableCell>
                    <TableCell>Rs. {Number(item.unitPrice).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{item.receivedPercentage.toFixed(2)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <div className="py-6 text-sm text-muted-foreground">Purchase order not found.</div>
      )}
    </>
  );
}

function SupplierPaymentHistoryDialogContent({
  supplierId,
}: {
  supplierId: number;
}) {
  const { data, isLoading, error } = useSupplierPayments(supplierId);
  const payments = data?.data ?? [];

  return (
    <>
      <DialogHeader>
        <DialogTitle>Supplier Payment History</DialogTitle>
        <DialogDescription>
          Treasury-linked supplier disbursements recorded for this supplier across purchase orders.
        </DialogDescription>
      </DialogHeader>

      {isLoading ? (
        <div className="py-6 text-sm text-muted-foreground">Loading supplier payments...</div>
      ) : error ? (
        <div className="py-6 text-sm text-destructive">Failed to load supplier payment history.</div>
      ) : payments.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No supplier payments recorded for this supplier yet.
        </div>
      ) : (
        <div className="max-h-[65vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment</TableHead>
                <TableHead>PO</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Treasury</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium">{payment.paymentCode}</TableCell>
                  <TableCell>{payment.purchaseOrderCode || '--'}</TableCell>
                  <TableCell>{new Date(payment.paymentDate).toLocaleDateString()}</TableCell>
                  <TableCell>{payment.paymentMethod.replace('_', ' ')}</TableCell>
                  <TableCell>{payment.financeAccountName || `Account #${payment.financeAccountId}`}</TableCell>
                  <TableCell><Badge variant="outline">{payment.paymentStatus}</Badge></TableCell>
                  <TableCell className="text-right">Rs. {Number(payment.amount).toFixed(2)}</TableCell>
                  <TableCell>
                    {payment.treasuryTransactionId ? `Txn #${payment.treasuryTransactionId}` : '--'}
                    {payment.treasuryReversalTransactionId ? ` / Rev #${payment.treasuryReversalTransactionId}` : ''}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

function SupplierContractDetailDialogContent({
  contractId,
}: {
  contractId: number;
}) {
  const { data, isLoading, error } = useSupplierContract(contractId);
  const detail = data?.data;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Contract Detail</DialogTitle>
        <DialogDescription>
          Review validity, terms, linked purchase orders, and linked invoices for this supplier contract.
        </DialogDescription>
      </DialogHeader>
      {isLoading ? (
        <div className="py-6 text-sm text-muted-foreground">Loading contract detail...</div>
      ) : error ? (
        <div className="py-6 text-sm text-destructive">Failed to load contract detail.</div>
      ) : !detail ? (
        <div className="py-6 text-sm text-muted-foreground">Contract not found.</div>
      ) : (
        <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
          <div className="grid gap-3 md:grid-cols-4">
            <Card><CardContent className="pt-6"><p className="text-xs uppercase tracking-wide text-muted-foreground">Supplier</p><p className="mt-2 text-base font-semibold">{detail.supplierName}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p><p className="mt-2 text-base font-semibold capitalize">{detail.status}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-xs uppercase tracking-wide text-muted-foreground">Validity</p><p className="mt-2 text-base font-semibold">{new Date(detail.validFrom).toLocaleDateString()} {detail.validTo ? `to ${new Date(detail.validTo).toLocaleDateString()}` : ''}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-xs uppercase tracking-wide text-muted-foreground">Payment Terms</p><p className="mt-2 text-base font-semibold">{detail.paymentTermsDays} days</p></CardContent></Card>
          </div>

          <div className="rounded-md border p-4">
            <p className="font-semibold">{detail.contractCode}</p>
            <p className="text-sm text-muted-foreground">{detail.contractTitle}</p>
            {detail.description ? <p className="mt-3 text-sm">{detail.description}</p> : null}
            {detail.commercialTerms ? (
              <div className="mt-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Commercial Terms</p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{detail.commercialTerms}</p>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-semibold">Terms</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.terms.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="h-16 text-center text-sm text-muted-foreground">No explicit terms recorded.</TableCell></TableRow>
                ) : detail.terms.map((term, index) => (
                  <TableRow key={`${term.termKey}-${index}`}>
                    <TableCell>{term.termType}</TableCell>
                    <TableCell>{term.termKey}</TableCell>
                    <TableCell>{term.termValue}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-semibold">Linked Purchase Orders</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.linkedPurchaseOrders.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="h-16 text-center text-sm text-muted-foreground">No linked purchase orders.</TableCell></TableRow>
                ) : detail.linkedPurchaseOrders.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-medium">{po.orderCode}</TableCell>
                    <TableCell>{new Date(po.orderDate).toLocaleDateString()}</TableCell>
                    <TableCell><Badge variant={po.status === 'pending_approval' ? 'warning' : 'outline'} className="capitalize">{po.status.replace(/_/g, ' ')}</Badge></TableCell>
                    <TableCell className="text-right">Rs. {Number(po.totalCost).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-semibold">Linked Invoices</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.linkedInvoices.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="h-16 text-center text-sm text-muted-foreground">No linked invoices.</TableCell></TableRow>
                ) : detail.linkedInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoiceCode}</TableCell>
                    <TableCell>{invoice.invoiceReference}</TableCell>
                    <TableCell>{new Date(invoice.dueDate).toLocaleDateString()}</TableCell>
                    <TableCell><Badge variant="outline">{invoice.status}</Badge></TableCell>
                    <TableCell className="text-right">Rs. {Number(invoice.invoiceAmount).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </>
  );
}

function SupplierInvoiceDetailDialogContent({
  invoiceId,
}: {
  invoiceId: number;
}) {
  const { data, isLoading, error } = useSupplierInvoice(invoiceId);
  const detail = data?.data;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Supplier Invoice Detail</DialogTitle>
        <DialogDescription>
          Review invoice balance and payment allocations linked to treasury-settled supplier payments.
        </DialogDescription>
      </DialogHeader>
      {isLoading ? (
        <div className="py-6 text-sm text-muted-foreground">Loading supplier invoice detail...</div>
      ) : error ? (
        <div className="py-6 text-sm text-destructive">Failed to load supplier invoice detail.</div>
      ) : !detail ? (
        <div className="py-6 text-sm text-muted-foreground">Supplier invoice not found.</div>
      ) : (
        <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
          <div className="grid gap-3 md:grid-cols-4">
            <Card><CardContent className="pt-6"><p className="text-xs uppercase tracking-wide text-muted-foreground">Invoice</p><p className="mt-2 text-base font-semibold">{detail.invoiceCode}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-xs uppercase tracking-wide text-muted-foreground">Amount</p><p className="mt-2 text-base font-semibold">Rs. {Number(detail.invoiceAmount).toFixed(2)}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-xs uppercase tracking-wide text-muted-foreground">Paid</p><p className="mt-2 text-base font-semibold">Rs. {Number(detail.paidAmount ?? 0).toFixed(2)}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-xs uppercase tracking-wide text-muted-foreground">Balance Due</p><p className="mt-2 text-base font-semibold">Rs. {Number(detail.balanceDue ?? 0).toFixed(2)}</p></CardContent></Card>
          </div>

          <div className="rounded-md border p-4 text-sm">
            <div className="grid gap-3 md:grid-cols-2">
              <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Supplier</p><p className="mt-1 font-medium">{detail.supplierName}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Reference</p><p className="mt-1 font-medium">{detail.invoiceReference}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-muted-foreground">PO</p><p className="mt-1 font-medium">{detail.purchaseOrderCode || '--'}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Contract</p><p className="mt-1 font-medium">{detail.contractCode || '--'}</p></div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-semibold">Payment Allocations</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Treasury</TableHead>
                  <TableHead className="text-right">Allocated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.allocations.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-16 text-center text-sm text-muted-foreground">No payment allocations recorded yet.</TableCell></TableRow>
                ) : detail.allocations.map((allocation) => (
                  <TableRow key={allocation.id}>
                    <TableCell className="font-medium">{allocation.paymentCode}</TableCell>
                    <TableCell>{new Date(allocation.paymentDate).toLocaleDateString()}</TableCell>
                    <TableCell>{allocation.paymentMethod.replace('_', ' ')}</TableCell>
                    <TableCell><Badge variant="outline">{allocation.paymentStatus}</Badge></TableCell>
                    <TableCell>{allocation.treasuryTransactionId ? `Txn #${allocation.treasuryTransactionId}` : '--'}</TableCell>
                    <TableCell className="text-right">Rs. {Number(allocation.allocatedAmount).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </>
  );
}

function LotTraceDialogContent({
  lotId,
}: {
  lotId: number;
}) {
  const { data, isLoading, error } = useLotTrace(lotId);
  const detail = data?.data;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Lot Trace</DialogTitle>
        <DialogDescription>
          Follow this lot from receipt through production usage and direct batch allocations.
        </DialogDescription>
      </DialogHeader>
      {isLoading ? (
        <div className="py-6 text-sm text-muted-foreground">Loading lot trace...</div>
      ) : error ? (
        <div className="py-6 text-sm text-destructive">Failed to load lot trace.</div>
      ) : !detail ? (
        <div className="py-6 text-sm text-muted-foreground">Lot not found.</div>
      ) : (
        <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
          <div className="grid gap-3 md:grid-cols-4">
            <Card><CardContent className="pt-6"><p className="text-xs uppercase tracking-wide text-muted-foreground">Lot</p><p className="mt-2 text-base font-semibold">{detail.lot.lotCode}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-xs uppercase tracking-wide text-muted-foreground">Received</p><p className="mt-2 text-base font-semibold">{Number(detail.lot.receivedQuantity).toLocaleString()}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-xs uppercase tracking-wide text-muted-foreground">Remaining</p><p className="mt-2 text-base font-semibold">{Number(detail.lot.remainingQuantity).toLocaleString()}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-xs uppercase tracking-wide text-muted-foreground">PO</p><p className="mt-2 text-base font-semibold">{detail.lot.purchaseOrderCode || '--'}</p></CardContent></Card>
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-semibold">Movement Ledger</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.movements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell>{new Date(movement.movementDate).toLocaleDateString()}</TableCell>
                    <TableCell>{movement.movementType}</TableCell>
                    <TableCell>{movement.sourceCodeSnapshot || `${movement.sourceEntityType} #${movement.sourceEntityId}`}</TableCell>
                    <TableCell className="text-right">{Number(movement.quantity).toLocaleString()} {movement.unit}</TableCell>
                    <TableCell className="text-right">{movement.balanceAfterQuantity ? Number(movement.balanceAfterQuantity).toLocaleString() : '--'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </>
  );
}

export default function InventoryManagementPage() {
  const { hasPermission } = useAuthStore();
  const [params, setParams] = useSearchParams();
  const activeTab = params.get('tab') ?? 'inventory';
  const [inventorySearch, setInventorySearch] = useState('');
  const [poSearch, setPoSearch] = useState('');
  const [selectedSupplierIdFilter, setSelectedSupplierIdFilter] = useState<string>('all');

  const { data: itemTypesData } = useInventoryItemTypes();
  const { data: suppliersData } = useInventorySuppliers();
  const { data: itemsData } = useInventoryItems({ page: 1, limit: 100, search: inventorySearch || undefined });
  const { data: purchaseOrdersData } = useInventoryPurchaseOrders({ page: 1, limit: 100, search: poSearch || undefined });
  const { data: contractsData } = useSupplierContracts({
    supplierId: selectedSupplierIdFilter !== 'all' ? Number(selectedSupplierIdFilter) : undefined,
  });
  const { data: supplierInvoicesData } = useSupplierInvoices({
    supplierId: selectedSupplierIdFilter !== 'all' ? Number(selectedSupplierIdFilter) : undefined,
  });
  const { data: payablesSummaryData } = usePayablesSummary({
    supplierId: selectedSupplierIdFilter !== 'all' ? Number(selectedSupplierIdFilter) : undefined,
  });
  const { data: inventoryMovementsData } = useInventoryMovements();
  const { data: batchAllocationsData } = useBatchAllocations();
  const { data: batchesData } = useBatches({ limit: 100 });
  const { data: treasuryAccountsData } = useTreasuryAccounts();

  const itemTypes = itemTypesData?.data ?? [];
  const suppliers = suppliersData?.data ?? [];
  const inventoryItems = itemsData?.data ?? [];
  const purchaseOrders = purchaseOrdersData?.data ?? [];
  const contracts = contractsData?.data ?? [];
  const supplierInvoices = supplierInvoicesData?.data ?? [];
  const payablesSummary = payablesSummaryData?.data ?? [];
  const inventoryMovements = inventoryMovementsData?.data ?? [];
  const batchAllocations = batchAllocationsData?.data ?? [];
  const batches = (batchesData?.data ?? []).map((batch) => ({ id: batch.id, batchCode: batch.batchCode }));
  const treasuryAccounts = (treasuryAccountsData?.data ?? []).filter((account) => account.status === 'active');


  const [showSupplierDialog, setShowSupplierDialog] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<InventorySupplier | null>(null);
  const [supplierForm, setSupplierForm] = useState<SupplierForm>(EMPTY_SUPPLIER_FORM);

  const [showInventoryDialog, setShowInventoryDialog] = useState(false);
  const [editingInventoryItem, setEditingInventoryItem] = useState<InventoryItem | null>(null);
  const [inventoryForm, setInventoryForm] = useState<InventoryForm>(EMPTY_INVENTORY_FORM);

  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState<number | null>(null);
  const [showInventoryDetail, setShowInventoryDetail] = useState(false);
  const [showConsumeDialog, setShowConsumeDialog] = useState(false);
  const [consumeForm, setConsumeForm] = useState<ConsumeForm>(EMPTY_CONSUME_FORM);

  const [showPODialog, setShowPODialog] = useState(false);
  const [poForm, setPoForm] = useState<PurchaseOrderForm>(EMPTY_PO_FORM);
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState<number | null>(null);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [showPurchaseOrderDetailDialog, setShowPurchaseOrderDetailDialog] = useState(false);
  const [showSupplierPaymentDialog, setShowSupplierPaymentDialog] = useState(false);
  const [showSupplierHistoryDialog, setShowSupplierHistoryDialog] = useState(false);
  const [selectedSupplierHistoryId, setSelectedSupplierHistoryId] = useState<number | null>(null);
  const [selectedSupplierPaymentTarget, setSelectedSupplierPaymentTarget] = useState<{ supplierId: number; purchaseOrderId?: number | null; supplierInvoiceId?: number | null } | null>(null);
  const [supplierPaymentForm, setSupplierPaymentForm] = useState<SupplierPaymentForm>(EMPTY_SUPPLIER_PAYMENT_FORM);
  const [showContractDialog, setShowContractDialog] = useState(false);
  const [contractForm, setContractForm] = useState<ContractForm>(EMPTY_CONTRACT_FORM);
  const [selectedContractId, setSelectedContractId] = useState<number | null>(null);
  const [showContractDetailDialog, setShowContractDetailDialog] = useState(false);
  const [showSupplierInvoiceDialog, setShowSupplierInvoiceDialog] = useState(false);
  const [supplierInvoiceForm, setSupplierInvoiceForm] = useState<SupplierInvoiceForm>(EMPTY_SUPPLIER_INVOICE_FORM);
  const [selectedSupplierInvoiceId, setSelectedSupplierInvoiceId] = useState<number | null>(null);
  const [showSupplierInvoiceDetailDialog, setShowSupplierInvoiceDetailDialog] = useState(false);
  const [selectedLotTraceId, setSelectedLotTraceId] = useState<number | null>(null);
  const [showLotTraceDialog, setShowLotTraceDialog] = useState(false);
  const { data: chequeLeavesData } = useChequeLeaves({
    accountId: supplierPaymentForm.financeAccountId ? Number(supplierPaymentForm.financeAccountId) : undefined,
    status: 'available',
  });
  const availableChequeLeaves = (chequeLeavesData?.data ?? []).filter((leaf) => leaf.status === 'available');

  const createSupplier = useCreateInventorySupplier();
  const updateSupplier = useUpdateInventorySupplier(editingSupplier?.id);
  const createItem = useCreateInventoryItem();
  const updateItem = useUpdateInventoryItem(editingInventoryItem?.id);
  const consumeItem = useConsumeInventoryItem(selectedInventoryItemId ?? undefined);
  const createPurchaseOrder = useCreateInventoryPurchaseOrder();
  const createContract = useCreateSupplierContract();
  const createSupplierInvoice = useCreateSupplierInvoice();
  const updatePurchaseOrderStatus = useUpdateInventoryPurchaseOrderStatus();
  const createSupplierPayment = useCreateSupplierPayment(selectedSupplierPaymentTarget?.supplierId);
  const inventoryDetailQuery = useInventoryItem(selectedInventoryItemId ?? undefined);

  const inventoryLookup = useMemo(
    () => new Map(inventoryItems.map((item) => [item.id, item])),
    [inventoryItems],
  );

  const resetSupplierForm = () => {
    setEditingSupplier(null);
    setSupplierForm(EMPTY_SUPPLIER_FORM);
    setShowSupplierDialog(false);
  };

  const resetInventoryForm = () => {
    setEditingInventoryItem(null);
    setInventoryForm(EMPTY_INVENTORY_FORM);
    setShowInventoryDialog(false);
  };

  const resetSupplierPaymentDialog = () => {
    setShowSupplierPaymentDialog(false);
    setSelectedSupplierPaymentTarget(null);
    setSupplierPaymentForm(EMPTY_SUPPLIER_PAYMENT_FORM);
  };

  const resetContractDialog = () => {
    setShowContractDialog(false);
    setContractForm(EMPTY_CONTRACT_FORM);
  };

  const resetSupplierInvoiceDialog = () => {
    setShowSupplierInvoiceDialog(false);
    setSupplierInvoiceForm(EMPTY_SUPPLIER_INVOICE_FORM);
  };



  const handleSubmitSupplier = async () => {
    try {
      const payload = {
        supplierName: supplierForm.supplierName,
        contactPerson: supplierForm.contactPerson || null,
        phoneNumber: supplierForm.phoneNumber || null,
        email: supplierForm.email || null,
        address: supplierForm.address || null,
        status: supplierForm.status,
        defaultCategoryId: supplierForm.defaultCategoryId ? Number(supplierForm.defaultCategoryId) : null,
      };
      if (editingSupplier) {
        await updateSupplier.mutateAsync(payload);
        toast.success('Supplier updated');
      } else {
        await createSupplier.mutateAsync(payload);
        toast.success('Supplier created');
      }
      resetSupplierForm();
    } catch (error) {
      parseApiError(error, 'Failed to save supplier');
    }
  };

  const handleSubmitInventoryItem = async () => {
    try {
      const payload = {
        itemTypeId: Number(inventoryForm.itemTypeId),
        itemCode: inventoryForm.itemCode || null,
        ingredientName: inventoryForm.ingredientName,
        description: inventoryForm.description || null,
        supplierId: Number(inventoryForm.supplierId),
        quantity: Number(inventoryForm.quantity),
        unit: inventoryForm.unit,
        costPerUnit: Number(inventoryForm.costPerUnit),
        reorderLevel: inventoryForm.reorderLevel ? Number(inventoryForm.reorderLevel) : null,
      };
      if (editingInventoryItem) {
        await updateItem.mutateAsync(payload);
        toast.success('Inventory item updated');
      } else {
        await createItem.mutateAsync(payload);
        toast.success('Inventory item created');
      }
      resetInventoryForm();
    } catch (error) {
      parseApiError(error, 'Failed to save inventory item');
    }
  };

  const handleSubmitConsumption = async () => {
    try {
      await consumeItem.mutateAsync({
        batchId: Number(consumeForm.batchId),
        quantity: Number(consumeForm.quantity),
        consumptionDate: consumeForm.consumptionDate,
        notes: consumeForm.notes || null,
      });
      toast.success('Inventory consumption recorded');
      setConsumeForm(EMPTY_CONSUME_FORM);
      setShowConsumeDialog(false);
    } catch (error) {
      parseApiError(error, 'Failed to consume inventory');
    }
  };

  const handleSubmitPurchaseOrder = async () => {
    try {
      const validItems = poForm.items.filter((item) => item.inventoryItemId && item.orderedQuantity && item.unitPrice);
      if (validItems.length === 0) {
        toast.error('Add at least one purchase order line');
        return;
      }
      await createPurchaseOrder.mutateAsync({
        supplierId: Number(poForm.supplierId),
        contractId: poForm.contractId ? Number(poForm.contractId) : null,
        ...(poForm.costCentreId ? { costCentreId: Number(poForm.costCentreId) } : {}),
        orderDate: poForm.orderDate,
        expectedDeliveryDate: poForm.expectedDeliveryDate || null,
        notes: poForm.notes || null,
        items: validItems.map((item) => ({
          inventoryItemId: Number(item.inventoryItemId),
          orderedQuantity: Number(item.orderedQuantity),
          unitPrice: Number(item.unitPrice),
          unit: item.unit,
        })),
      });
      toast.success('Purchase order created');
      setPoForm(EMPTY_PO_FORM);
      setShowPODialog(false);
    } catch (error) {
      parseApiError(error, 'Failed to create purchase order');
    }
  };

  const handleSubmitContract = async () => {
    try {
      await createContract.mutateAsync({
        supplierId: Number(contractForm.supplierId),
        contractType: contractForm.contractType,
        contractTitle: contractForm.contractTitle,
        description: contractForm.description || null,
        status: contractForm.status,
        validFrom: contractForm.validFrom,
        validTo: contractForm.validTo || null,
        currencyCode: contractForm.currencyCode,
        paymentTermsDays: Number(contractForm.paymentTermsDays || 0),
        commercialTerms: contractForm.commercialTerms || null,
        attachmentUrls: contractForm.attachmentUrls
          ? contractForm.attachmentUrls.split('\n').map((value) => value.trim()).filter(Boolean)
          : [],
        alertDaysBeforeExpiry: Number(contractForm.alertDaysBeforeExpiry || 30),
        terms: contractForm.terms
          .filter((term) => term.termKey.trim() && term.termValue.trim())
          .map((term, index) => ({
            termType: term.termType,
            termKey: term.termKey,
            termValue: term.termValue,
            sortOrder: Number(term.sortOrder || index),
          })),
      });
      toast.success('Supplier contract created');
      resetContractDialog();
    } catch (error) {
      parseApiError(error, 'Failed to create supplier contract');
    }
  };

  const handleSubmitSupplierInvoice = async () => {
    try {
      await createSupplierInvoice.mutateAsync({
        supplierId: Number(supplierInvoiceForm.supplierId),
        purchaseOrderId: supplierInvoiceForm.purchaseOrderId ? Number(supplierInvoiceForm.purchaseOrderId) : null,
        contractId: supplierInvoiceForm.contractId ? Number(supplierInvoiceForm.contractId) : null,
        invoiceReference: supplierInvoiceForm.invoiceReference,
        invoiceDate: supplierInvoiceForm.invoiceDate,
        dueDate: supplierInvoiceForm.dueDate,
        invoiceAmount: Number(supplierInvoiceForm.invoiceAmount),
        currencyCode: supplierInvoiceForm.currencyCode,
        status: supplierInvoiceForm.status,
        notes: supplierInvoiceForm.notes || null,
      });
      toast.success('Supplier invoice recorded');
      resetSupplierInvoiceDialog();
    } catch (error) {
      parseApiError(error, 'Failed to record supplier invoice');
    }
  };

  const handleSubmitSupplierPayment = async () => {
    if (!selectedSupplierPaymentTarget) return;

    try {
      await createSupplierPayment.mutateAsync({
        purchaseOrderId: selectedSupplierPaymentTarget.purchaseOrderId ?? null,
        supplierInvoiceId: selectedSupplierPaymentTarget.supplierInvoiceId ?? null,
        supplierInvoiceAllocations: selectedSupplierPaymentTarget.supplierInvoiceId
          ? [{
            supplierInvoiceId: selectedSupplierPaymentTarget.supplierInvoiceId,
            allocatedAmount: Number(supplierPaymentForm.amount),
          }]
          : null,
        paymentDate: supplierPaymentForm.paymentDate,
        financeAccountId: Number(supplierPaymentForm.financeAccountId),
        paymentMethod: supplierPaymentForm.paymentMethod,
        amount: Number(supplierPaymentForm.amount),
        referenceNumber: supplierPaymentForm.referenceNumber || undefined,
        chequeLeafId: supplierPaymentForm.paymentMethod === 'cheque' ? Number(supplierPaymentForm.chequeLeafId) : null,
        notes: supplierPaymentForm.notes || undefined,
        ...(selectedSupplierPaymentTarget.purchaseOrderId ? {} : financeTagsToPayload(supplierPaymentForm.tags)),
      });
      toast.success('Supplier payment recorded');
      resetSupplierPaymentDialog();
    } catch (error) {
      parseApiError(error, 'Failed to record supplier payment');
    }
  };


  const openEditSupplier = (supplier: InventorySupplier) => {
    setEditingSupplier(supplier);
    setSupplierForm({
      supplierName: supplier.supplierName,
      contactPerson: supplier.contactPerson ?? '',
      phoneNumber: supplier.phoneNumber ?? '',
      email: supplier.email ?? '',
      address: supplier.address ?? '',
      status: supplier.status,
      defaultCategoryId: supplier.defaultCategoryId ? String(supplier.defaultCategoryId) : '',
    });
    setShowSupplierDialog(true);
  };

  const openEditInventoryItem = (item: InventoryItem) => {
    setEditingInventoryItem(item);
    setInventoryForm({
      itemTypeId: String(item.itemTypeId),
      itemCode: item.itemCode ?? '',
      ingredientName: item.ingredientName,
      description: item.description ?? '',
      supplierId: String(item.supplierId ?? ''),
      quantity: String(item.quantity),
      unit: item.unit,
      costPerUnit: String(item.costPerUnit),
      reorderLevel: item.reorderLevel ? String(item.reorderLevel) : '',
    });
    setShowInventoryDialog(true);
  };

  const selectedInventoryItem = selectedInventoryItemId ? inventoryLookup.get(selectedInventoryItemId) : null;
  const inventoryDetail = inventoryDetailQuery.data?.data;
  const filteredPurchaseOrdersForInvoice = supplierInvoiceForm.supplierId
    ? purchaseOrders.filter((po) => po.supplierId === Number(supplierInvoiceForm.supplierId))
    : purchaseOrders;
  const filteredContractsForInvoice = supplierInvoiceForm.supplierId
    ? contracts.filter((contract) => contract.supplierId === Number(supplierInvoiceForm.supplierId))
    : contracts;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Stock & purchasing</h1>
        <p className="text-sm text-muted-foreground">
          Manage suppliers, purchase orders, and all inventory. Feed items remain available here and in Feed inventory.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(tab) => setParams({ tab }, { replace: true })} className="space-y-4">
        <TabsList className="max-w-full justify-start overflow-x-auto scrollbar-none">
          <TabsTrigger value="inventory" className="gap-2"><Package className="h-4 w-4" />Inventory</TabsTrigger>
          <TabsTrigger value="stores" className="gap-2"><Warehouse className="h-4 w-4" />Stores</TabsTrigger>
          <TabsTrigger value="requisitions" className="gap-2"><ClipboardList className="h-4 w-4" />Requests</TabsTrigger>
          <TabsTrigger value="purchase-orders" className="gap-2"><ShoppingCart className="h-4 w-4" />Purchase Orders</TabsTrigger>
          <TabsTrigger value="contracts" className="gap-2"><FileText className="h-4 w-4" />Contracts</TabsTrigger>
          <TabsTrigger value="supplier-invoices" className="gap-2"><Receipt className="h-4 w-4" />Invoices</TabsTrigger>
          <TabsTrigger value="traceability" className="gap-2"><ScanSearch className="h-4 w-4" />Traceability</TabsTrigger>
          <TabsTrigger value="suppliers" className="gap-2"><Truck className="h-4 w-4" />Suppliers</TabsTrigger>
        </TabsList>

        <TabsContent value="stores">
          <StoresTab canMove={hasPermission('inventory:update')} canWriteOff={hasPermission('inventory:create')} />
        </TabsContent>

        <TabsContent value="requisitions">
          <RequisitionsTab canRequest={hasPermission('inventory:read')} canApprove={hasPermission('inventory:create')} />
        </TabsContent>

        <TabsContent value="inventory">
          <Card>
            <CardContent className="pt-6">
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <Input
                  placeholder="Search inventory..."
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  className="max-w-md"
                />
                {hasPermission('feed_inventory:create') ? (
                  <Button onClick={() => setShowInventoryDialog(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Item
                  </Button>
                ) : null}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Cost/Unit</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead className="w-[180px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventoryItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                        No inventory items found.
                      </TableCell>
                    </TableRow>
                  ) : inventoryItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.ingredientName}</p>
                          <p className="text-xs text-muted-foreground">{item.itemCode || 'No item code'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span>{item.typeName}</span>
                          {item.isFeed ? <Badge variant="secondary">Feed</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell>{item.supplierName || '--'}</TableCell>
                      <TableCell>{Number(item.quantity).toLocaleString()} {item.unit}</TableCell>
                      <TableCell>Rs. {Number(item.costPerUnit).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={item.lowStock ? 'destructive' : 'outline'}>
                          {item.lowStock ? 'Low' : 'OK'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              setSelectedInventoryItemId(item.id);
                              setShowInventoryDetail(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {hasPermission('feed_inventory:update') ? (
                            <Button variant="outline" size="icon" onClick={() => openEditInventoryItem(item)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="purchase-orders">
          <Card>
            <CardContent className="pt-6">
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <Input
                  placeholder="Search purchase orders..."
                  value={poSearch}
                  onChange={(e) => setPoSearch(e.target.value)}
                  className="max-w-md"
                />
                {hasPermission('feed_inventory:create') ? (
                  <Button onClick={() => setShowPODialog(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create PO
                  </Button>
                ) : null}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Order Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                        No purchase orders found.
                      </TableCell>
                    </TableRow>
                  ) : purchaseOrders.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell className="font-medium">{po.orderCode}</TableCell>
                      <TableCell>{po.supplierName}</TableCell>
                      <TableCell>{new Date(po.orderDate).toLocaleDateString()}</TableCell>
                      <TableCell><Badge variant={po.status === 'pending_approval' ? 'warning' : 'outline'} className="capitalize">{po.status.replace(/_/g, ' ')}</Badge></TableCell>
                      <TableCell>Rs. {Number(po.totalCost).toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {po.status === 'draft' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                try {
                                  await updatePurchaseOrderStatus.mutateAsync({ id: po.id, status: 'submitted' });
                                  toast.success('Purchase order submitted');
                                } catch (error) {
                                  parseApiError(error, 'Failed to submit purchase order');
                                }
                              }}
                            >
                              Submit
                            </Button>
                          ) : null}
                          {['submitted', 'partially_received'].includes(po.status) ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedPurchaseOrderId(po.id);
                                setShowReceiveDialog(true);
                              }}
                            >
                              Receive
                            </Button>
                          ) : null}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedPurchaseOrderId(po.id);
                              setShowPurchaseOrderDetailDialog(true);
                            }}
                          >
                            View
                          </Button>
                          {hasPermission('feed_inventory:update') ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedSupplierPaymentTarget({ supplierId: po.supplierId, purchaseOrderId: po.id });
                                setSupplierPaymentForm((prev) => ({
                                  ...prev,
                                  amount: Number(po.totalCost).toFixed(2),
                                }));
                                setShowSupplierPaymentDialog(true);
                              }}
                            >
                              Pay
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers">
          <Card>
            <CardContent className="pt-6">
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-medium">Suppliers</h2>
                  <p className="text-sm text-muted-foreground">Shared supplier master data for all inventory sourcing.</p>
                </div>
                {hasPermission('feed_inventory:create') ? (
                  <Button onClick={() => setShowSupplierDialog(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Supplier
                  </Button>
                ) : null}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                        No suppliers found.
                      </TableCell>
                    </TableRow>
                  ) : suppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium">{supplier.supplierName}</TableCell>
                      <TableCell>{supplier.contactPerson || supplier.phoneNumber || '--'}</TableCell>
                      <TableCell>{supplier.email || '--'}</TableCell>
                      <TableCell><Badge variant="outline">{supplier.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedSupplierHistoryId(supplier.id);
                              setShowSupplierHistoryDialog(true);
                            }}
                          >
                            Payments
                          </Button>
                          {hasPermission('feed_inventory:update') ? (
                            <Button variant="outline" size="icon" onClick={() => openEditSupplier(supplier)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts">
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-medium">Supplier Contracts</h2>
                  <p className="text-sm text-muted-foreground">Commercial terms, validity dates, and procurement linkage for supplier obligations.</p>
                </div>
                <div className="flex gap-3">
                  <Select value={selectedSupplierIdFilter} onValueChange={setSelectedSupplierIdFilter}>
                    <SelectTrigger className="w-[220px]"><SelectValue placeholder="Filter by supplier" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All suppliers</SelectItem>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={String(supplier.id)}>{supplier.supplierName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasPermission('inventory:create') ? (
                    <Button onClick={() => setShowContractDialog(true)} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add Contract
                    </Button>
                  ) : null}
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contract</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Validity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Linked POs</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">No supplier contracts found.</TableCell>
                    </TableRow>
                  ) : contracts.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{contract.contractCode}</p>
                          <p className="text-xs text-muted-foreground">{contract.contractTitle}</p>
                        </div>
                      </TableCell>
                      <TableCell>{contract.supplierName}</TableCell>
                      <TableCell>{contract.contractType}</TableCell>
                      <TableCell>
                        {new Date(contract.validFrom).toLocaleDateString()}
                        {contract.validTo ? ` to ${new Date(contract.validTo).toLocaleDateString()}` : ''}
                      </TableCell>
                      <TableCell><Badge variant="outline">{contract.status}</Badge></TableCell>
                      <TableCell className="text-right">{contract.linkedPurchaseOrderCount ?? 0}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => {
                          setSelectedContractId(contract.id);
                          setShowContractDetailDialog(true);
                        }}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="supplier-invoices">
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-medium">Supplier Invoices</h2>
                    <p className="text-sm text-muted-foreground">Operational invoice capture with payable balance and treasury-backed settlement history.</p>
                  </div>
                  {hasPermission('inventory:create') ? (
                    <Button onClick={() => setShowSupplierInvoiceDialog(true)} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Record Invoice
                    </Button>
                  ) : null}
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>PO</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Match</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Balance Due</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplierInvoices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="h-24 text-center text-sm text-muted-foreground">No supplier invoices found.</TableCell>
                      </TableRow>
                    ) : supplierInvoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{invoice.invoiceCode}</p>
                            <p className="text-xs text-muted-foreground">{invoice.invoiceReference}</p>
                          </div>
                        </TableCell>
                        <TableCell>{invoice.supplierName}</TableCell>
                        <TableCell>{invoice.purchaseOrderCode || '--'}</TableCell>
                        <TableCell>{new Date(invoice.dueDate).toLocaleDateString()}</TableCell>
                        <TableCell><Badge variant="outline">{invoice.status}</Badge></TableCell>
                        <TableCell><InvoiceMatchBadge invoice={invoice} /></TableCell>
                        <TableCell className="text-right">Rs. {Number(invoice.invoiceAmount).toFixed(2)}</TableCell>
                        <TableCell className="text-right">Rs. {Number(invoice.balanceDue ?? 0).toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => {
                              setSelectedSupplierInvoiceId(invoice.id);
                              setShowSupplierInvoiceDetailDialog(true);
                            }}>
                              View
                            </Button>
                            {hasPermission('inventory:update') && Number(invoice.balanceDue ?? 0) > 0 ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedSupplierPaymentTarget({
                                    supplierId: invoice.supplierId,
                                    purchaseOrderId: invoice.purchaseOrderId ?? null,
                                    supplierInvoiceId: invoice.id,
                                  });
                                  setSupplierPaymentForm((prev) => ({
                                    ...prev,
                                    amount: Number(invoice.balanceDue ?? 0).toFixed(2),
                                  }));
                                  setShowSupplierPaymentDialog(true);
                                }}
                              >
                                Pay
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="mb-4">
                  <h3 className="text-lg font-medium">Payables Summary</h3>
                  <p className="text-sm text-muted-foreground">Ordered, received, invoiced, paid, and balance due by invoice.</p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>PO</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead className="text-right">Ordered</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead className="text-right">Invoiced</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payablesSummary.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="h-24 text-center text-sm text-muted-foreground">No payables summary rows available.</TableCell>
                      </TableRow>
                    ) : payablesSummary.map((row) => (
                      <TableRow key={row.invoiceId}>
                        <TableCell>{row.supplierName}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{row.invoiceCode}</p>
                            <p className="text-xs text-muted-foreground">{row.invoiceReference}</p>
                          </div>
                        </TableCell>
                        <TableCell>{row.purchaseOrderCode || '--'}</TableCell>
                        <TableCell>{new Date(row.dueDate).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">Rs. {Number(row.orderedAmount).toFixed(2)}</TableCell>
                        <TableCell className="text-right">Rs. {Number(row.receivedAmount).toFixed(2)}</TableCell>
                        <TableCell className="text-right">Rs. {Number(row.invoicedAmount).toFixed(2)}</TableCell>
                        <TableCell className="text-right">Rs. {Number(row.paidAmount).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-medium">Rs. {Number(row.balanceDue).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="traceability">
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="mb-4">
                  <h2 className="text-lg font-medium">Inventory Movement Ledger</h2>
                  <p className="text-sm text-muted-foreground">Immutable stock movements across receipt, production, and batch allocation workflows.</p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Lot</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Line Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventoryMovements.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="h-24 text-center text-sm text-muted-foreground">No inventory movements recorded.</TableCell></TableRow>
                    ) : inventoryMovements.slice(0, 30).map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell>{new Date(movement.movementDate).toLocaleDateString()}</TableCell>
                        <TableCell>{movement.movementType}</TableCell>
                        <TableCell>{movement.ingredientName || '--'}</TableCell>
                        <TableCell>{movement.lotCode || '--'}</TableCell>
                        <TableCell>{movement.batchCode || '--'}</TableCell>
                        <TableCell>{movement.sourceCodeSnapshot || `${movement.sourceEntityType} #${movement.sourceEntityId}`}</TableCell>
                        <TableCell className="text-right">{Number(movement.quantity).toLocaleString()} {movement.unit}</TableCell>
                        <TableCell className="text-right">{movement.lineCost ? `Rs. ${Number(movement.lineCost).toFixed(2)}` : '--'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="mb-4">
                  <h3 className="text-lg font-medium">Batch Allocations</h3>
                  <p className="text-sm text-muted-foreground">Direct lot-level allocations posted from inventory into farm batches.</p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Lot</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batchAllocations.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">No direct batch allocations recorded.</TableCell></TableRow>
                    ) : batchAllocations.map((allocation) => (
                      <TableRow key={allocation.id}>
                        <TableCell>{new Date(allocation.movementDate).toLocaleDateString()}</TableCell>
                        <TableCell>{allocation.batchCode || '--'}</TableCell>
                        <TableCell>{allocation.ingredientName || '--'}</TableCell>
                        <TableCell>{allocation.lotCode || '--'}</TableCell>
                        <TableCell>{allocation.sourceCodeSnapshot || allocation.sourceEntityType}</TableCell>
                        <TableCell className="text-right">{Number(allocation.quantity).toLocaleString()} {allocation.unit}</TableCell>
                        <TableCell className="text-right">{allocation.lineCost ? `Rs. ${Number(allocation.lineCost).toFixed(2)}` : '--'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

      </Tabs>

      <Dialog open={showSupplierDialog} onOpenChange={(open) => (!open ? resetSupplierForm() : setShowSupplierDialog(true))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSupplier ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
            <DialogDescription>Supplier master data is shared across inventory and purchasing.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>Supplier Name</Label><Input value={supplierForm.supplierName} onChange={(e) => setSupplierForm((prev) => ({ ...prev, supplierName: e.target.value }))} /></div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2"><Label>Contact Person</Label><Input value={supplierForm.contactPerson} onChange={(e) => setSupplierForm((prev) => ({ ...prev, contactPerson: e.target.value }))} /></div>
              <div className="grid gap-2"><Label>Phone</Label><Input value={supplierForm.phoneNumber} onChange={(e) => setSupplierForm((prev) => ({ ...prev, phoneNumber: e.target.value }))} /></div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2"><Label>Email</Label><Input value={supplierForm.email} onChange={(e) => setSupplierForm((prev) => ({ ...prev, email: e.target.value }))} /></div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={supplierForm.status} onValueChange={(value) => setSupplierForm((prev) => ({ ...prev, status: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Default finance category</Label>
              <CategorySelect value={supplierForm.defaultCategoryId} onChange={(value) => setSupplierForm((prev) => ({ ...prev, defaultCategoryId: value }))} />
              <p className="text-xs text-muted-foreground">Used for payments that aren't linked to a purchase order (for example, a hatchery's chick invoices).</p>
            </div>
            <div className="grid gap-2"><Label>Address</Label><Textarea value={supplierForm.address} onChange={(e) => setSupplierForm((prev) => ({ ...prev, address: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetSupplierForm}>Cancel</Button>
            <Button onClick={handleSubmitSupplier}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showInventoryDialog} onOpenChange={(open) => (!open ? resetInventoryForm() : setShowInventoryDialog(true))}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingInventoryItem ? 'Edit Inventory Item' : 'Add Inventory Item'}</DialogTitle>
            <DialogDescription>Create or update stock available across inventory management and batch costing.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Item Type</Label>
                <Select value={inventoryForm.itemTypeId} onValueChange={(value) => {
                  const selectedType = itemTypes.find((type) => type.id === Number(value));
                  setInventoryForm((prev) => ({
                    ...prev,
                    itemTypeId: value,
                    unit: selectedType?.defaultUnit || prev.unit,
                  }));
                }}>
                  <SelectTrigger><SelectValue placeholder="Select item type" /></SelectTrigger>
                  <SelectContent>
                    {itemTypes.filter((type) => type.status === 'active').map((type) => (
                      <SelectItem key={type.id} value={String(type.id)}>{type.typeName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>Item Code</Label><Input value={inventoryForm.itemCode} onChange={(e) => setInventoryForm((prev) => ({ ...prev, itemCode: e.target.value }))} /></div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2"><Label>Item Name</Label><Input value={inventoryForm.ingredientName} onChange={(e) => setInventoryForm((prev) => ({ ...prev, ingredientName: e.target.value }))} /></div>
              <div className="grid gap-2">
                <Label>Supplier</Label>
                <Select value={inventoryForm.supplierId} onValueChange={(value) => setInventoryForm((prev) => ({ ...prev, supplierId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.filter((supplier) => supplier.status === 'active').map((supplier) => (
                      <SelectItem key={supplier.id} value={String(supplier.id)}>{supplier.supplierName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2"><Label>Description</Label><Textarea value={inventoryForm.description} onChange={(e) => setInventoryForm((prev) => ({ ...prev, description: e.target.value }))} /></div>
            <div className="grid gap-2 md:grid-cols-4">
              <div className="grid gap-2"><Label>Quantity</Label><Input type="number" min="0" step="0.01" value={inventoryForm.quantity} onChange={(e) => setInventoryForm((prev) => ({ ...prev, quantity: e.target.value }))} /></div>
              <div className="grid gap-2"><Label>Unit</Label><Input value={inventoryForm.unit} onChange={(e) => setInventoryForm((prev) => ({ ...prev, unit: e.target.value }))} /></div>
              <div className="grid gap-2"><Label>Cost/Unit</Label><Input type="number" min="0" step="0.01" value={inventoryForm.costPerUnit} onChange={(e) => setInventoryForm((prev) => ({ ...prev, costPerUnit: e.target.value }))} /></div>
              <div className="grid gap-2"><Label>Reorder Level</Label><Input type="number" min="0" step="0.01" value={inventoryForm.reorderLevel} onChange={(e) => setInventoryForm((prev) => ({ ...prev, reorderLevel: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetInventoryForm}>Cancel</Button>
            <Button onClick={handleSubmitInventoryItem}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showInventoryDetail} onOpenChange={(open) => {
        setShowInventoryDetail(open);
        if (!open) setSelectedInventoryItemId(null);
      }}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedInventoryItem?.ingredientName || 'Inventory Detail'}</DialogTitle>
            <DialogDescription>Lot availability, batch consumption history, and manual consumption into batches.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {inventoryDetail ? (
              <>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card><CardContent className="pt-6"><p className="text-sm font-medium text-muted-foreground">On Hand</p><p className="text-2xl font-bold text-foreground">{Number(inventoryDetail.item.quantity).toLocaleString()} {inventoryDetail.item.unit}</p></CardContent></Card>
                  <Card><CardContent className="pt-6"><p className="text-sm font-medium text-muted-foreground">Lots</p><p className="text-2xl font-bold text-foreground">{inventoryDetail.lots.length}</p></CardContent></Card>
                  <Card><CardContent className="pt-6"><p className="text-sm font-medium text-muted-foreground">Consumed</p><p className="text-2xl font-bold text-foreground">{inventoryDetail.summary.totalConsumed.toLocaleString()} {inventoryDetail.item.unit}</p></CardContent></Card>
                  <Card><CardContent className="pt-6"><p className="text-sm font-medium text-muted-foreground">Consumed Cost</p><p className="text-2xl font-bold text-foreground">Rs. {inventoryDetail.summary.totalConsumedCost.toFixed(2)}</p></CardContent></Card>
                </div>

                {!inventoryDetail.item.isFeed && inventoryDetail.item.allowsBatchAllocation && hasPermission('feed_inventory:update') ? (
                  <div className="flex justify-end">
                    <Button className="gap-2" onClick={() => setShowConsumeDialog(true)}>
                      <Factory className="h-4 w-4" />
                      Consume to Batch
                    </Button>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <h3 className="font-medium">Available Lots</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lot</TableHead>
                        <TableHead>Received</TableHead>
                        <TableHead>Remaining</TableHead>
                        <TableHead>Cost/Unit</TableHead>
                        <TableHead>PO</TableHead>
                        <TableHead className="text-right">Trace</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventoryDetail.lots.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-20 text-center text-sm text-muted-foreground">
                            No lots available for this item.
                          </TableCell>
                        </TableRow>
                      ) : inventoryDetail.lots.map((lot) => (
                        <TableRow key={lot.id}>
                          <TableCell>{lot.lotCode}</TableCell>
                          <TableCell>{Number(lot.receivedQuantity).toLocaleString()} {inventoryDetail.item.unit}</TableCell>
                          <TableCell>{Number(lot.remainingQuantity).toLocaleString()} {inventoryDetail.item.unit}</TableCell>
                          <TableCell>Rs. {Number(lot.costPerUnit).toFixed(2)}</TableCell>
                          <TableCell>{lot.poOrderCode || '--'}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" onClick={() => {
                              setSelectedLotTraceId(lot.id);
                              setShowLotTraceDialog(true);
                            }}>
                              Trace
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium">Batch Consumption</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Batch</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Unit Cost</TableHead>
                        <TableHead>Line Cost</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventoryDetail.consumptions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-20 text-center text-sm text-muted-foreground">
                            No batch consumption has been recorded for this item.
                          </TableCell>
                        </TableRow>
                      ) : inventoryDetail.consumptions.map((consumption) => (
                        <TableRow key={consumption.id}>
                          <TableCell>{consumption.batchCode}</TableCell>
                          <TableCell>{new Date(consumption.consumptionDate).toLocaleDateString()}</TableCell>
                          <TableCell>{Number(consumption.quantity).toLocaleString()} {consumption.unit}</TableCell>
                          <TableCell>Rs. {Number(consumption.unitCost).toFixed(2)}</TableCell>
                          <TableCell>Rs. {Number(consumption.lineCost).toFixed(2)}</TableCell>
                          <TableCell>{consumption.notes || '--'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Loading inventory detail...</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSupplierHistoryDialog} onOpenChange={(open) => {
        setShowSupplierHistoryDialog(open);
        if (!open) setSelectedSupplierHistoryId(null);
      }}>
        <DialogContent className="sm:max-w-5xl">
          {selectedSupplierHistoryId ? <SupplierPaymentHistoryDialogContent supplierId={selectedSupplierHistoryId} /> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={showConsumeDialog} onOpenChange={setShowConsumeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Consume Inventory to Batch</DialogTitle>
            <DialogDescription>Record non-feed inventory usage directly against a farm batch.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Batch</Label>
              <Select value={consumeForm.batchId} onValueChange={(value) => setConsumeForm((prev) => ({ ...prev, batchId: value }))}>
                <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                <SelectContent>
                  {batches.map((batch) => (
                    <SelectItem key={batch.id} value={String(batch.id)}>{batch.batchCode}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2"><Label>Quantity</Label><Input type="number" min="0" step="0.01" value={consumeForm.quantity} onChange={(e) => setConsumeForm((prev) => ({ ...prev, quantity: e.target.value }))} /></div>
              <div className="grid gap-2"><Label>Date</Label><Input type="date" value={consumeForm.consumptionDate} onChange={(e) => setConsumeForm((prev) => ({ ...prev, consumptionDate: e.target.value }))} /></div>
            </div>
            <div className="grid gap-2"><Label>Notes</Label><Textarea value={consumeForm.notes} onChange={(e) => setConsumeForm((prev) => ({ ...prev, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConsumeDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmitConsumption}>Record Consumption</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPODialog} onOpenChange={setShowPODialog}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create Purchase Order</DialogTitle>
            <DialogDescription>Create a supplier order against the shared inventory catalog.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2 md:grid-cols-4">
              <div className="grid gap-2">
                <Label>Supplier</Label>
                <Select value={poForm.supplierId} onValueChange={(value) => setPoForm((prev) => ({ ...prev, supplierId: value, contractId: '' }))}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.filter((supplier) => supplier.status === 'active').map((supplier) => (
                      <SelectItem key={supplier.id} value={String(supplier.id)}>{supplier.supplierName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Contract</Label>
                <Select value={poForm.contractId || '__none'} onValueChange={(value) => setPoForm((prev) => ({ ...prev, contractId: value === '__none' ? '' : value }))}>
                  <SelectTrigger><SelectValue placeholder="Optional contract" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">No contract</SelectItem>
                    {contracts
                      .filter((contract) => !poForm.supplierId || contract.supplierId === Number(poForm.supplierId))
                      .map((contract) => (
                        <SelectItem key={contract.id} value={String(contract.id)}>{contract.contractCode}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>Order Date</Label><Input type="date" value={poForm.orderDate} onChange={(e) => setPoForm((prev) => ({ ...prev, orderDate: e.target.value }))} /></div>
              <div className="grid gap-2"><Label>Expected Delivery</Label><Input type="date" value={poForm.expectedDeliveryDate} onChange={(e) => setPoForm((prev) => ({ ...prev, expectedDeliveryDate: e.target.value }))} /></div>
            </div>
            <div className="grid gap-2">
              <Label>Charge to cost centre</Label>
              <CostCentreSelect value={poForm.costCentreId} onChange={(value) => setPoForm((prev) => ({ ...prev, costCentreId: value }))} noneLabel="Automatic (feed items → Feed Mill, else Admin)" />
            </div>
            <div className="grid gap-2"><Label>Notes</Label><Textarea value={poForm.notes} onChange={(e) => setPoForm((prev) => ({ ...prev, notes: e.target.value }))} /></div>

            <div className="space-y-3">
              {poForm.items.map((item, index) => (
                <div key={index} className="grid gap-2 rounded-md border p-3 md:grid-cols-4">
                  <div className="grid gap-2">
                    <Label>Inventory Item</Label>
                    <Select value={item.inventoryItemId} onValueChange={(value) => setPoForm((prev) => {
                      const nextItems = [...prev.items];
                      const selected = inventoryItems.find((inventoryItem) => inventoryItem.id === Number(value));
                      nextItems[index] = {
                        ...nextItems[index],
                        inventoryItemId: value,
                        unit: selected?.unit || nextItems[index].unit,
                      };
                      return { ...prev, items: nextItems };
                    })}>
                      <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                      <SelectContent>
                        {inventoryItems.map((inventoryItem) => (
                          <SelectItem key={inventoryItem.id} value={String(inventoryItem.id)}>
                            {inventoryItem.ingredientName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2"><Label>Qty</Label><Input type="number" min="0" step="0.01" value={item.orderedQuantity} onChange={(e) => setPoForm((prev) => {
                    const nextItems = [...prev.items];
                    nextItems[index] = { ...nextItems[index], orderedQuantity: e.target.value };
                    return { ...prev, items: nextItems };
                  })} /></div>
                  <div className="grid gap-2"><Label>Unit Price</Label><Input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => setPoForm((prev) => {
                    const nextItems = [...prev.items];
                    nextItems[index] = { ...nextItems[index], unitPrice: e.target.value };
                    return { ...prev, items: nextItems };
                  })} /></div>
                  <div className="grid gap-2"><Label>Unit</Label><Input value={item.unit} onChange={(e) => setPoForm((prev) => {
                    const nextItems = [...prev.items];
                    nextItems[index] = { ...nextItems[index], unit: e.target.value };
                    return { ...prev, items: nextItems };
                  })} /></div>
                </div>
              ))}
              <Button variant="outline" onClick={() => setPoForm((prev) => ({
                ...prev,
                items: [...prev.items, { inventoryItemId: '', orderedQuantity: '', unitPrice: '', unit: 'unit' }],
              }))}>
                Add Line
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPODialog(false)}>Cancel</Button>
            <Button onClick={handleSubmitPurchaseOrder}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReceiveDialog} onOpenChange={(open) => {
        setShowReceiveDialog(open);
        if (!open) setSelectedPurchaseOrderId(null);
      }}>
        <DialogContent className="sm:max-w-4xl">
          {selectedPurchaseOrderId ? (
            <ReceivePODialogContent
              poId={selectedPurchaseOrderId}
              batches={batches}
              onClose={() => {
                setShowReceiveDialog(false);
                setSelectedPurchaseOrderId(null);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={showPurchaseOrderDetailDialog} onOpenChange={(open) => {
        setShowPurchaseOrderDetailDialog(open);
        if (!open) setSelectedPurchaseOrderId(null);
      }}>
        <DialogContent className="sm:max-w-5xl">
          {selectedPurchaseOrderId ? (
            <PurchaseOrderDetailDialogContent poId={selectedPurchaseOrderId} />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={showContractDialog} onOpenChange={(open) => {
        if (!open) resetContractDialog();
      }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create Supplier Contract</DialogTitle>
            <DialogDescription>Capture commercial terms before purchase orders and invoices are linked to them.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Supplier</Label>
                <Select value={contractForm.supplierId} onValueChange={(value) => setContractForm((prev) => ({ ...prev, supplierId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.filter((supplier) => supplier.status === 'active').map((supplier) => (
                      <SelectItem key={supplier.id} value={String(supplier.id)}>{supplier.supplierName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Contract Type</Label>
                <Select value={contractForm.contractType} onValueChange={(value) => setContractForm((prev) => ({ ...prev, contractType: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supplier">Supplier</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2"><Label>Title</Label><Input value={contractForm.contractTitle} onChange={(e) => setContractForm((prev) => ({ ...prev, contractTitle: e.target.value }))} /></div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={contractForm.status} onValueChange={(value) => setContractForm((prev) => ({ ...prev, status: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              <div className="grid gap-2"><Label>Valid From</Label><Input type="date" value={contractForm.validFrom} onChange={(e) => setContractForm((prev) => ({ ...prev, validFrom: e.target.value }))} /></div>
              <div className="grid gap-2"><Label>Valid To</Label><Input type="date" value={contractForm.validTo} onChange={(e) => setContractForm((prev) => ({ ...prev, validTo: e.target.value }))} /></div>
              <div className="grid gap-2"><Label>Currency</Label><Input value={contractForm.currencyCode} onChange={(e) => setContractForm((prev) => ({ ...prev, currencyCode: e.target.value }))} /></div>
              <div className="grid gap-2"><Label>Payment Terms Days</Label><Input type="number" min="0" value={contractForm.paymentTermsDays} onChange={(e) => setContractForm((prev) => ({ ...prev, paymentTermsDays: e.target.value }))} /></div>
            </div>
            <div className="grid gap-2"><Label>Description</Label><Textarea value={contractForm.description} onChange={(e) => setContractForm((prev) => ({ ...prev, description: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Commercial Terms</Label><Textarea value={contractForm.commercialTerms} onChange={(e) => setContractForm((prev) => ({ ...prev, commercialTerms: e.target.value }))} /></div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2"><Label>Attachment URLs (one per line)</Label><Textarea value={contractForm.attachmentUrls} onChange={(e) => setContractForm((prev) => ({ ...prev, attachmentUrls: e.target.value }))} /></div>
              <div className="grid gap-2"><Label>Expiry Alert Days</Label><Input type="number" min="0" value={contractForm.alertDaysBeforeExpiry} onChange={(e) => setContractForm((prev) => ({ ...prev, alertDaysBeforeExpiry: e.target.value }))} /></div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Contract Terms</Label>
                <Button variant="outline" size="sm" onClick={() => setContractForm((prev) => ({
                  ...prev,
                  terms: [...prev.terms, { termType: 'commercial', termKey: '', termValue: '', sortOrder: String(prev.terms.length) }],
                }))}>
                  Add Term
                </Button>
              </div>
              {contractForm.terms.map((term, index) => (
                <div key={index} className="grid gap-2 rounded-md border p-3 md:grid-cols-4">
                  <Input value={term.termType} onChange={(e) => setContractForm((prev) => {
                    const terms = [...prev.terms];
                    terms[index] = { ...terms[index], termType: e.target.value };
                    return { ...prev, terms };
                  })} placeholder="Type" />
                  <Input value={term.termKey} onChange={(e) => setContractForm((prev) => {
                    const terms = [...prev.terms];
                    terms[index] = { ...terms[index], termKey: e.target.value };
                    return { ...prev, terms };
                  })} placeholder="Key" />
                  <Input value={term.termValue} onChange={(e) => setContractForm((prev) => {
                    const terms = [...prev.terms];
                    terms[index] = { ...terms[index], termValue: e.target.value };
                    return { ...prev, terms };
                  })} placeholder="Value" />
                  <Input type="number" min="0" value={term.sortOrder} onChange={(e) => setContractForm((prev) => {
                    const terms = [...prev.terms];
                    terms[index] = { ...terms[index], sortOrder: e.target.value };
                    return { ...prev, terms };
                  })} placeholder="Sort" />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetContractDialog}>Cancel</Button>
            <Button onClick={handleSubmitContract} disabled={createContract.isPending}>
              {createContract.isPending ? 'Saving...' : 'Create Contract'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSupplierInvoiceDialog} onOpenChange={(open) => {
        if (!open) resetSupplierInvoiceDialog();
      }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Record Supplier Invoice</DialogTitle>
            <DialogDescription>Capture the supplier claim separately from treasury payment settlement.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2 md:grid-cols-3">
              <div className="grid gap-2">
                <Label>Supplier</Label>
                <Select value={supplierInvoiceForm.supplierId} onValueChange={(value) => setSupplierInvoiceForm((prev) => ({ ...prev, supplierId: value, purchaseOrderId: '', contractId: '' }))}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.filter((supplier) => supplier.status === 'active').map((supplier) => (
                      <SelectItem key={supplier.id} value={String(supplier.id)}>{supplier.supplierName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Purchase Order</Label>
                <Select value={supplierInvoiceForm.purchaseOrderId || '__none'} onValueChange={(value) => setSupplierInvoiceForm((prev) => ({ ...prev, purchaseOrderId: value === '__none' ? '' : value }))}>
                  <SelectTrigger><SelectValue placeholder="Optional PO" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">No purchase order</SelectItem>
                    {filteredPurchaseOrdersForInvoice.map((po) => (
                      <SelectItem key={po.id} value={String(po.id)}>{po.orderCode}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Contract</Label>
                <Select value={supplierInvoiceForm.contractId || '__none'} onValueChange={(value) => setSupplierInvoiceForm((prev) => ({ ...prev, contractId: value === '__none' ? '' : value }))}>
                  <SelectTrigger><SelectValue placeholder="Optional contract" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">No contract</SelectItem>
                    {filteredContractsForInvoice.map((contract) => (
                      <SelectItem key={contract.id} value={String(contract.id)}>{contract.contractCode}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              <div className="grid gap-2"><Label>Invoice Reference</Label><Input value={supplierInvoiceForm.invoiceReference} onChange={(e) => setSupplierInvoiceForm((prev) => ({ ...prev, invoiceReference: e.target.value }))} /></div>
              <div className="grid gap-2"><Label>Invoice Date</Label><Input type="date" value={supplierInvoiceForm.invoiceDate} onChange={(e) => setSupplierInvoiceForm((prev) => ({ ...prev, invoiceDate: e.target.value }))} /></div>
              <div className="grid gap-2"><Label>Due Date</Label><Input type="date" value={supplierInvoiceForm.dueDate} onChange={(e) => setSupplierInvoiceForm((prev) => ({ ...prev, dueDate: e.target.value }))} /></div>
              <div className="grid gap-2"><Label>Amount</Label><Input type="number" min="0" step="0.01" value={supplierInvoiceForm.invoiceAmount} onChange={(e) => setSupplierInvoiceForm((prev) => ({ ...prev, invoiceAmount: e.target.value }))} /></div>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <div className="grid gap-2"><Label>Currency</Label><Input value={supplierInvoiceForm.currencyCode} onChange={(e) => setSupplierInvoiceForm((prev) => ({ ...prev, currencyCode: e.target.value }))} /></div>
              <p className="self-end text-sm text-muted-foreground md:col-span-2">New invoices are recorded first, then approved or rejected from Farm control.</p>
            </div>
            <div className="grid gap-2"><Label>Notes</Label><Textarea value={supplierInvoiceForm.notes} onChange={(e) => setSupplierInvoiceForm((prev) => ({ ...prev, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetSupplierInvoiceDialog}>Cancel</Button>
            <Button onClick={handleSubmitSupplierInvoice} disabled={createSupplierInvoice.isPending}>
              {createSupplierInvoice.isPending ? 'Saving...' : 'Record Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showContractDetailDialog} onOpenChange={(open) => {
        setShowContractDetailDialog(open);
        if (!open) setSelectedContractId(null);
      }}>
        <DialogContent className="sm:max-w-5xl">
          {selectedContractId ? <SupplierContractDetailDialogContent contractId={selectedContractId} /> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={showSupplierInvoiceDetailDialog} onOpenChange={(open) => {
        setShowSupplierInvoiceDetailDialog(open);
        if (!open) setSelectedSupplierInvoiceId(null);
      }}>
        <DialogContent className="sm:max-w-5xl">
          {selectedSupplierInvoiceId ? <SupplierInvoiceDetailDialogContent invoiceId={selectedSupplierInvoiceId} /> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={showLotTraceDialog} onOpenChange={(open) => {
        setShowLotTraceDialog(open);
        if (!open) setSelectedLotTraceId(null);
      }}>
        <DialogContent className="sm:max-w-5xl">
          {selectedLotTraceId ? <LotTraceDialogContent lotId={selectedLotTraceId} /> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={showSupplierPaymentDialog} onOpenChange={(open) => {
        if (!open) resetSupplierPaymentDialog();
      }}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Record Supplier Payment</DialogTitle>
            <DialogDescription>
              Post the supplier payment into Treasury and optionally link it back to the selected purchase order.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={supplierPaymentForm.paymentDate}
                onChange={(e) => setSupplierPaymentForm((prev) => ({ ...prev, paymentDate: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Treasury Account</Label>
              <Select
                value={supplierPaymentForm.financeAccountId}
                onValueChange={(value) => setSupplierPaymentForm((prev) => ({ ...prev, financeAccountId: value, chequeLeafId: '' }))}
              >
                <SelectTrigger><SelectValue placeholder="Select treasury account" /></SelectTrigger>
                <SelectContent>
                  {treasuryAccounts.map((account) => (
                    <SelectItem key={account.id} value={String(account.id)}>
                      {account.accountName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Payment Method</Label>
              <Select
                value={supplierPaymentForm.paymentMethod}
                onValueChange={(value: 'bank_transfer' | 'cash' | 'cheque') => setSupplierPaymentForm((prev) => ({
                  ...prev,
                  paymentMethod: value,
                  chequeLeafId: value === 'cheque' ? prev.chequeLeafId : '',
                }))}
              >
                <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Amount</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={supplierPaymentForm.amount}
                onChange={(e) => setSupplierPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Reference</Label>
              <Input
                value={supplierPaymentForm.referenceNumber}
                onChange={(e) => setSupplierPaymentForm((prev) => ({ ...prev, referenceNumber: e.target.value }))}
                placeholder="Optional bank/reference number"
              />
            </div>
            {supplierPaymentForm.paymentMethod === 'cheque' ? (
              <div className="grid gap-2">
                <Label>Cheque Leaf</Label>
                <Select
                  value={supplierPaymentForm.chequeLeafId}
                  onValueChange={(value) => setSupplierPaymentForm((prev) => ({ ...prev, chequeLeafId: value }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select available cheque leaf" /></SelectTrigger>
                  <SelectContent>
                    {availableChequeLeaves.map((leaf) => (
                      <SelectItem key={leaf.id} value={String(leaf.id)}>
                        {leaf.chequeNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {availableChequeLeaves.length === 0 ? (
                  <p className="text-xs text-destructive">
                    No available cheque leaves were found for the selected account. Create a cheque book in Treasury first.
                  </p>
                ) : null}
              </div>
            ) : null}
            {!selectedSupplierPaymentTarget?.purchaseOrderId ? (
              <div className="space-y-2 rounded-lg border border-dashed p-3">
                <p className="text-sm font-medium">What was this payment for?</p>
                <p className="text-xs text-muted-foreground">Not linked to a purchase order. Leave blank to use the supplier's default category, charged to Admin.</p>
                <FinanceTagFields
                  value={supplierPaymentForm.tags}
                  onChange={(tags) => setSupplierPaymentForm((prev) => ({ ...prev, tags }))}
                  direction="outflow"
                  required={false}
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Recorded against the purchase order's lines and cost centre automatically.</p>
            )}
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea
                value={supplierPaymentForm.notes}
                onChange={(e) => setSupplierPaymentForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Optional notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetSupplierPaymentDialog}>Cancel</Button>
            <Button onClick={handleSubmitSupplierPayment} disabled={createSupplierPayment.isPending}>
              {createSupplierPayment.isPending ? 'Posting...' : 'Post Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
