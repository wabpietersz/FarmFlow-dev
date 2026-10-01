import { useState } from 'react';
import { Check, Plus, ShoppingCart, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { CostCentreSelect } from '@/components/finance/FinanceTagFields';
import { useInventoryItems, useInventorySuppliers } from '@/hooks/useInventoryManagement';
import {
  useConvertRequisition,
  useCreateRequisition,
  useRequisitions,
  useReviewRequisition,
  useStockLocations,
  type Requisition,
} from '@/hooks/useStock';
import { getApiErrorMessage } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

const STATUS: Record<Requisition['status'], { label: string; variant: 'info' | 'success' | 'danger' | 'secondary' }> = {
  submitted: { label: 'Waiting for approval', variant: 'info' },
  approved: { label: 'Approved', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'danger' },
  ordered: { label: 'Ordered', variant: 'secondary' },
};

const today = () => new Date().toISOString().slice(0, 10);

/** A farm or the mill asks for stock; the office approves it and turns it into a purchase order. */
export function RequisitionsTab({ canRequest, canApprove }: { canRequest: boolean; canApprove: boolean }) {
  const [filter, setFilter] = useState<string>('open');
  const { data, isLoading } = useRequisitions(filter === 'open' || filter === 'all' ? undefined : filter);
  const review = useReviewRequisition();
  const [showCreate, setShowCreate] = useState(false);
  const [ordering, setOrdering] = useState<Requisition | null>(null);

  const list = (data?.data ?? []).filter((r) => (filter === 'open' ? r.status === 'submitted' || r.status === 'approved' : true));

  const decide = async (requisition: Requisition, status: 'approved' | 'rejected') => {
    const reviewNotes = status === 'rejected' ? window.prompt('Why is it rejected?') : null;
    if (status === 'rejected' && !reviewNotes) return;
    try {
      await review.mutateAsync({ id: requisition.id, status, reviewNotes });
      toast.success(status === 'approved' ? 'Requisition approved' : 'Requisition rejected');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not update the requisition'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
          {[['open', 'Open'], ['ordered', 'Ordered'], ['rejected', 'Rejected'], ['all', 'All']].map(([value, label]) => (
            <button key={value} type="button" onClick={() => setFilter(value)}
              className={`min-h-10 rounded-full px-4 text-sm font-semibold ${filter === value ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
              {label}
            </button>
          ))}
        </div>
        {canRequest ? <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Request stock</Button> : null}
      </div>

      {isLoading ? <Skeleton className="h-40 rounded-3xl" /> : list.length === 0 ? (
        <p className="rounded-3xl border border-dashed p-8 text-center text-sm text-muted-foreground">No requisitions here. Farms and the mill can request stock; the office approves and orders it.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((req) => (
            <div key={req.id} className="space-y-3 rounded-3xl border border-border p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{req.costCentreName} · {req.requisitionCode}</p>
                  <p className="text-sm text-muted-foreground">
                    {req.requestedByName} · {new Date(req.createdAt).toLocaleDateString()}
                    {req.neededBy ? ` · needed by ${new Date(req.neededBy).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <Badge variant={STATUS[req.status].variant}>{STATUS[req.status].label}</Badge>
              </div>
              <ul className="space-y-1 text-sm">
                {req.items.map((item) => (
                  <li key={item.inventoryItemId} className="flex justify-between gap-3">
                    <span>{item.itemName}</span>
                    <span className="font-semibold tabular-nums">{Number(item.quantity).toLocaleString()} {item.unit}</span>
                  </li>
                ))}
              </ul>
              {req.notes ? <p className="text-sm text-muted-foreground">{req.notes}</p> : null}
              {req.reviewNotes ? <p className="text-sm"><span className="font-semibold">Review:</span> {req.reviewNotes}</p> : null}
              {req.purchaseOrderCode ? <p className="text-sm font-semibold text-success">Ordered on {req.purchaseOrderCode}</p> : null}
              {canApprove && req.status === 'submitted' ? (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => decide(req, 'approved')}><Check className="h-4 w-4" /> Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => decide(req, 'rejected')}><X className="h-4 w-4" /> Reject</Button>
                </div>
              ) : null}
              {canApprove && req.status === 'approved' ? (
                <Button size="sm" onClick={() => setOrdering(req)}><ShoppingCart className="h-4 w-4" /> Create purchase order</Button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {showCreate ? <CreateRequisitionDialog onClose={() => setShowCreate(false)} /> : null}
      {ordering ? <OrderDialog requisition={ordering} onClose={() => setOrdering(null)} /> : null}
    </div>
  );
}

function CreateRequisitionDialog({ onClose }: { onClose: () => void }) {
  const items = useInventoryItems({ page: 1, limit: 500 });
  const stores = (useStockLocations().data?.data ?? []).filter((l) => l.status === 'active');
  const create = useCreateRequisition();
  const [costCentreId, setCostCentreId] = useState('');
  const [storeId, setStoreId] = useState('');
  const [neededBy, setNeededBy] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Array<{ itemId: string; quantity: string }>>([{ itemId: '', quantity: '' }]);

  const submit = async () => {
    try {
      await create.mutateAsync({
        costCentreId: Number(costCentreId),
        deliveryLocationId: storeId ? Number(storeId) : null,
        neededBy: neededBy || null,
        notes: notes.trim() || null,
        items: lines.filter((l) => l.itemId && Number(l.quantity) > 0).map((l) => ({ inventoryItemId: Number(l.itemId), quantity: Number(l.quantity) })),
      });
      toast.success('Requisition sent for approval');
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not send the requisition'));
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request stock</DialogTitle>
          <DialogDescription>Say what's needed and for which farm or the mill. The office approves and orders it.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2"><Label>For</Label><CostCentreSelect value={costCentreId} onChange={setCostCentreId} allowNone={false} placeholder="Farm, mill or admin" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Deliver to</Label>
              <Select value={storeId || 'auto'} onValueChange={(v) => setStoreId(v === 'auto' ? '' : v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Decide when ordering</SelectItem>
                  {stores.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label htmlFor="req-needed">Needed by</Label><Input id="req-needed" type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} /></div>
          </div>
          <div className="space-y-2">
            <Label>Items</Label>
            {lines.map((line, index) => (
              <div key={index} className="grid grid-cols-[minmax(0,1fr)_7rem_auto] gap-2">
                <Select value={line.itemId} onValueChange={(itemId) => setLines((ls) => ls.map((l, i) => (i === index ? { ...l, itemId } : l)))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Item" /></SelectTrigger>
                  <SelectContent>{(items.data?.data ?? []).map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.ingredientName} ({item.unit})</SelectItem>)}</SelectContent>
                </Select>
                <Input aria-label="Quantity" inputMode="decimal" placeholder="Qty" value={line.quantity} onChange={(e) => setLines((ls) => ls.map((l, i) => (i === index ? { ...l, quantity: e.target.value.replace(/[^0-9.]/g, '') } : l)))} />
                <Button variant="ghost" size="icon" aria-label="Remove line" onClick={() => setLines((ls) => ls.length > 1 ? ls.filter((_, i) => i !== index) : ls)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, { itemId: '', quantity: '' }])}><Plus className="h-4 w-4" /> Add item</Button>
          </div>
          <div className="grid gap-2"><Label htmlFor="req-notes">Notes</Label><Textarea id="req-notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!costCentreId || !lines.some((l) => l.itemId && Number(l.quantity) > 0) || create.isPending}>Send request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OrderDialog({ requisition, onClose }: { requisition: Requisition; onClose: () => void }) {
  const suppliers = (useInventorySuppliers({ status: 'active' }).data?.data ?? []);
  const convert = useConvertRequisition();
  const [supplierId, setSupplierId] = useState('');
  const [orderDate, setOrderDate] = useState(today());
  const [prices, setPrices] = useState<Record<number, string>>(
    Object.fromEntries(requisition.items.map((item) => [item.inventoryItemId, String(Number(item.lastCost) || '')])),
  );
  const total = requisition.items.reduce((sum, item) => sum + Number(item.quantity) * (Number(prices[item.inventoryItemId]) || 0), 0);

  const submit = async () => {
    try {
      await convert.mutateAsync({
        id: requisition.id,
        supplierId: Number(supplierId),
        orderDate,
        prices: requisition.items.map((item) => ({ inventoryItemId: item.inventoryItemId, unitPrice: Number(prices[item.inventoryItemId]) })),
      });
      toast.success('Draft purchase order created. Submit it from Purchase Orders.');
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not create the order'));
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Order {requisition.requisitionCode}</DialogTitle>
          <DialogDescription>Choose the supplier and confirm prices. This creates a draft purchase order.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Choose supplier" /></SelectTrigger>
                <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.supplierName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label htmlFor="order-date">Order date</Label><Input id="order-date" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} /></div>
          </div>
          {requisition.items.map((item) => (
            <div key={item.inventoryItemId} className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-3">
              <span className="text-sm"><span className="font-semibold">{item.itemName}</span> · {Number(item.quantity).toLocaleString()} {item.unit}</span>
              <Input aria-label={`Price per ${item.unit} for ${item.itemName}`} inputMode="decimal" placeholder="Price / unit" value={prices[item.inventoryItemId] ?? ''}
                onChange={(e) => setPrices((p) => ({ ...p, [item.inventoryItemId]: e.target.value.replace(/[^0-9.]/g, '') }))} />
            </div>
          ))}
          <p className="text-right font-bold">Total {formatCurrency(total)}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!supplierId || requisition.items.some((i) => !(Number(prices[i.inventoryItemId]) > 0)) || convert.isPending}>Create purchase order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
