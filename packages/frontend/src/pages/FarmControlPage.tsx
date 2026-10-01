import { useMemo, useState } from 'react';
import { ShieldCheck, Factory, LockKeyhole, MapPinned, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { parseApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useSites } from '@/hooks/useSites';
import { useBatches } from '@/hooks/useBatches';
import { CategorySelect } from '@/components/finance/FinanceTagFields';
import { InvoiceMatchBadge } from '@/components/stock/InvoiceMatchBadge';
import {
  useConsumeInventoryItemToSite,
  useCreateServiceWorkOrder,
  useInventoryItems,
  useReviewServiceWorkOrder,
  useReviewSupplierContract,
  useReviewSupplierInvoice,
  useServiceWorkOrders,
  useSettleServiceWorkOrder,
  useSiteConsumptions,
  useSupplierContracts,
  useSupplierInvoices,
  useInventorySuppliers,
} from '@/hooks/useInventoryManagement';
import { useCreatePeriodLock, usePeriodLocks, useReleasePeriodLock, useTreasuryAccounts } from '@/hooks/useTreasury';

type SiteConsumptionForm = {
  siteId: string;
  inventoryItemId: string;
  quantity: string;
  consumptionDate: string;
  notes: string;
};

type ServiceWorkOrderForm = {
  serviceType: 'utility' | 'fuel' | 'maintenance' | 'service';
  title: string;
  supplierId: string;
  contractId: string;
  allocationType: 'batch' | 'site' | 'shared_overhead' | 'mill';
  categoryId: string;
  siteId: string;
  batchId: string;
  serviceDate: string;
  invoiceReference: string;
  quantity: string;
  unit: string;
  unitRate: string;
  totalAmount: string;
  notes: string;
};

type SettlementForm = {
  financeAccountId: string;
  paymentMethod: 'cash' | 'bank_transfer' | 'cheque';
  paymentDate: string;
  referenceNumber: string;
  chequeLeafId: string;
};

type PeriodLockForm = {
  periodStart: string;
  periodEnd: string;
  scope: 'financial' | 'inventory' | 'costing' | 'all';
  notes: string;
};

const today = new Date().toISOString().split('T')[0];

const EMPTY_SITE_CONSUMPTION_FORM: SiteConsumptionForm = {
  siteId: '',
  inventoryItemId: '',
  quantity: '',
  consumptionDate: today,
  notes: '',
};

const EMPTY_SERVICE_WORK_ORDER_FORM: ServiceWorkOrderForm = {
  serviceType: 'maintenance',
  title: '',
  supplierId: '',
  contractId: '',
  allocationType: 'site',
  categoryId: '',
  siteId: '',
  batchId: '',
  serviceDate: today,
  invoiceReference: '',
  quantity: '',
  unit: '',
  unitRate: '',
  totalAmount: '',
  notes: '',
};

const EMPTY_SETTLEMENT_FORM: SettlementForm = {
  financeAccountId: '',
  paymentMethod: 'bank_transfer',
  paymentDate: today,
  referenceNumber: '',
  chequeLeafId: '',
};

const EMPTY_PERIOD_LOCK_FORM: PeriodLockForm = {
  periodStart: today,
  periodEnd: today,
  scope: 'all',
  notes: '',
};

export default function FarmControlPage() {
  const { hasPermission } = useAuthStore();
  const [showSiteConsumptionDialog, setShowSiteConsumptionDialog] = useState(false);
  const [showServiceWorkOrderDialog, setShowServiceWorkOrderDialog] = useState(false);
  const [showSettleDialog, setShowSettleDialog] = useState(false);
  const [showPeriodLockDialog, setShowPeriodLockDialog] = useState(false);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<number | null>(null);
  const [siteConsumptionForm, setSiteConsumptionForm] = useState<SiteConsumptionForm>(EMPTY_SITE_CONSUMPTION_FORM);
  const [serviceWorkOrderForm, setServiceWorkOrderForm] = useState<ServiceWorkOrderForm>(EMPTY_SERVICE_WORK_ORDER_FORM);
  const [settlementForm, setSettlementForm] = useState<SettlementForm>(EMPTY_SETTLEMENT_FORM);
  const [periodLockForm, setPeriodLockForm] = useState<PeriodLockForm>(EMPTY_PERIOD_LOCK_FORM);

  const contractsQuery = useSupplierContracts({ status: 'draft' });
  const supplierInvoicesQuery = useSupplierInvoices({ status: 'recorded' });
  const serviceWorkOrdersQuery = useServiceWorkOrders();
  const siteConsumptionsQuery = useSiteConsumptions();
  const periodLocksQuery = usePeriodLocks();
  const suppliersQuery = useInventorySuppliers();
  const inventoryItemsQuery = useInventoryItems({ page: 1, limit: 200, feedOnly: false });
  const sitesQuery = useSites();
  const batchesQuery = useBatches({ limit: 200 });
  const treasuryAccountsQuery = useTreasuryAccounts();

  const reviewContractMutation = useReviewSupplierContract();
  const reviewInvoiceMutation = useReviewSupplierInvoice();
  const [overrideInvoiceId, setOverrideInvoiceId] = useState<number | null>(null);
  const [overrideNote, setOverrideNote] = useState('');
  const createServiceWorkOrderMutation = useCreateServiceWorkOrder();
  const reviewServiceWorkOrderMutation = useReviewServiceWorkOrder();
  const settleServiceWorkOrderMutation = useSettleServiceWorkOrder();
  const consumeToSiteMutation = useConsumeInventoryItemToSite(siteConsumptionForm.inventoryItemId ? Number(siteConsumptionForm.inventoryItemId) : undefined);
  const createPeriodLockMutation = useCreatePeriodLock();
  const releasePeriodLockMutation = useReleasePeriodLock();

  const contracts = contractsQuery.data?.data ?? [];
  const supplierInvoices = supplierInvoicesQuery.data?.data ?? [];
  const serviceWorkOrders = serviceWorkOrdersQuery.data?.data ?? [];
  const siteConsumptions = siteConsumptionsQuery.data?.data ?? [];
  const periodLocks = periodLocksQuery.data?.data ?? [];
  const suppliers = suppliersQuery.data?.data ?? [];
  const inventoryItems = inventoryItemsQuery.data?.data ?? [];
  const sites = sitesQuery.data?.data ?? [];
  const batches = batchesQuery.data?.data ?? [];
  const treasuryAccounts = (treasuryAccountsQuery.data?.data ?? []).filter((account) => account.status === 'active');

  const selectedWorkOrder = useMemo(
    () => serviceWorkOrders.find((workOrder) => workOrder.id === selectedWorkOrderId) ?? null,
    [serviceWorkOrders, selectedWorkOrderId],
  );

  const handleReviewContract = async (id: number, status: 'active' | 'rejected') => {
    try {
      await reviewContractMutation.mutateAsync({ id, data: { status, approvalNotes: status === 'active' ? 'Approved from farm control' : 'Rejected from farm control' } });
      toast.success(`Contract ${status}`);
    } catch (error) {
      parseApiError(error, 'Failed to review contract');
    }
  };

  const handleReviewInvoice = async (id: number, status: 'approved' | 'rejected') => {
    const invoice = supplierInvoices.find((row) => row.id === id);
    if (status === 'approved' && invoice?.matchStatus === 'over_billed') {
      setOverrideInvoiceId(id);
      setOverrideNote('');
      return;
    }
    try {
      await reviewInvoiceMutation.mutateAsync({ id, data: { status, approvalNotes: status === 'approved' ? 'Approved from farm control' : 'Rejected from farm control' } });
      toast.success(`Invoice ${status}`);
    } catch (error) {
      parseApiError(error, 'Failed to review invoice');
    }
  };

  const handleApproveOverBilled = async () => {
    if (!overrideInvoiceId || !overrideNote.trim()) return;
    try {
      await reviewInvoiceMutation.mutateAsync({ id: overrideInvoiceId, data: { status: 'approved', approvalNotes: 'Approved over goods received', overrideNote: overrideNote.trim() } });
      toast.success('Invoice approved');
      setOverrideInvoiceId(null);
    } catch (error) {
      parseApiError(error, 'Failed to approve invoice');
    }
  };

  const handleReviewWorkOrder = async (id: number, status: 'approved' | 'rejected') => {
    try {
      await reviewServiceWorkOrderMutation.mutateAsync({ id, data: { status, approvalNotes: status === 'approved' ? 'Approved from farm control' : 'Rejected from farm control' } });
      toast.success(`Work order ${status}`);
    } catch (error) {
      parseApiError(error, 'Failed to review work order');
    }
  };

  const handleCreateSiteConsumption = async () => {
    try {
      if (!siteConsumptionForm.inventoryItemId) {
        toast.error('Select an inventory item');
        return;
      }
      await consumeToSiteMutation.mutateAsync({
        siteId: Number(siteConsumptionForm.siteId),
        quantity: Number(siteConsumptionForm.quantity),
        consumptionDate: siteConsumptionForm.consumptionDate,
        notes: siteConsumptionForm.notes || undefined,
      });
      toast.success('Site consumption recorded');
      setShowSiteConsumptionDialog(false);
      setSiteConsumptionForm(EMPTY_SITE_CONSUMPTION_FORM);
    } catch (error) {
      parseApiError(error, 'Failed to record site consumption');
    }
  };

  const handleCreateServiceWorkOrder = async () => {
    try {
      await createServiceWorkOrderMutation.mutateAsync({
        serviceType: serviceWorkOrderForm.serviceType,
        title: serviceWorkOrderForm.title,
        supplierId: Number(serviceWorkOrderForm.supplierId),
        contractId: serviceWorkOrderForm.contractId ? Number(serviceWorkOrderForm.contractId) : null,
        allocationType: serviceWorkOrderForm.allocationType,
        categoryId: serviceWorkOrderForm.categoryId ? Number(serviceWorkOrderForm.categoryId) : null,
        siteId: serviceWorkOrderForm.siteId ? Number(serviceWorkOrderForm.siteId) : null,
        batchId: serviceWorkOrderForm.batchId ? Number(serviceWorkOrderForm.batchId) : null,
        serviceDate: serviceWorkOrderForm.serviceDate,
        invoiceReference: serviceWorkOrderForm.invoiceReference || null,
        quantity: serviceWorkOrderForm.quantity ? Number(serviceWorkOrderForm.quantity) : null,
        unit: serviceWorkOrderForm.unit || null,
        unitRate: serviceWorkOrderForm.unitRate ? Number(serviceWorkOrderForm.unitRate) : null,
        totalAmount: Number(serviceWorkOrderForm.totalAmount),
        notes: serviceWorkOrderForm.notes || null,
      });
      toast.success('Service workflow created');
      setShowServiceWorkOrderDialog(false);
      setServiceWorkOrderForm(EMPTY_SERVICE_WORK_ORDER_FORM);
    } catch (error) {
      parseApiError(error, 'Failed to create service workflow');
    }
  };

  const handleSettleWorkOrder = async () => {
    if (!selectedWorkOrderId) return;
    try {
      await settleServiceWorkOrderMutation.mutateAsync({
        id: selectedWorkOrderId,
        data: {
          financeAccountId: Number(settlementForm.financeAccountId),
          paymentMethod: settlementForm.paymentMethod,
          paymentDate: settlementForm.paymentDate,
          referenceNumber: settlementForm.referenceNumber || undefined,
          chequeLeafId: settlementForm.chequeLeafId ? Number(settlementForm.chequeLeafId) : null,
        },
      });
      toast.success('Work order settled');
      setShowSettleDialog(false);
      setSelectedWorkOrderId(null);
      setSettlementForm(EMPTY_SETTLEMENT_FORM);
    } catch (error) {
      parseApiError(error, 'Failed to settle work order');
    }
  };

  const handleCreatePeriodLock = async () => {
    try {
      await createPeriodLockMutation.mutateAsync(periodLockForm);
      toast.success('Period lock created');
      setShowPeriodLockDialog(false);
      setPeriodLockForm(EMPTY_PERIOD_LOCK_FORM);
    } catch (error) {
      parseApiError(error, 'Failed to create period lock');
    }
  };

  const handleReleaseLock = async (id: number) => {
    try {
      await releasePeriodLockMutation.mutateAsync({ id, notes: 'Released from farm control' });
      toast.success('Period lock released');
    } catch (error) {
      parseApiError(error, 'Failed to release period lock');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Farm Control</h1>
        <p className="text-sm text-muted-foreground">Approvals, service workflows, site consumptions, and close controls.</p>
      </div>

      <Tabs defaultValue="approvals" className="space-y-4">
        <TabsList>
          <TabsTrigger value="approvals" className="gap-2"><ShieldCheck className="h-4 w-4" />Approvals</TabsTrigger>
          <TabsTrigger value="service-workflows" className="gap-2"><Factory className="h-4 w-4" />Service Workflows</TabsTrigger>
          <TabsTrigger value="site-consumption" className="gap-2"><MapPinned className="h-4 w-4" />Site Consumption</TabsTrigger>
          <TabsTrigger value="period-locks" className="gap-2"><LockKeyhole className="h-4 w-4" />Period Locks</TabsTrigger>
        </TabsList>

        <TabsContent value="approvals" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Pending Contracts</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Contract</TableHead><TableHead>Supplier</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {contracts.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="h-20 text-center text-sm text-muted-foreground">No pending contracts.</TableCell></TableRow>
                  ) : contracts.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell>{contract.contractCode} - {contract.contractTitle}</TableCell>
                      <TableCell>{contract.supplierName}</TableCell>
                      <TableCell>{contract.status}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleReviewContract(contract.id, 'active')}>Approve</Button>
                          <Button size="sm" variant="outline" onClick={() => handleReviewContract(contract.id, 'rejected')}>Reject</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Pending Supplier Invoices</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Supplier</TableHead><TableHead>Due Date</TableHead><TableHead>Match</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {supplierInvoices.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="h-20 text-center text-sm text-muted-foreground">No pending invoices.</TableCell></TableRow>
                  ) : supplierInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>{invoice.invoiceCode} - {invoice.invoiceReference}</TableCell>
                      <TableCell>{invoice.supplierName}</TableCell>
                      <TableCell>{new Date(invoice.dueDate).toLocaleDateString()}</TableCell>
                      <TableCell><InvoiceMatchBadge invoice={invoice} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleReviewInvoice(invoice.id, 'approved')}>Approve</Button>
                          <Button size="sm" variant="outline" onClick={() => handleReviewInvoice(invoice.id, 'rejected')}>Reject</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="service-workflows" className="space-y-4">
          <div className="flex justify-end">
            {hasPermission('inventory:create') ? (
              <Button onClick={() => setShowServiceWorkOrderDialog(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                New Workflow
              </Button>
            ) : null}
          </div>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader><TableRow><TableHead>Workflow</TableHead><TableHead>Supplier</TableHead><TableHead>Allocation</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {serviceWorkOrders.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="h-20 text-center text-sm text-muted-foreground">No service workflows yet.</TableCell></TableRow>
                  ) : serviceWorkOrders.map((workOrder) => (
                    <TableRow key={workOrder.id}>
                      <TableCell>{workOrder.workOrderCode} - {workOrder.title}</TableCell>
                      <TableCell>{workOrder.supplierName || '--'}</TableCell>
                      <TableCell>{workOrder.allocationType}{workOrder.batchCode ? ` / ${workOrder.batchCode}` : workOrder.siteName ? ` / ${workOrder.siteName}` : ''}</TableCell>
                      <TableCell>{workOrder.status}</TableCell>
                      <TableCell className="text-right">Rs. {Number(workOrder.totalAmount).toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {workOrder.status === 'pending_approval' ? (
                            <>
                              <Button size="sm" variant="outline" onClick={() => handleReviewWorkOrder(workOrder.id, 'approved')}>Approve</Button>
                              <Button size="sm" variant="outline" onClick={() => handleReviewWorkOrder(workOrder.id, 'rejected')}>Reject</Button>
                            </>
                          ) : null}
                          {workOrder.status === 'approved' ? (
                            <Button size="sm" variant="outline" onClick={() => {
                              setSelectedWorkOrderId(workOrder.id);
                              setSettlementForm((prev) => ({ ...prev, paymentDate: workOrder.serviceDate }));
                              setShowSettleDialog(true);
                            }}>
                              Settle
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

        <TabsContent value="site-consumption" className="space-y-4">
          <div className="flex justify-end">
            {hasPermission('inventory:update') ? (
              <Button onClick={() => setShowSiteConsumptionDialog(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Record Site Consumption
              </Button>
            ) : null}
          </div>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Site</TableHead><TableHead>Item</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead className="text-right">Cost</TableHead></TableRow></TableHeader>
                <TableBody>
                  {siteConsumptions.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="h-20 text-center text-sm text-muted-foreground">No site consumptions recorded.</TableCell></TableRow>
                  ) : siteConsumptions.map((consumption) => (
                    <TableRow key={consumption.id}>
                      <TableCell>{new Date(consumption.consumptionDate).toLocaleDateString()}</TableCell>
                      <TableCell>{consumption.siteName}</TableCell>
                      <TableCell>{consumption.ingredientName}</TableCell>
                      <TableCell className="text-right">{Number(consumption.quantity).toLocaleString()} {consumption.unit}</TableCell>
                      <TableCell className="text-right">Rs. {Number(consumption.lineCost ?? 0).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="period-locks" className="space-y-4">
          <div className="flex justify-end">
            {hasPermission('treasury:transactions:manage') ? (
              <Button onClick={() => setShowPeriodLockDialog(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Close Period
              </Button>
            ) : null}
          </div>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader><TableRow><TableHead>Lock</TableHead><TableHead>Scope</TableHead><TableHead>Period</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {periodLocks.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="h-20 text-center text-sm text-muted-foreground">No period locks configured.</TableCell></TableRow>
                  ) : periodLocks.map((lock) => (
                    <TableRow key={lock.id}>
                      <TableCell>{lock.lockCode}</TableCell>
                      <TableCell>{lock.scope}</TableCell>
                      <TableCell>{lock.periodStart} to {lock.periodEnd}</TableCell>
                      <TableCell>{lock.status}</TableCell>
                      <TableCell className="text-right">
                        {lock.status === 'active' ? (
                          <Button size="sm" variant="outline" onClick={() => handleReleaseLock(lock.id)}>
                            Release
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showSiteConsumptionDialog} onOpenChange={setShowSiteConsumptionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Site Consumption</DialogTitle>
            <DialogDescription>Consume non-feed inventory directly to a site.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Site</Label>
              <Select value={siteConsumptionForm.siteId} onValueChange={(value) => setSiteConsumptionForm((prev) => ({ ...prev, siteId: value }))}>
                <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                <SelectContent>{sites.map((site) => <SelectItem key={site.id} value={String(site.id)}>{site.siteName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Inventory Item</Label>
              <Select value={siteConsumptionForm.inventoryItemId} onValueChange={(value) => setSiteConsumptionForm((prev) => ({ ...prev, inventoryItemId: value }))}>
                <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                <SelectContent>
                  {inventoryItems.filter((item) => !item.isFeed).map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>{item.ingredientName} ({Number(item.quantity).toLocaleString()} {item.unit})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2"><Label>Quantity</Label><Input type="number" step="0.01" value={siteConsumptionForm.quantity} onChange={(e) => setSiteConsumptionForm((prev) => ({ ...prev, quantity: e.target.value }))} /></div>
              <div className="grid gap-2"><Label>Date</Label><Input type="date" value={siteConsumptionForm.consumptionDate} onChange={(e) => setSiteConsumptionForm((prev) => ({ ...prev, consumptionDate: e.target.value }))} /></div>
            </div>
            <div className="grid gap-2"><Label>Notes</Label><Textarea value={siteConsumptionForm.notes} onChange={(e) => setSiteConsumptionForm((prev) => ({ ...prev, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSiteConsumptionDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateSiteConsumption} disabled={consumeToSiteMutation.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showServiceWorkOrderDialog} onOpenChange={setShowServiceWorkOrderDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create Service Workflow</DialogTitle>
            <DialogDescription>Utilities, fuel, maintenance, and contracted service jobs that later settle through treasury.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2"><Label>Type</Label><Select value={serviceWorkOrderForm.serviceType} onValueChange={(value) => setServiceWorkOrderForm((prev) => ({ ...prev, serviceType: value as ServiceWorkOrderForm['serviceType'] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="utility">Utility</SelectItem><SelectItem value="fuel">Fuel</SelectItem><SelectItem value="maintenance">Maintenance</SelectItem><SelectItem value="service">Service</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>Supplier</Label><Select value={serviceWorkOrderForm.supplierId} onValueChange={(value) => setServiceWorkOrderForm((prev) => ({ ...prev, supplierId: value }))}><SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger><SelectContent>{suppliers.map((supplier) => <SelectItem key={supplier.id} value={String(supplier.id)}>{supplier.supplierName}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2 md:col-span-2"><Label>Title</Label><Input value={serviceWorkOrderForm.title} onChange={(e) => setServiceWorkOrderForm((prev) => ({ ...prev, title: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Contract</Label><Select value={serviceWorkOrderForm.contractId || 'none'} onValueChange={(value) => setServiceWorkOrderForm((prev) => ({ ...prev, contractId: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue placeholder="Optional contract" /></SelectTrigger><SelectContent><SelectItem value="none">No contract</SelectItem>{contractsQuery.data?.data?.map((contract) => <SelectItem key={contract.id} value={String(contract.id)}>{contract.contractCode}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>Allocation</Label><Select value={serviceWorkOrderForm.allocationType} onValueChange={(value) => setServiceWorkOrderForm((prev) => ({ ...prev, allocationType: value as ServiceWorkOrderForm['allocationType'] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="site">Site</SelectItem><SelectItem value="batch">Batch</SelectItem><SelectItem value="shared_overhead">Shared overhead (Admin)</SelectItem><SelectItem value="mill">Feed Mill</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>Finance category</Label><CategorySelect value={serviceWorkOrderForm.categoryId} onChange={(value) => setServiceWorkOrderForm((prev) => ({ ...prev, categoryId: value }))} placeholder="Automatic from type" /></div>
            <div className="grid gap-2"><Label>Site</Label><Select value={serviceWorkOrderForm.siteId || 'none'} onValueChange={(value) => setServiceWorkOrderForm((prev) => ({ ...prev, siteId: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue placeholder="Optional site" /></SelectTrigger><SelectContent><SelectItem value="none">No site</SelectItem>{sites.map((site) => <SelectItem key={site.id} value={String(site.id)}>{site.siteName}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>Batch</Label><Select value={serviceWorkOrderForm.batchId || 'none'} onValueChange={(value) => setServiceWorkOrderForm((prev) => ({ ...prev, batchId: value === 'none' ? '' : value }))}><SelectTrigger><SelectValue placeholder="Optional batch" /></SelectTrigger><SelectContent><SelectItem value="none">No batch</SelectItem>{batches.map((batch) => <SelectItem key={batch.id} value={String(batch.id)}>{batch.batchCode}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>Service Date</Label><Input type="date" value={serviceWorkOrderForm.serviceDate} onChange={(e) => setServiceWorkOrderForm((prev) => ({ ...prev, serviceDate: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Invoice Ref</Label><Input value={serviceWorkOrderForm.invoiceReference} onChange={(e) => setServiceWorkOrderForm((prev) => ({ ...prev, invoiceReference: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Total Amount</Label><Input type="number" step="0.01" value={serviceWorkOrderForm.totalAmount} onChange={(e) => setServiceWorkOrderForm((prev) => ({ ...prev, totalAmount: e.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>Notes</Label><Textarea value={serviceWorkOrderForm.notes} onChange={(e) => setServiceWorkOrderForm((prev) => ({ ...prev, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowServiceWorkOrderDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateServiceWorkOrder} disabled={createServiceWorkOrderMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSettleDialog} onOpenChange={setShowSettleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settle Service Workflow</DialogTitle>
            <DialogDescription>{selectedWorkOrder?.workOrderCode} {selectedWorkOrder ? `for Rs. ${Number(selectedWorkOrder.totalAmount).toFixed(2)}` : ''}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2"><Label>Finance Account</Label><Select value={settlementForm.financeAccountId} onValueChange={(value) => setSettlementForm((prev) => ({ ...prev, financeAccountId: value }))}><SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger><SelectContent>{treasuryAccounts.map((account) => <SelectItem key={account.id} value={String(account.id)}>{account.accountName}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>Payment Method</Label><Select value={settlementForm.paymentMethod} onValueChange={(value) => setSettlementForm((prev) => ({ ...prev, paymentMethod: value as SettlementForm['paymentMethod'] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bank_transfer">Bank Transfer</SelectItem><SelectItem value="cash">Cash</SelectItem><SelectItem value="cheque">Cheque</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>Payment Date</Label><Input type="date" value={settlementForm.paymentDate} onChange={(e) => setSettlementForm((prev) => ({ ...prev, paymentDate: e.target.value }))} /></div>
            <div className="grid gap-2"><Label>Reference</Label><Input value={settlementForm.referenceNumber} onChange={(e) => setSettlementForm((prev) => ({ ...prev, referenceNumber: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettleDialog(false)}>Cancel</Button>
            <Button onClick={handleSettleWorkOrder} disabled={settleServiceWorkOrderMutation.isPending}>Settle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPeriodLockDialog} onOpenChange={setShowPeriodLockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Period Lock</DialogTitle>
            <DialogDescription>Closed periods block backdated stock, cost, and financial mutations until released.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2"><Label>Start</Label><Input type="date" value={periodLockForm.periodStart} onChange={(e) => setPeriodLockForm((prev) => ({ ...prev, periodStart: e.target.value }))} /></div>
              <div className="grid gap-2"><Label>End</Label><Input type="date" value={periodLockForm.periodEnd} onChange={(e) => setPeriodLockForm((prev) => ({ ...prev, periodEnd: e.target.value }))} /></div>
            </div>
            <div className="grid gap-2"><Label>Scope</Label><Select value={periodLockForm.scope} onValueChange={(value) => setPeriodLockForm((prev) => ({ ...prev, scope: value as PeriodLockForm['scope'] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="financial">Financial</SelectItem><SelectItem value="inventory">Inventory</SelectItem><SelectItem value="costing">Costing</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>Notes</Label><Textarea value={periodLockForm.notes} onChange={(e) => setPeriodLockForm((prev) => ({ ...prev, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPeriodLockDialog(false)}>Cancel</Button>
            <Button onClick={handleCreatePeriodLock} disabled={createPeriodLockMutation.isPending}>Lock Period</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={overrideInvoiceId !== null} onOpenChange={(open) => { if (!open) setOverrideInvoiceId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve over-billed invoice?</DialogTitle>
            <DialogDescription>This invoice is for more than the goods received on its order. Receive the rest of the goods first, or give a reason to approve it anyway.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="override-note">Reason</Label>
            <Textarea id="override-note" value={overrideNote} onChange={(e) => setOverrideNote(e.target.value)} placeholder="e.g. Transport charge agreed with supplier" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideInvoiceId(null)}>Cancel</Button>
            <Button onClick={handleApproveOverBilled} disabled={!overrideNote.trim() || reviewInvoiceMutation.isPending}>Approve anyway</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
