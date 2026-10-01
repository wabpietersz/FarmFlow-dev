import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useSaveStatutoryRates, useStatutoryRates } from '@/hooks/usePayroll';
import { getApiErrorMessage } from '@/lib/api';

const FIELDS = [
  { key: 'epfEmployeeRate', label: 'Employee EPF', hint: 'Deducted from pay' },
  { key: 'epfEmployerRate', label: 'Employer EPF', hint: 'Paid by the business' },
  { key: 'etfEmployerRate', label: 'Employer ETF', hint: 'Paid by the business' },
] as const;

/** EPF/ETF rates. New payrolls use them; payrolls already made keep the rates they were made with. */
export function PayrollSettings({ canEdit }: { canEdit: boolean }) {
  const { data, isLoading } = useStatutoryRates();
  const save = useSaveStatutoryRates();
  const [form, setForm] = useState({ epfEmployeeRate: '8', epfEmployerRate: '12', etfEmployerRate: '3' });

  useEffect(() => {
    const rates = data?.data;
    if (rates) setForm({ epfEmployeeRate: String(rates.epfEmployeeRate), epfEmployerRate: String(rates.epfEmployerRate), etfEmployerRate: String(rates.etfEmployerRate) });
  }, [data]);

  if (isLoading) return <Skeleton className="h-40 rounded-3xl" />;
  const values = { epfEmployeeRate: Number(form.epfEmployeeRate), epfEmployerRate: Number(form.epfEmployerRate), etfEmployerRate: Number(form.etfEmployerRate) };
  const valid = Object.values(values).every((n) => Number.isFinite(n) && n >= 0 && n <= 100);

  const submit = async () => {
    try {
      await save.mutateAsync(values);
      toast.success('EPF/ETF rates saved. New payrolls will use them.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not save the rates'));
    }
  };

  return (
    <div className="space-y-4 rounded-3xl bg-panel p-5">
      <div>
        <h3 className="font-bold">EPF / ETF rates</h3>
        <p className="text-sm text-muted-foreground">Worked out on basic salary plus allowances marked "counts for EPF". Payrolls already made keep the rates they were made with.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {FIELDS.map((field) => (
          <div key={field.key} className="grid gap-1.5">
            <Label htmlFor={`rate-${field.key}`}>{field.label}</Label>
            <div className="relative">
              <Input id={`rate-${field.key}`} type="number" inputMode="decimal" min="0" max="100" step="0.5" disabled={!canEdit}
                value={form[field.key]} onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))} className="pr-8" />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
            </div>
            <p className="text-xs text-muted-foreground">{field.hint}</p>
          </div>
        ))}
      </div>
      {canEdit ? <Button onClick={submit} disabled={!valid || save.isPending}>Save rates</Button> : null}
    </div>
  );
}
