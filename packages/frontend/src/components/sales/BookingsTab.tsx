import { useState } from 'react';
import { CalendarClock, Pencil, Plus, ShoppingCart, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import type { SaleBooking } from '@farmflow/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useBatches } from '@/hooks/useBatches';
import { useBuyers, useSaleBookings, useSaveBooking } from '@/hooks/useSales';
import { getApiErrorMessage } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

const STATUS: Record<SaleBooking['status'], { label: string; variant: 'info' | 'success' | 'secondary' }> = {
  booked: { label: 'Booked', variant: 'info' },
  converted: { label: 'Sold', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'secondary' },
};

const today = () => new Date().toISOString().slice(0, 10);

function whenLabel(catchDate: string) {
  const days = Math.round((new Date(`${catchDate}T00:00:00`).getTime() - new Date(`${today()}T00:00:00`).getTime()) / 86_400_000);
  if (days === 0) return { text: 'Today', tone: 'text-warning' };
  if (days === 1) return { text: 'Tomorrow', tone: 'text-warning' };
  if (days > 1) return { text: `In ${days} days`, tone: 'text-muted-foreground' };
  return { text: `${-days} day${days === -1 ? '' : 's'} late`, tone: 'text-danger' };
}

/** Catches agreed with buyers before the lorries arrive. Each one becomes a sale on the day. */
export function BookingsTab({ canBook, onMakeSale }: { canBook: boolean; onMakeSale: (booking: SaleBooking) => void }) {
  const [filter, setFilter] = useState('booked');
  const { data, isLoading } = useSaleBookings(filter);
  const save = useSaveBooking();
  const [editing, setEditing] = useState<SaleBooking | 'new' | null>(null);
  const bookings = data?.data ?? [];

  const cancel = async (booking: SaleBooking) => {
    if (!window.confirm(`Cancel booking ${booking.bookingCode} for ${booking.buyerName}?`)) return;
    try {
      await save.mutateAsync({ id: booking.id, data: { status: 'cancelled' } });
      toast.success('Booking cancelled');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not cancel the booking'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
          {[['booked', 'Upcoming'], ['converted', 'Sold'], ['cancelled', 'Cancelled'], ['all', 'All']].map(([value, label]) => (
            <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value}
              className={`min-h-10 rounded-full px-4 text-sm font-semibold ${filter === value ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
              {label}
            </button>
          ))}
        </div>
        {canBook ? <Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Book a catch</Button> : null}
      </div>

      {isLoading ? <Skeleton className="h-40 rounded-3xl" /> : bookings.length === 0 ? (
        <div className="rounded-3xl border border-dashed p-8 text-center">
          <CalendarClock className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-semibold">No bookings here</p>
          <p className="text-sm text-muted-foreground">Book a buyer, batch, number of birds and price before catching. On the day, turn it into the sale.</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {bookings.map((booking) => {
            const when = whenLabel(booking.catchDate);
            return (
              <div key={booking.id} className="space-y-3 rounded-3xl border border-border p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{booking.buyerName}</p>
                    <p className="text-sm text-muted-foreground">{booking.batchCode} · {booking.siteName ?? '—'} · {booking.bookingCode}</p>
                  </div>
                  <Badge variant={STATUS[booking.status].variant}>{STATUS[booking.status].label}</Badge>
                </div>
                <dl className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Catch</dt>
                    <dd className="font-semibold">{new Date(booking.catchDate).toLocaleDateString()}</dd>
                    {booking.status === 'booked' ? <dd className={`text-xs font-semibold ${when.tone}`}>{when.text}</dd> : null}
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Birds</dt>
                    <dd className="font-semibold tabular-nums">{booking.expectedBirds.toLocaleString()}</dd>
                    {booking.expectedAvgWeightKg ? <dd className="text-xs text-muted-foreground">~{booking.expectedAvgWeightKg} kg each</dd> : null}
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Price / kg</dt>
                    <dd className="font-semibold tabular-nums">{formatCurrency(booking.pricePerKg)}</dd>
                    {booking.expectedValue ? <dd className="text-xs text-muted-foreground">≈ {formatCurrency(booking.expectedValue)}</dd> : null}
                  </div>
                </dl>
                {booking.notes ? <p className="text-sm text-muted-foreground">{booking.notes}</p> : null}
                {booking.status === 'converted' && booking.saleId ? (
                  <Link to={`/sales/${booking.saleId}`} className="text-sm font-semibold text-success hover:underline">Sold on {booking.saleCode}</Link>
                ) : null}
                {canBook && booking.status === 'booked' ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => onMakeSale(booking)}><ShoppingCart className="h-4 w-4" /> Make the sale</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(booking)}><Pencil className="h-4 w-4" /> Change</Button>
                    <Button size="sm" variant="ghost" onClick={() => cancel(booking)}><X className="h-4 w-4" /> Cancel</Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {editing ? <BookingDialog booking={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function BookingDialog({ booking, onClose }: { booking: SaleBooking | null; onClose: () => void }) {
  const save = useSaveBooking();
  const buyers = useBuyers({ status: 'active', limit: 100 }).data?.data ?? [];
  const batches = (useBatches({ limit: 100 }).data?.data ?? []).filter((b) => b.status === 'growing' || b.status === 'ready_for_sale');
  const [form, setForm] = useState({
    buyerId: booking ? String(booking.buyerId) : '',
    batchId: booking ? String(booking.batchId) : '',
    catchDate: booking?.catchDate ?? today(),
    expectedBirds: booking ? String(booking.expectedBirds) : '',
    expectedAvgWeightKg: booking?.expectedAvgWeightKg ? String(booking.expectedAvgWeightKg) : '',
    pricePerKg: booking ? String(booking.pricePerKg) : '',
    notes: booking?.notes ?? '',
  });
  const set = (key: keyof typeof form) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const birds = Number(form.expectedBirds) || 0;
  const avg = Number(form.expectedAvgWeightKg) || 0;
  const price = Number(form.pricePerKg) || 0;
  const valid = form.buyerId && form.batchId && form.catchDate && birds > 0 && price > 0;

  const submit = async () => {
    try {
      await save.mutateAsync({
        id: booking?.id,
        data: {
          buyerId: Number(form.buyerId),
          batchId: Number(form.batchId),
          catchDate: form.catchDate,
          expectedBirds: birds,
          expectedAvgWeightKg: avg > 0 ? avg : null,
          pricePerKg: price,
          notes: form.notes.trim() || null,
        },
      });
      toast.success(booking ? 'Booking updated' : 'Catch booked');
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not save the booking'));
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{booking ? `Change ${booking.bookingCode}` : 'Book a catch'}</DialogTitle>
          <DialogDescription>Agree the buyer, birds and price now. Weights are taken on the day.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label>Buyer</Label>
            <Select value={form.buyerId} onValueChange={set('buyerId')}>
              <SelectTrigger><SelectValue placeholder="Choose buyer" /></SelectTrigger>
              <SelectContent>{buyers.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.buyerName}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Batch</Label>
            <Select value={form.batchId} onValueChange={set('batchId')}>
              <SelectTrigger><SelectValue placeholder="Choose batch" /></SelectTrigger>
              <SelectContent>{batches.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.batchCode}{b.siteName ? ` · ${b.siteName}` : ''}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bk-date">Catch date</Label>
            <Input id="bk-date" type="date" value={form.catchDate} onChange={(e) => set('catchDate')(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bk-birds">Birds</Label>
            <Input id="bk-birds" type="number" inputMode="numeric" min="1" value={form.expectedBirds} onChange={(e) => set('expectedBirds')(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bk-avg">Expected kg per bird <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="bk-avg" type="number" inputMode="decimal" step="0.01" min="0" value={form.expectedAvgWeightKg} onChange={(e) => set('expectedAvgWeightKg')(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bk-price">Price per kg</Label>
            <Input id="bk-price" type="number" inputMode="decimal" step="0.01" min="0" value={form.pricePerKg} onChange={(e) => set('pricePerKg')(e.target.value)} />
          </div>
          <div className="flex flex-col justify-end rounded-2xl bg-panel p-3 text-sm">
            <span className="text-muted-foreground">Expected value</span>
            <span className="font-bold tabular-nums">{birds && avg && price ? formatCurrency(birds * avg * price) : '—'}</span>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="bk-notes">Notes</Label>
            <Textarea id="bk-notes" value={form.notes} onChange={(e) => set('notes')(e.target.value)} placeholder="e.g. Two lorries, start 5 am" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!valid || save.isPending}>{booking ? 'Save' : 'Book'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
