import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useInventoryItems } from '@/hooks/useInventoryManagement';
import {
  METHOD_LABELS,
  useDueHealthTasks,
  useGrowthStandards,
  useHealthTemplates,
  useSaveGrowthStandard,
  useSaveHealthTemplate,
  useTurnarounds,
  useUpdateTurnaround,
  useVetVisits,
  type GrowthStandard,
  type HealthTemplate,
  type HealthTemplateItem,
  type Turnaround,
} from '@/hooks/useFarmOps';
import { getApiErrorMessage } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

function isoToday() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

const fmtDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '—');

/** Flock health and house readiness across every farm. */
export default function FarmCarePage() {
  const { hasPermission } = useAuthStore();
  const canManage = hasPermission('batches:update');
  const [params, setParams] = useSearchParams();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Health &amp; care</h1>
        <p className="mt-1 text-muted-foreground">Vaccinations due, houses being cleaned, vet visits and the programmes behind them.</p>
      </header>
      <Tabs value={params.get('tab') ?? 'due'} onValueChange={(tab) => setParams({ tab }, { replace: true })}>
        <TabsList className="max-w-full">
          <TabsTrigger value="due">Due now</TabsTrigger>
          <TabsTrigger value="houses">Houses</TabsTrigger>
          <TabsTrigger value="vet">Vet visits</TabsTrigger>
          <TabsTrigger value="programmes">Programmes</TabsTrigger>
          <TabsTrigger value="curves">Growth curves</TabsTrigger>
        </TabsList>
        <TabsContent value="due" className="pt-5"><DueNow /></TabsContent>
        <TabsContent value="houses" className="pt-5"><Houses canManage={canManage} /></TabsContent>
        <TabsContent value="vet" className="pt-5"><AllVetVisits /></TabsContent>
        <TabsContent value="programmes" className="pt-5"><Programmes canManage={canManage} /></TabsContent>
        <TabsContent value="curves" className="pt-5"><Curves canManage={canManage} /></TabsContent>
      </Tabs>
    </div>
  );
}

function DueNow() {
  const { data, isLoading } = useDueHealthTasks();
  const today = isoToday();
  const tasks = data?.data ?? [];
  if (isLoading) return <Skeleton className="h-40 rounded-3xl" />;
  if (tasks.length === 0) {
    return <p className="rounded-3xl bg-success-soft p-6 text-center font-semibold text-success">Nothing due. Every batch is up to date with its health plan.</p>;
  }
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {tasks.map((task) => {
        const overdue = task.dueDate < today;
        return (
          <Link key={task.id} to={`/batches/${task.batchId}/today`}
            className="flex flex-col gap-1 rounded-3xl bg-panel-warm p-5 transition-colors hover:bg-panel-warm/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div className="flex items-start justify-between gap-2">
              <p className="font-bold">{task.name}</p>
              <Badge variant={overdue ? 'danger' : 'warning'}>{overdue ? 'Overdue' : 'Today'}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{task.batchCode} · day {task.dayOfAge}{task.method ? ` · ${METHOD_LABELS[task.method] ?? task.method}` : ''}</p>
            <p className="text-[13px] text-muted-foreground">Due {fmtDate(task.dueDate)}</p>
          </Link>
        );
      })}
    </div>
  );
}

const STEPS: Array<{ key: keyof Turnaround; label: string }> = [
  { key: 'litterRemovedDate', label: 'Old litter out' },
  { key: 'cleanedDate', label: 'Washed' },
  { key: 'disinfectedDate', label: 'Disinfected' },
  { key: 'newLitterDate', label: 'New litter in' },
  { key: 'readyDate', label: 'Ready for chicks' },
];

function Houses({ canManage }: { canManage: boolean }) {
  const { data, isLoading } = useTurnarounds();
  const update = useUpdateTurnaround();
  const rows = data?.data ?? [];
  const active = rows.filter((row) => row.status === 'in_progress');
  const done = rows.filter((row) => row.status === 'ready').slice(0, 10);

  const toggle = async (row: Turnaround, key: keyof Turnaround) => {
    try {
      await update.mutateAsync({ id: row.id, data: { [key]: row[key] ? null : isoToday() } });
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not update the house'));
    }
  };

  if (isLoading) return <Skeleton className="h-40 rounded-3xl" />;
  return (
    <div className="space-y-6">
      {active.length === 0 ? (
        <p className="rounded-3xl border border-dashed p-6 text-center text-sm text-muted-foreground">No houses are being turned around. A house appears here when its batch is sold or closed.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {active.map((row) => (
            <div key={row.id} className="space-y-3 rounded-3xl border border-border p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-bold">{row.siteName} · House {row.cageNumber}</p>
                  <p className="text-sm text-muted-foreground">Emptied {fmtDate(row.startedDate)}{row.previousBatchCode ? ` · after ${row.previousBatchCode}` : ''}</p>
                </div>
                <Badge variant="warning">{row.downtimeDays} days empty</Badge>
              </div>
              <ul className="space-y-1.5">
                {STEPS.map((step) => {
                  const value = row[step.key] as string | null | undefined;
                  const id = `turn-${row.id}-${String(step.key)}`;
                  return (
                    <li key={String(step.key)} className="flex min-h-11 items-center gap-3 rounded-2xl bg-muted/60 px-3">
                      <Checkbox id={id} checked={!!value} disabled={!canManage || update.isPending} onChange={() => toggle(row, step.key)} />
                      <Label htmlFor={id} className="flex-1 font-semibold">{step.label}</Label>
                      <span className="text-sm text-muted-foreground">{value ? fmtDate(value) : ''}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
      {done.length > 0 ? (
        <div>
          <h2 className="mb-2 text-lg font-bold">Recently ready</h2>
          <Table>
            <TableHeader><TableRow><TableHead>House</TableHead><TableHead>Emptied</TableHead><TableHead>Ready</TableHead><TableHead className="text-right">Days empty</TableHead></TableRow></TableHeader>
            <TableBody>
              {done.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-semibold">{row.siteName} · House {row.cageNumber}</TableCell>
                  <TableCell>{fmtDate(row.startedDate)}</TableCell>
                  <TableCell>{fmtDate(row.readyDate)}</TableCell>
                  <TableCell className="text-right">{row.downtimeDays}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}

function AllVetVisits() {
  const { data, isLoading } = useVetVisits();
  const visits = data?.data ?? [];
  if (isLoading) return <Skeleton className="h-40 rounded-3xl" />;
  if (visits.length === 0) return <p className="rounded-3xl border border-dashed p-6 text-center text-sm text-muted-foreground">No vet visits yet. Record them from a batch's Health & growth card.</p>;
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Vet</TableHead><TableHead>Farm / batch</TableHead><TableHead>Diagnosis</TableHead><TableHead className="text-right">Fee</TableHead></TableRow></TableHeader>
      <TableBody>
        {visits.map((visit) => (
          <TableRow key={visit.id}>
            <TableCell>{fmtDate(visit.visitDate)}</TableCell>
            <TableCell className="font-semibold">{visit.vetName}</TableCell>
            <TableCell>{visit.siteName}{visit.batchCode ? <> · <Link className="text-primary hover:underline" to={`/batches/${visit.batchId}`}>{visit.batchCode}</Link></> : null}</TableCell>
            <TableCell className="max-w-xs truncate">{visit.diagnosis ?? visit.reason ?? '—'}</TableCell>
            <TableCell className="text-right">{visit.feeAmount ? formatCurrency(Number(visit.feeAmount)) : '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ─── Programme editor ─────────────────────────────────────────────────────────

type ProgrammeDraft = { id?: number; name: string; description: string; isDefault: boolean; status: 'active' | 'inactive'; items: HealthTemplateItem[] };

function Programmes({ canManage }: { canManage: boolean }) {
  const { data, isLoading } = useHealthTemplates();
  const save = useSaveHealthTemplate();
  const stock = useInventoryItems({ category: 'health', page: 1, limit: 200 });
  const [draft, setDraft] = useState<ProgrammeDraft | null>(null);
  const templates = data?.data ?? [];

  const edit = (template?: HealthTemplate) => setDraft(template
    ? { id: template.id, name: template.name, description: template.description ?? '', isDefault: template.isDefault, status: template.status, items: template.items.map((item) => ({ ...item })) }
    : { name: '', description: '', isDefault: false, status: 'active', items: [{ dayOfAge: 7, taskType: 'vaccination', name: '', method: 'drinking_water' }] });

  const setItem = (index: number, patch: Partial<HealthTemplateItem>) =>
    setDraft((d) => d && ({ ...d, items: d.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) }));

  const handleSave = async () => {
    if (!draft) return;
    try {
      await save.mutateAsync({
        id: draft.id,
        data: {
          name: draft.name.trim(),
          description: draft.description.trim() || null,
          isDefault: draft.isDefault,
          status: draft.status,
          items: draft.items.filter((item) => item.name.trim()).map((item) => ({
            dayOfAge: Number(item.dayOfAge),
            taskType: item.taskType,
            name: item.name.trim(),
            method: item.method ?? null,
            inventoryItemId: item.inventoryItemId ?? null,
            dosePer1000Birds: item.dosePer1000Birds ? Number(item.dosePer1000Birds) : null,
            notes: item.notes ?? null,
          })),
        },
      });
      toast.success('Programme saved. New batches will use it; apply it to existing batches from their page.');
      setDraft(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not save the programme'));
    }
  };

  if (isLoading) return <Skeleton className="h-40 rounded-3xl" />;
  return (
    <div className="space-y-4">
      {canManage ? <Button onClick={() => edit()}><Plus className="h-4 w-4" /> New programme</Button> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {templates.map((template) => (
          <div key={template.id} className="space-y-3 rounded-3xl border border-border p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-bold">{template.name}</p>
                {template.description ? <p className="text-sm text-muted-foreground">{template.description}</p> : null}
              </div>
              <div className="flex shrink-0 gap-1.5">
                {template.isDefault ? <Badge variant="info">Default</Badge> : null}
                {template.status !== 'active' ? <Badge variant="secondary">Inactive</Badge> : null}
              </div>
            </div>
            <ol className="space-y-1">
              {template.items.map((item) => (
                <li key={item.id} className="flex gap-3 text-sm">
                  <span className="w-14 shrink-0 font-bold">Day {item.dayOfAge}</span>
                  <span className="flex-1">{item.name}{item.method ? <span className="text-muted-foreground"> · {METHOD_LABELS[item.method]}</span> : null}</span>
                </li>
              ))}
            </ol>
            {canManage ? <Button variant="outline" size="sm" onClick={() => edit(template)}>Edit</Button> : null}
          </div>
        ))}
      </div>

      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? 'Edit programme' : 'New programme'}</DialogTitle>
            <DialogDescription>Days are counted from placement. Doses per 1,000 birds let each batch's quantity be worked out automatically.</DialogDescription>
          </DialogHeader>
          {draft ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2"><Label htmlFor="prog-name">Name</Label><Input id="prog-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
                <div className="flex items-end gap-2 pb-2">
                  <Checkbox id="prog-default" checked={draft.isDefault} onChange={(e) => setDraft({ ...draft, isDefault: (e.target as HTMLInputElement).checked })} />
                  <Label htmlFor="prog-default">Use for new batches</Label>
                </div>
              </div>
              <div className="grid gap-2"><Label htmlFor="prog-desc">Description</Label><Textarea id="prog-desc" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
              <div className="space-y-2">
                {draft.items.map((item, index) => (
                  <div key={index} className="grid gap-2 rounded-2xl bg-muted/60 p-3 sm:grid-cols-[4.5rem_minmax(0,1fr)_9rem_auto]">
                    <Input aria-label="Day of age" inputMode="numeric" value={item.dayOfAge} onChange={(e) => setItem(index, { dayOfAge: Number(e.target.value.replace(/\D/g, '')) || 0 })} />
                    <Input aria-label="Vaccine or treatment" placeholder="Vaccine or treatment" value={item.name} onChange={(e) => setItem(index, { name: e.target.value })} />
                    <Select value={item.method ?? 'other'} onValueChange={(value) => setItem(index, { method: value as HealthTemplateItem['method'] })}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(METHOD_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" aria-label="Remove row" onClick={() => setDraft({ ...draft, items: draft.items.filter((_, i) => i !== index) })}><Trash2 className="h-4 w-4" /></Button>
                    <Select value={item.taskType} onValueChange={(value) => setItem(index, { taskType: value as HealthTemplateItem['taskType'] })}>
                      <SelectTrigger className="w-full sm:col-span-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vaccination">Vaccine</SelectItem>
                        <SelectItem value="medication">Medication</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={item.inventoryItemId ? String(item.inventoryItemId) : 'none'} onValueChange={(value) => setItem(index, { inventoryItemId: value === 'none' ? null : Number(value) })}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Stock item (optional)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No stock item</SelectItem>
                        {(stock.data?.data ?? []).map((stockItem) => <SelectItem key={stockItem.id} value={String(stockItem.id)}>{stockItem.ingredientName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input aria-label="Dose per 1,000 birds" placeholder="Per 1,000 birds" inputMode="decimal" value={item.dosePer1000Birds ?? ''}
                      onChange={(e) => setItem(index, { dosePer1000Birds: e.target.value.replace(/[^0-9.]/g, '') })} disabled={!item.inventoryItemId} />
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setDraft({ ...draft, items: [...draft.items, { dayOfAge: 0, taskType: 'vaccination', name: '', method: 'drinking_water' }] })}>
                  <Plus className="h-4 w-4" /> Add a day
                </Button>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!draft?.name.trim() || save.isPending}>Save programme</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Growth curve editor ──────────────────────────────────────────────────────

type CurveDraft = { id?: number; name: string; breed: string; notes: string; isDefault: boolean; points: Array<{ dayOfAge: string; targetWeightG: string; targetCumFeedG: string; targetCumMortalityPct: string }> };

function Curves({ canManage }: { canManage: boolean }) {
  const { data, isLoading } = useGrowthStandards();
  const save = useSaveGrowthStandard();
  const [draft, setDraft] = useState<CurveDraft | null>(null);
  const standards = data?.data ?? [];

  const edit = (standard?: GrowthStandard) => setDraft(standard
    ? {
        id: standard.id, name: standard.name, breed: standard.breed ?? '', notes: standard.notes ?? '', isDefault: standard.isDefault,
        points: standard.points.map((p) => ({ dayOfAge: String(p.dayOfAge), targetWeightG: String(p.targetWeightG), targetCumFeedG: p.targetCumFeedG != null ? String(p.targetCumFeedG) : '', targetCumMortalityPct: p.targetCumMortalityPct != null ? String(Number(p.targetCumMortalityPct)) : '' })),
      }
    : { name: '', breed: '', notes: '', isDefault: false, points: [0, 7, 14, 21, 28, 35, 42].map((day) => ({ dayOfAge: String(day), targetWeightG: '', targetCumFeedG: '', targetCumMortalityPct: '' })) });

  const handleSave = async () => {
    if (!draft) return;
    try {
      await save.mutateAsync({
        id: draft.id,
        data: {
          name: draft.name.trim(),
          breed: draft.breed.trim() || null,
          notes: draft.notes.trim() || null,
          isDefault: draft.isDefault,
          status: 'active',
          points: draft.points.filter((p) => p.targetWeightG).map((p) => ({
            dayOfAge: Number(p.dayOfAge),
            targetWeightG: Number(p.targetWeightG),
            targetCumFeedG: p.targetCumFeedG ? Number(p.targetCumFeedG) : null,
            targetCumMortalityPct: p.targetCumMortalityPct ? Number(p.targetCumMortalityPct) : null,
          })),
        },
      });
      toast.success('Growth curve saved');
      setDraft(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not save the curve'));
    }
  };

  const setPoint = (index: number, key: keyof CurveDraft['points'][number], value: string) =>
    setDraft((d) => d && ({ ...d, points: d.points.map((p, i) => (i === index ? { ...p, [key]: value.replace(/[^0-9.]/g, '') } : p)) }));

  if (isLoading) return <Skeleton className="h-40 rounded-3xl" />;
  return (
    <div className="space-y-4">
      {canManage ? <Button onClick={() => edit()}><Plus className="h-4 w-4" /> New growth curve</Button> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {standards.map((standard) => (
          <div key={standard.id} className="space-y-3 rounded-3xl border border-border p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-bold">{standard.name}</p>
                <p className="text-sm text-muted-foreground">{standard.breed ?? 'Breed not set'}</p>
              </div>
              {standard.isDefault ? <Badge variant="info">Default</Badge> : null}
            </div>
            {standard.notes ? <p className="text-sm text-muted-foreground">{standard.notes}</p> : null}
            <div className="flex flex-wrap gap-2">
              {standard.points.map((p) => (
                <span key={p.dayOfAge} className="rounded-full bg-muted px-3 py-1 text-sm"><span className="font-bold">D{p.dayOfAge}</span> {p.targetWeightG.toLocaleString()} g</span>
              ))}
            </div>
            {canManage ? <Button variant="outline" size="sm" onClick={() => edit(standard)}>Edit</Button> : null}
          </div>
        ))}
      </div>

      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? 'Edit growth curve' : 'New growth curve'}</DialogTitle>
            <DialogDescription>Copy the figures from your chick supplier's breed performance guide. Days in between are worked out automatically.</DialogDescription>
          </DialogHeader>
          {draft ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2"><Label htmlFor="curve-name">Name</Label><Input id="curve-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
                <div className="grid gap-2"><Label htmlFor="curve-breed">Breed</Label><Input id="curve-breed" value={draft.breed} onChange={(e) => setDraft({ ...draft, breed: e.target.value })} placeholder="e.g. Cobb 500, Ross 308" /></div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="curve-default" checked={draft.isDefault} onChange={(e) => setDraft({ ...draft, isDefault: (e.target as HTMLInputElement).checked })} />
                <Label htmlFor="curve-default">Use for new batches</Label>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Day</TableHead><TableHead>Weight (g)</TableHead><TableHead>Feed eaten to date (g/bird)</TableHead><TableHead>Mortality to date (%)</TableHead></TableRow></TableHeader>
                <TableBody>
                  {draft.points.map((p, index) => (
                    <TableRow key={index}>
                      <TableCell><Input aria-label="Day" className="w-20" inputMode="numeric" value={p.dayOfAge} onChange={(e) => setPoint(index, 'dayOfAge', e.target.value)} /></TableCell>
                      <TableCell><Input aria-label="Weight" inputMode="numeric" value={p.targetWeightG} onChange={(e) => setPoint(index, 'targetWeightG', e.target.value)} /></TableCell>
                      <TableCell><Input aria-label="Feed to date" inputMode="numeric" value={p.targetCumFeedG} onChange={(e) => setPoint(index, 'targetCumFeedG', e.target.value)} /></TableCell>
                      <TableCell><Input aria-label="Mortality to date" inputMode="decimal" value={p.targetCumMortalityPct} onChange={(e) => setPoint(index, 'targetCumMortalityPct', e.target.value)} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button variant="outline" size="sm" onClick={() => setDraft({ ...draft, points: [...draft.points, { dayOfAge: '', targetWeightG: '', targetCumFeedG: '', targetCumMortalityPct: '' }] })}>
                <Plus className="h-4 w-4" /> Add a day
              </Button>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!draft?.name.trim() || save.isPending}>Save curve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
