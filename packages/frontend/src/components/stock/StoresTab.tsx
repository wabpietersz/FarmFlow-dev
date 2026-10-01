import { useMemo, useState } from 'react';
import { ArrowRightLeft, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  useCreateTransfer,
  useExpiringLots,
  useStockBalances,
  useStockLocations,
  useStockTransfers,
  useWriteOffLot,
  type ExpiringLot,
} from '@/hooks/useStock';
import { getApiErrorMessage } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

const ALL = 'all';
const today = () => new Date().toISOString().slice(0, 10);
const fmtQty = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 2 });

/** Stock held in each store, moving it between stores, and dealing with stock that's expiring. */
export function StoresTab({ canMove, canWriteOff }: { canMove: boolean; canWriteOff: boolean }) {
  const [locationId, setLocationId] = useState(ALL);
  const locations = useStockLocations();
  const balances = useStockBalances(locationId !== ALL ? { locationId: Number(locationId) } : {});
  const transfers = useStockTransfers();
  const expiring = useExpiringLots(30);
  const [showTransfer, setShowTransfer] = useState(false);
  const [writeOff, setWriteOff] = useState<ExpiringLot | null>(null);

  const rows = balances.data?.data ?? [];
  const totalValue = rows.reduce((sum, row) => sum + row.value, 0);
  const expiringRows = expiring.data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-2 sm:w-72">
          <Label>Store</Label>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All stores</SelectItem>
              {(locations.data?.data ?? []).filter((l) => l.status === 'active').map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {canMove ? <Button onClick={() => setShowTransfer(true)}><ArrowRightLeft className="h-4 w-4" /> Move stock</Button> : null}
      </div>

      {expiringRows.length > 0 ? (
        <section aria-labelledby="expiring" className="space-y-2 rounded-3xl bg-panel-warm p-5">
          <h3 id="expiring" className="text-lg font-bold">Expiring within 30 days</h3>
          {expiringRows.map((lot) => (
            <div key={lot.lotId} className="flex flex-wrap items-center gap-3 rounded-2xl bg-card p-3.5">
              <div className="min-w-0 flex-1">
                <p className="font-bold">{lot.itemName} <span className="font-normal text-muted-foreground">· {lot.lotCode}</span></p>
                <p className="text-sm text-muted-foreground">{fmtQty(lot.remainingQuantity)} {lot.unit} in {lot.locationName} · {formatCurrency(lot.value)}</p>
              </div>
              <Badge variant={lot.expired ? 'danger' : 'warning'}>
                {lot.expired ? `Expired ${new Date(lot.expiryDate).toLocaleDateString()}` : `${lot.daysLeft} day${lot.daysLeft === 1 ? '' : 's'} left`}
              </Badge>
              {canWriteOff ? <Button variant="outline" size="sm" onClick={() => setWriteOff(lot)}><Trash2 className="h-4 w-4" /> Write off</Button> : null}
            </div>
          ))}
        </section>
      ) : null}

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-lg font-bold">Stock in {locationId === ALL ? 'all stores' : (locations.data?.data ?? []).find((l) => String(l.id) === locationId)?.name}</h3>
          <span className="text-sm font-semibold text-muted-foreground">Value {formatCurrency(totalValue)}</span>
        </div>
        {balances.isLoading ? <Skeleton className="h-40 rounded-3xl" /> : rows.length === 0 ? (
          <p className="rounded-3xl border border-dashed p-6 text-center text-sm text-muted-foreground">No lot-tracked stock here yet. Stock appears when purchase orders are received.</p>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Store</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead className="text-right">Value</TableHead><TableHead>Next expiry</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.locationId}-${row.inventoryItemId}`}>
                  <TableCell className="font-semibold">{row.itemName}</TableCell>
                  <TableCell>{row.locationName}</TableCell>
                  <TableCell className="text-right">{fmtQty(row.quantity)} {row.unit}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.value)}</TableCell>
                  <TableCell>{row.nextExpiry ? new Date(row.nextExpiry).toLocaleDateString() : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-lg font-bold">Recent moves</h3>
        {(transfers.data?.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No stock has been moved between stores yet.</p>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>From → to</TableHead><TableHead>Items</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader>
            <TableBody>
              {(transfers.data?.data ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{new Date(t.transferDate).toLocaleDateString()}<p className="text-xs text-muted-foreground">{t.transferCode}</p></TableCell>
                  <TableCell>{t.fromName} → {t.toName}</TableCell>
                  <TableCell className="max-w-xs truncate">{t.items}</TableCell>
                  <TableCell className="text-right">{formatCurrency(t.value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {showTransfer ? <TransferDialog onClose={() => setShowTransfer(false)} /> : null}
      {writeOff ? <WriteOffDialog lot={writeOff} onClose={() => setWriteOff(null)} /> : null}
    </div>
  );
}

function TransferDialog({ onClose }: { onClose: () => void }) {
  const locations = (useStockLocations().data?.data ?? []).filter((l) => l.status === 'active');
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Array<{ itemId: string; quantity: string }>>([{ itemId: '', quantity: '' }]);
  const available = useStockBalances(fromId ? { locationId: Number(fromId) } : {});
  const create = useCreateTransfer();
  const sourceItems = useMemo(() => (fromId ? available.data?.data ?? [] : []), [available.data, fromId]);

  const submit = async () => {
    try {
      await create.mutateAsync({
        fromLocationId: Number(fromId),
        toLocationId: Number(toId),
        transferDate: date,
        notes: notes.trim() || undefined,
        lines: lines.filter((l) => l.itemId && Number(l.quantity) > 0).map((l) => ({ inventoryItemId: Number(l.itemId), quantity: Number(l.quantity) })),
      });
      toast.success('Stock moved');
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not move the stock'));
    }
  };

  const valid = fromId && toId && fromId !== toId && lines.some((l) => l.itemId && Number(l.quantity) > 0);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Move stock between stores</DialogTitle>
          <DialogDescription>Oldest and soonest-expiring stock moves first. The cost moves with it.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>From</Label>
              <Select value={fromId} onValueChange={(v) => { setFromId(v); setLines([{ itemId: '', quantity: '' }]); }}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Choose store" /></SelectTrigger>
                <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>To</Label>
              <Select value={toId} onValueChange={setToId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Choose store" /></SelectTrigger>
                <SelectContent>{locations.filter((l) => String(l.id) !== fromId).map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2"><Label htmlFor="transfer-date">Date</Label><Input id="transfer-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="space-y-2">
            <Label>Items</Label>
            {lines.map((line, index) => {
              const item = sourceItems.find((i) => String(i.inventoryItemId) === line.itemId);
              return (
                <div key={index} className="grid grid-cols-[minmax(0,1fr)_7rem_auto] gap-2">
                  <Select value={line.itemId} onValueChange={(itemId) => setLines((ls) => ls.map((l, i) => (i === index ? { ...l, itemId } : l)))} disabled={!fromId}>
                    <SelectTrigger className="w-full"><SelectValue placeholder={fromId ? 'Item' : 'Choose a store first'} /></SelectTrigger>
                    <SelectContent>{sourceItems.map((i) => <SelectItem key={i.inventoryItemId} value={String(i.inventoryItemId)}>{i.itemName} · {fmtQty(i.quantity)} {i.unit}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input aria-label="Quantity" inputMode="decimal" placeholder={item ? `max ${fmtQty(item.quantity)}` : 'Qty'} value={line.quantity}
                    onChange={(e) => setLines((ls) => ls.map((l, i) => (i === index ? { ...l, quantity: e.target.value.replace(/[^0-9.]/g, '') } : l)))} />
                  <Button variant="ghost" size="icon" aria-label="Remove line" onClick={() => setLines((ls) => ls.length > 1 ? ls.filter((_, i) => i !== index) : ls)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              );
            })}
            <Button variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, { itemId: '', quantity: '' }])} disabled={!fromId}><Plus className="h-4 w-4" /> Add item</Button>
          </div>
          <div className="grid gap-2"><Label htmlFor="transfer-notes">Notes</Label><Textarea id="transfer-notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!valid || create.isPending}>{create.isPending ? 'Moving…' : 'Move stock'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WriteOffDialog({ lot, onClose }: { lot: ExpiringLot; onClose: () => void }) {
  const [quantity, setQuantity] = useState(String(lot.remainingQuantity));
  const [reason, setReason] = useState(lot.expired ? 'Expired' : '');
  const writeOff = useWriteOffLot();
  const submit = async () => {
    try {
      await writeOff.mutateAsync({ lotId: lot.lotId, quantity: Number(quantity), reason: reason.trim() });
      toast.success('Stock written off');
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not write off the stock'));
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Write off {lot.itemName}</DialogTitle>
          <DialogDescription>Removes the stock from {lot.locationName}. Its value ({formatCurrency(lot.value)} for the whole lot) is recorded as a loss.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2"><Label htmlFor="wo-qty">Quantity ({lot.unit})</Label><Input id="wo-qty" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/[^0-9.]/g, ''))} /></div>
          <div className="grid gap-2"><Label htmlFor="wo-reason">Reason</Label><Input id="wo-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Expired, damaged, spoiled…" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={submit} disabled={!reason.trim() || !(Number(quantity) > 0) || writeOff.isPending}>Write off</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
