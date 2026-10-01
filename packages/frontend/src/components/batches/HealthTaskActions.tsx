import { useState } from 'react';
import { Check, SkipForward } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useInventoryItems } from '@/hooks/useInventoryManagement';
import { useCompleteHealthTask, useSkipHealthTask, type BatchHealthTask } from '@/hooks/useFarmOps';
import { getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

const NONE = 'none';

/** "Done" (records the vaccination and takes the stock) and "Skip" for one health task. */
export function HealthTaskActions({ task, defaultDate, className }: { task: BatchHealthTask; defaultDate: string; className?: string }) {
  const [mode, setMode] = useState<'done' | 'skip' | null>(null);
  const [date, setDate] = useState(defaultDate);
  const [itemId, setItemId] = useState(task.inventoryItemId ? String(task.inventoryItemId) : NONE);
  const [quantity, setQuantity] = useState(task.plannedQuantity ? String(Number(task.plannedQuantity)) : '');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const complete = useCompleteHealthTask();
  const skip = useSkipHealthTask();
  const stock = useInventoryItems({ category: 'health', page: 1, limit: 200 });
  const items = (stock.data?.data ?? []).filter((item) => item.allowsBatchAllocation && !item.isFeed);
  const selected = items.find((item) => String(item.id) === itemId);

  const handleDone = async () => {
    try {
      await complete.mutateAsync({
        taskId: task.id,
        completedDate: date,
        inventoryItemId: itemId !== NONE ? Number(itemId) : null,
        quantityUsed: itemId !== NONE && quantity ? Number(quantity) : null,
        notes: notes.trim() || null,
      });
      toast.success(`${task.name} recorded`);
      setMode(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not record the task'));
    }
  };

  const handleSkip = async () => {
    try {
      await skip.mutateAsync({ taskId: task.id, reason: reason.trim() });
      toast.success('Task skipped');
      setMode(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not skip the task'));
    }
  };

  return (
    <>
      <div className={cn('flex gap-2', className)}>
        <Button className="flex-1" onClick={() => setMode('done')}><Check className="h-4 w-4" /> Done</Button>
        <Button variant="outline" onClick={() => setMode('skip')}><SkipForward className="h-4 w-4" /> Skip</Button>
      </div>

      <Dialog open={mode === 'done'} onOpenChange={(open) => !open && setMode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{task.name}</DialogTitle>
            <DialogDescription>Record that it was given. Stock used is taken from the store and charged to this batch.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor={`done-date-${task.id}`}>Date given</Label>
              <Input id={`done-date-${task.id}`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Stock used</Label>
              <Select value={itemId} onValueChange={setItemId}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None from our store</SelectItem>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.ingredientName} · {Number(item.quantity).toLocaleString()} {item.unit} in stock
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {itemId !== NONE ? (
              <div className="grid gap-2">
                <Label htmlFor={`done-qty-${task.id}`}>Quantity{selected ? ` (${selected.unit})` : ''}</Label>
                <Input id={`done-qty-${task.id}`} inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/[^0-9.]/g, ''))} />
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor={`done-notes-${task.id}`}>Notes (optional)</Label>
              <Textarea id={`done-notes-${task.id}`} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>Cancel</Button>
            <Button onClick={handleDone} disabled={complete.isPending || (itemId !== NONE && !quantity)}>
              {complete.isPending ? 'Saving…' : 'Mark as done'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mode === 'skip'} onOpenChange={(open) => !open && setMode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Skip {task.name}?</DialogTitle>
            <DialogDescription>Say why, so the batch record explains it later.</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Given at the hatchery" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>Cancel</Button>
            <Button onClick={handleSkip} disabled={skip.isPending || !reason.trim()}>Skip task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
