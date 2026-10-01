import { useResettableState } from '@/lib/useResettableState';
import { useState, type KeyboardEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useSystemConfig, useUpdateSystemConfig } from '@/hooks/useFeed';

const LISTS: Array<{ key: string; title: string; description: string; placeholder: string }> = [
  { key: 'mortality_causes', title: 'Causes of death', description: 'Shown as quick buttons on the daily check.', placeholder: 'e.g. Heat stress' },
  { key: 'feed_types', title: 'Feed types', description: 'Used for recipes, production and dispatch.', placeholder: 'e.g. Pre-starter' },
  { key: 'designations', title: 'Job titles', description: 'Used on employee records.', placeholder: 'e.g. Shed supervisor' },
  { key: 'leave_types', title: 'Leave types', description: 'Used for leave and attendance.', placeholder: 'e.g. Medical' },
];

export interface AlertThresholds {
  mortalityRateWarning: number;
  fcrWarning: number;
  fcrCritical: number;
}

export const DEFAULT_THRESHOLDS: AlertThresholds = { mortalityRateWarning: 5, fcrWarning: 1.8, fcrCritical: 2.2 };

function useConfigValue<T>(key: string, fallback: T) {
  const { data, isLoading } = useSystemConfig();
  const value = data?.data?.find((c) => c.configKey === key)?.configValue as T | undefined;
  return { value: value ?? fallback, isLoading };
}

/** Editable lists used in dropdowns and quick buttons across the app. */
export function ListsSettings({ canEdit }: { canEdit: boolean }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {LISTS.map((list) => <ListCard key={list.key} configKey={list.key} title={list.title} description={list.description} placeholder={list.placeholder} canEdit={canEdit} />)}
    </div>
  );
}

function ListCard({ configKey, title, description, placeholder, canEdit }: { configKey: string; title: string; description: string; placeholder: string; canEdit: boolean }) {
  const { value, isLoading } = useConfigValue<string[]>(configKey, []);
  const update = useUpdateSystemConfig();
  const [items, setItems] = useResettableState(JSON.stringify(value), () => (Array.isArray(value) ? value : []));
  const [draft, setDraft] = useState('');

  const save = async (next: string[]) => {
    const previous = items;
    setItems(next);
    try {
      await update.mutateAsync({ key: configKey, data: { configValue: next } });
    } catch {
      setItems(previous);
      toast.error(`Could not save ${title.toLowerCase()}`);
    }
  };

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    if (items.some((item) => item.toLowerCase() === value.toLowerCase())) {
      toast.error('Already in the list');
      return;
    }
    setDraft('');
    void save([...items, value]);
  };

  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      add();
    }
  };

  return (
    <section className="space-y-3 rounded-3xl border border-border p-5">
      <div>
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {isLoading ? <Skeleton className="h-10 rounded-full" /> : (
        <div className="flex flex-wrap gap-2">
          {items.length === 0 ? <p className="text-sm text-muted-foreground">Nothing yet.</p> : null}
          {items.map((item) => (
            <span key={item} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-muted pl-3.5 pr-1 text-sm font-semibold">
              {item}
              {canEdit ? (
                <button type="button" aria-label={`Remove ${item}`} onClick={() => save(items.filter((i) => i !== item))}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : <span className="w-2" />}
            </span>
          ))}
        </div>
      )}
      {canEdit ? (
        <div className="flex gap-2">
          <Input aria-label={`Add to ${title}`} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} placeholder={placeholder} />
          <Button variant="outline" onClick={add} disabled={!draft.trim() || update.isPending}><Plus className="h-4 w-4" /> Add</Button>
        </div>
      ) : null}
    </section>
  );
}

/** When the app should warn about a batch. */
export function AlertSettings({ canEdit }: { canEdit: boolean }) {
  const { value, isLoading } = useConfigValue<Partial<AlertThresholds>>('alert_thresholds', DEFAULT_THRESHOLDS);
  const update = useUpdateSystemConfig();
  const [form, setForm] = useResettableState<AlertThresholds>(JSON.stringify(value), () => ({ ...DEFAULT_THRESHOLDS, ...(value ?? {}) }));

  if (isLoading) return <Skeleton className="h-48 rounded-3xl" />;

  const fields: Array<{ key: keyof AlertThresholds; label: string; hint: string; step: string }> = [
    { key: 'mortalityRateWarning', label: 'Warn when mortality passes (%)', hint: 'Cumulative deaths as a share of birds placed', step: '0.1' },
    { key: 'fcrWarning', label: 'Warn when FCR passes', hint: 'Feed eaten ÷ weight gained', step: '0.01' },
    { key: 'fcrCritical', label: 'Flag as critical when FCR passes', hint: 'Should be higher than the warning', step: '0.01' },
  ];

  const handleSave = async () => {
    if (form.fcrCritical <= form.fcrWarning) {
      toast.error('The critical FCR must be higher than the warning FCR');
      return;
    }
    try {
      await update.mutateAsync({ key: 'alert_thresholds', data: { configValue: form } });
      toast.success('Alert levels saved');
    } catch {
      toast.error('Could not save alert levels');
    }
  };

  return (
    <section className="max-w-xl space-y-4 rounded-3xl border border-border p-5">
      {fields.map((field) => (
        <div key={field.key} className="grid gap-1.5">
          <Label htmlFor={field.key}>{field.label}</Label>
          <Input id={field.key} type="number" step={field.step} min="0" className="max-w-40" disabled={!canEdit}
            value={form[field.key]} onChange={(e) => setForm((f) => ({ ...f, [field.key]: Number(e.target.value) || 0 }))} />
          <p className="text-[13px] text-muted-foreground">{field.hint}</p>
        </div>
      ))}
      {canEdit ? <Button onClick={handleSave} disabled={update.isPending}>Save alert levels</Button> : null}
    </section>
  );
}
