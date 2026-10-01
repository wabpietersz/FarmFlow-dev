import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Minus, Plus, Syringe, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { HealthTaskActions } from '@/components/batches/HealthTaskActions';
import { useOnlineStatus } from '@/hooks/useOffline';
import { METHOD_LABELS, useSaveTodayCheck, useTodayCheck } from '@/hooks/useFarmOps';
import { getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

const CAUSES = ['Heat', 'Leg problems', 'Respiratory', 'Crushed', 'Unknown'];

function isoToday() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type Form = { deaths: number; cause: string; feed: string; water: string; weight: string; temperature: string; humidity: string; notes: string };
const EMPTY: Form = { deaths: 0, cause: '', feed: '', water: '', weight: '', temperature: '', humidity: '', notes: '' };

/** The farm manager's daily check: one screen, big targets, works on a phone and without signal. */
export default function TodayCheckPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const [date, setDate] = useState(isoToday());
  const { data, isLoading, error } = useTodayCheck(id, date);
  const save = useSaveTodayCheck(id!);
  const [form, setForm] = useState<Form>(EMPTY);
  const [showMore, setShowMore] = useState(false);

  const check = data?.data;

  useEffect(() => {
    const record = check?.record;
    setForm(record
      ? {
          deaths: record.mortalityCount,
          cause: record.mortalityCause ?? '',
          feed: record.feedConsumption ? String(Number(record.feedConsumption)) : '',
          water: record.waterConsumption ? String(Number(record.waterConsumption)) : '',
          weight: record.averageWeight ? String(Number(record.averageWeight)) : '',
          temperature: record.temperature ? String(Number(record.temperature)) : '',
          humidity: record.humidity != null ? String(record.humidity) : '',
          notes: record.notes ?? '',
        }
      : EMPTY);
  }, [check?.record, check?.date]);

  const filled = useMemo(() => [form.feed, form.water, form.weight, form.temperature].filter(Boolean).length + 1, [form]);
  const progress = Math.round((filled / 5) * 100);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Skeleton className="h-24 rounded-3xl" />
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-3xl" />)}
      </div>
    );
  }
  if (error || !check) {
    return <p className="mx-auto max-w-xl rounded-2xl bg-danger-soft p-4 text-sm font-medium text-danger">{getApiErrorMessage(error, 'Could not load today\'s check.')}</p>;
  }

  const prev = check.previous;
  const closed = check.batch.status === 'closed';
  const set = (key: keyof Form) => (value: string | number) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!form.feed) {
      toast.error('Enter the feed used today (0 if none)');
      return;
    }
    try {
      const result = await save.mutateAsync({
        batchCode: check.batch.batchCode,
        date,
        mortalityCount: form.deaths,
        mortalityCause: form.deaths > 0 ? form.cause || null : null,
        feedConsumption: Number(form.feed),
        waterConsumption: form.water ? Number(form.water) : null,
        averageWeight: form.weight ? Number(form.weight) : null,
        temperature: form.temperature ? Number(form.temperature) : null,
        humidity: form.humidity ? Number(form.humidity) : null,
        notes: form.notes.trim() || null,
      });
      if (!result.queued) toast.success('Check saved');
      navigate(`/batches/${id}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save the check'));
    }
  };

  return (
    <div className="mx-auto max-w-xl pb-28">
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <Link to={`/batches/${id}`} aria-label="Back to batch" className="flex h-11 w-11 items-center justify-center rounded-full bg-panel text-foreground">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <span className="rounded-full bg-secondary px-3.5 py-1.5 text-sm font-bold text-secondary-foreground">Day {check.dayOfAge}</span>
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">{date === isoToday() ? 'Today\'s check' : 'Daily check'}</h1>
          <p className="mt-0.5 text-[15px] text-muted-foreground">
            {check.batch.batchCode} · {check.batch.siteName} · {check.liveBirdsAtStart.toLocaleString()} birds this morning
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setDate(shiftDate(date, -1))}>Previous day</Button>
          {date !== isoToday() ? <Button variant="outline" size="sm" onClick={() => setDate(isoToday())}>Today</Button> : null}
          <span className="ml-auto text-sm font-semibold text-muted-foreground">{new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Check completed">
          <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </header>

      {!online ? (
        <p className="mt-4 flex items-center gap-2 rounded-2xl bg-warning-soft p-3 text-sm font-semibold text-warning">
          <WifiOff className="h-4 w-4" /> No signal. Your check will be saved on this phone and sent later.
        </p>
      ) : null}
      {check.record ? (
        <p className="mt-4 rounded-2xl bg-info-soft p-3 text-sm font-semibold text-info">Already recorded for this day. Saving will update it.</p>
      ) : null}

      <div className="mt-4 space-y-3">
        <section className={cn('rounded-3xl p-4', form.deaths > 0 ? 'bg-panel' : 'border border-border')}>
          <label htmlFor="deaths" className="text-sm font-semibold text-muted-foreground">Deaths</label>
          <div className="mt-2 flex items-center gap-3">
            <button type="button" aria-label="One fewer" onClick={() => set('deaths')(Math.max(0, form.deaths - 1))}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-foreground active:scale-95">
              <Minus className="h-6 w-6" />
            </button>
            <input id="deaths" inputMode="numeric" value={form.deaths}
              onChange={(e) => set('deaths')(Math.max(0, Number(e.target.value.replace(/\D/g, '')) || 0))}
              className="h-14 min-w-0 flex-1 rounded-2xl border border-border bg-card text-center text-3xl font-extrabold tabular-nums text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <button type="button" aria-label="One more" onClick={() => set('deaths')(form.deaths + 1)}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-foreground active:scale-95">
              <Plus className="h-6 w-6" />
            </button>
          </div>
          {form.deaths > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Main cause">
              {CAUSES.map((cause) => (
                <button key={cause} type="button" aria-pressed={form.cause === cause} onClick={() => set('cause')(form.cause === cause ? '' : cause)}
                  className={cn('min-h-10 rounded-full px-4 text-sm font-semibold transition-colors',
                    form.cause === cause ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-foreground')}>
                  {cause}
                </button>
              ))}
            </div>
          ) : null}
          <p className="mt-2 text-[13px] text-muted-foreground">
            {prev ? `Yesterday ${prev.mortalityCount}${prev.mortalityCause ? ` · ${prev.mortalityCause}` : ''}` : 'First record for this batch'}
          </p>
        </section>

        <NumberRow id="feed" label="Feed used" unit="kg" value={form.feed} onChange={set('feed')}
          hint={prev ? `Yesterday ${Number(prev.feedConsumption).toLocaleString()} kg` : undefined} required />
        <NumberRow id="water" label="Water" unit="L" value={form.water} onChange={set('water')}
          hint={prev?.waterConsumption ? `Yesterday ${Number(prev.waterConsumption).toLocaleString()} L` : undefined} />
        <NumberRow id="weight" label="Average weight" unit="g" value={form.weight} onChange={set('weight')}
          hint={check.targets.weightG ? `Target ${check.targets.weightG.toLocaleString()} g` : undefined} />
        <NumberRow id="temperature" label="House temperature" unit="°C" value={form.temperature} onChange={set('temperature')}
          hint={prev?.temperature ? `Yesterday ${Number(prev.temperature)} °C` : undefined} />

        {showMore ? (
          <div className="space-y-3">
            <NumberRow id="humidity" label="Humidity" unit="%" value={form.humidity} onChange={set('humidity')} />
            <div className="rounded-3xl border border-border p-4">
              <label htmlFor="notes" className="text-sm font-semibold text-muted-foreground">Notes</label>
              <Textarea id="notes" value={form.notes} onChange={(e) => set('notes')(e.target.value)} placeholder="Anything unusual today?" className="mt-2" />
            </div>
          </div>
        ) : (
          <Button variant="ghost" className="w-full" onClick={() => setShowMore(true)}>Add humidity or notes</Button>
        )}

        {check.dueTasks.length > 0 ? (
          <section aria-label="Health tasks due" className="space-y-2">
            {check.dueTasks.map((task) => (
              <div key={task.id} className="rounded-3xl bg-panel-warm p-4">
                <div className="flex items-start gap-3">
                  <Syringe className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{task.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {task.dueDate < date ? `Overdue since day ${task.dayOfAge}` : 'Due today'}
                      {task.method ? ` · ${METHOD_LABELS[task.method] ?? task.method}` : ''}
                    </p>
                  </div>
                </div>
                {!closed ? <HealthTaskActions task={task} defaultDate={date} className="mt-3" /> : null}
              </div>
            ))}
          </section>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-30 px-4 md:bottom-6">
        <div className="mx-auto max-w-xl">
          <Button size="lg" className="w-full shadow-lg" onClick={handleSave} disabled={save.isPending || closed}>
            {closed ? 'Batch is closed' : save.isPending ? 'Saving…' : check.record ? 'Update check' : 'Save check'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function NumberRow({ id, label, unit, value, onChange, hint, required }: {
  id: string; label: string; unit: string; value: string; onChange: (value: string) => void; hint?: string; required?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-3 rounded-3xl p-4', value ? 'bg-panel' : 'border border-border')}>
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-sm font-semibold text-muted-foreground">{label}{required ? ' *' : ''}</label>
        <div className="flex items-baseline gap-1.5">
          <input id={id} inputMode="decimal" value={value} placeholder="Enter"
            onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
            className="w-full min-w-0 bg-transparent text-[28px] font-extrabold tabular-nums text-foreground outline-none placeholder:text-muted-foreground/60" />
          <span className="text-sm font-semibold text-muted-foreground">{unit}</span>
        </div>
      </div>
      {hint ? <span className="max-w-[40%] text-right text-[13px] text-muted-foreground">{hint}</span> : null}
    </div>
  );
}
