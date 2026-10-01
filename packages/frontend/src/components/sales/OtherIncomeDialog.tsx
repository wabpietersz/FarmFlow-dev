import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useBatches } from '@/hooks/useBatches';
import { useBuyers, useCreateSale, type CreateSalePayload } from '@/hooks/useSales';
import { useSites } from '@/hooks/useSites';
import { getApiErrorMessage } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { CreditLimitDialog, readCreditBlock, type CreditBlock } from './CreditLimitDialog';

const QUICK_ITEMS = [
  { label: 'Litter', unit: 'bags' },
  { label: 'Manure', unit: 'bags' },
  { label: 'Empty feed bags', unit: 'bags' },
  { label: 'Scrap', unit: 'kg' },
];
const NO_BATCH = 'none';
const today = () => new Date().toISOString().slice(0, 10);

/** Manure, litter, scrap and other farm income — invoiced and collected like bird sales. */
export function OtherIncomeDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateSale();
  const buyers = useBuyers({ status: 'active', limit: 100 }).data?.data ?? [];
  const sites = useSites().data?.data ?? [];
  const batches = (useBatches({ limit: 100 }).data?.data ?? []).filter((b) => b.status !== 'closed');
  const [form, setForm] = useState({ buyerId: '', siteId: '', batchId: NO_BATCH, saleDate: today(), itemDescription: '', quantity: '', unit: 'bags', unitPrice: '', notes: '' });
  const [creditBlock, setCreditBlock] = useState<CreditBlock | null>(null);
  const set = (key: keyof typeof form) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const siteBatches = batches.filter((b) => !form.siteId || String(b.siteId) === form.siteId);
  const qty = Number(form.quantity) || 0;
  const price = Number(form.unitPrice) || 0;
  const valid = form.buyerId && (form.siteId || form.batchId !== NO_BATCH) && form.itemDescription.trim() && qty > 0 && price > 0;

  const submit = async (creditOverrideReason?: string) => {
    const payload: CreateSalePayload = {
      saleType: 'other_income',
      buyerId: Number(form.buyerId),
      siteId: form.siteId ? Number(form.siteId) : undefined,
      batchId: form.batchId !== NO_BATCH ? Number(form.batchId) : undefined,
      saleDate: form.saleDate,
      itemDescription: form.itemDescription.trim(),
      quantity: qty,
      unit: form.unit.trim() || undefined,
      unitPrice: price,
      notes: form.notes.trim() || undefined,
      creditOverrideReason,
    };
    try {
      await create.mutateAsync(payload);
      toast.success('Income recorded as a draft sale. Review it to take payment.');
      onClose();
    } catch (error) {
      const block = readCreditBlock(error);
      if (block) { setCreditBlock(block); return; }
      toast.error(getApiErrorMessage(error, 'Could not record the income'));
    }
  };

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Other income</DialogTitle>
            <DialogDescription>Manure, litter, scrap and anything else you sell. It is invoiced, collected and shows on the buyer's statement like a bird sale.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {QUICK_ITEMS.map((item) => (
              <button key={item.label} type="button" onClick={() => setForm((prev) => ({ ...prev, itemDescription: item.label, unit: item.unit }))}
                className={`min-h-9 rounded-full px-3 text-sm font-semibold ${form.itemDescription === item.label ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                {item.label}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="oi-item">What was sold</Label>
              <Input id="oi-item" value={form.itemDescription} onChange={(e) => set('itemDescription')(e.target.value)} placeholder="e.g. Litter" />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label>Buyer</Label>
              <Select value={form.buyerId} onValueChange={set('buyerId')}>
                <SelectTrigger><SelectValue placeholder="Choose buyer" /></SelectTrigger>
                <SelectContent>{buyers.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.buyerName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Farm</Label>
              <Select value={form.siteId} onValueChange={(value) => setForm((prev) => ({ ...prev, siteId: value, batchId: NO_BATCH }))}>
                <SelectTrigger><SelectValue placeholder="Choose farm" /></SelectTrigger>
                <SelectContent>{sites.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.siteName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>From batch <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Select value={form.batchId} onValueChange={set('batchId')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_BATCH}>Not from a batch</SelectItem>
                  {siteBatches.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.batchCode}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="oi-qty">Quantity</Label>
              <div className="flex gap-2">
                <Input id="oi-qty" type="number" inputMode="decimal" min="0" step="0.01" value={form.quantity} onChange={(e) => set('quantity')(e.target.value)} />
                <Input aria-label="Unit" className="w-24" value={form.unit} onChange={(e) => set('unit')(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="oi-price">Price per {form.unit || 'unit'}</Label>
              <Input id="oi-price" type="number" inputMode="decimal" min="0" step="0.01" value={form.unitPrice} onChange={(e) => set('unitPrice')(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="oi-date">Date</Label>
              <Input id="oi-date" type="date" value={form.saleDate} onChange={(e) => set('saleDate')(e.target.value)} />
            </div>
            <div className="flex flex-col justify-end rounded-2xl bg-panel p-3 text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-bold tabular-nums">{formatCurrency(qty * price)}</span>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="oi-notes">Notes</Label>
              <Textarea id="oi-notes" value={form.notes} onChange={(e) => set('notes')(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => submit()} disabled={!valid || create.isPending}>Record income</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CreditLimitDialog block={creditBlock} pending={create.isPending} onClose={() => setCreditBlock(null)} onConfirm={(reason) => { setCreditBlock(null); void submit(reason); }} />
    </>
  );
}
