import { useResettableState } from '@/lib/useResettableState';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useApprovalLimits, useSaveApprovalLimits } from '@/hooks/useApprovals';
import { getApiErrorMessage } from '@/lib/api';

const FIELDS = [
  { key: 'purchaseOrder', label: 'Purchase orders', hint: 'An order this big waits for approval before it goes to the supplier.' },
  { key: 'moneyOut', label: 'Money out', hint: 'A payment this big waits for approval before it leaves the account.' },
] as const;

/** Amounts at or above which a manager must approve. Blank = no approval needed. */
export function ApprovalSettings({ canEdit }: { canEdit: boolean }) {
  const { data, isLoading } = useApprovalLimits();
  const save = useSaveApprovalLimits();
  const limits = data?.data;
  const [form, setForm] = useResettableState(JSON.stringify(limits ?? null), () => ({
    purchaseOrder: limits?.purchaseOrder ? String(limits.purchaseOrder) : '',
    moneyOut: limits?.moneyOut ? String(limits.moneyOut) : '',
  }));

  if (isLoading) return <Skeleton className="h-40 rounded-3xl" />;
  const value = (v: string) => (v.trim() && Number(v) > 0 ? Number(v) : null);

  const submit = async () => {
    try {
      await save.mutateAsync({ purchaseOrder: value(form.purchaseOrder), moneyOut: value(form.moneyOut) });
      toast.success('Approval limits saved');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not save the limits'));
    }
  };

  return (
    <div className="space-y-4 rounded-3xl bg-panel p-5">
      <div>
        <h3 className="font-bold">Approval limits</h3>
        <p className="text-sm text-muted-foreground">People who can approve (Money or Administration admins) are never held up. Leave blank to turn a limit off.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <div key={field.key} className="grid gap-1.5">
            <Label htmlFor={`limit-${field.key}`}>{field.label} from (Rs)</Label>
            <Input id={`limit-${field.key}`} type="number" inputMode="decimal" min="0" placeholder="No limit" disabled={!canEdit}
              value={form[field.key]} onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))} />
            <p className="text-xs text-muted-foreground">{field.hint}</p>
          </div>
        ))}
      </div>
      {canEdit ? <Button onClick={submit} disabled={save.isPending}>Save limits</Button> : null}
    </div>
  );
}
