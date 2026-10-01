import { useState } from 'react';
import { CalendarPlus, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { HealthTaskActions } from '@/components/batches/HealthTaskActions';
import {
  METHOD_LABELS,
  useAddHealthTask,
  useApplyHealthTemplate,
  useBatchHealthTasks,
  useGrowthComparison,
  useHealthTemplates,
  useSaveVetVisit,
  useVetVisits,
  type BatchHealthTask,
} from '@/hooks/useFarmOps';
import { getApiErrorMessage } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

function isoToday() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function taskState(task: BatchHealthTask, today: string): { label: string; variant: 'success' | 'warning' | 'danger' | 'secondary' | 'outline' } {
  if (task.status === 'done') return { label: 'Done', variant: 'success' };
  if (task.status === 'skipped') return { label: 'Skipped', variant: 'secondary' };
  if (task.dueDate < today) return { label: 'Overdue', variant: 'danger' };
  if (task.dueDate === today) return { label: 'Due today', variant: 'warning' };
  return { label: 'Planned', variant: 'outline' };
}

/** Everything about the flock's care on one card: health plan, growth vs target, vet visits. */
export function BatchCarePanel({ batchId, siteId, canManage, isOpen }: { batchId: string; siteId: number; canManage: boolean; isOpen: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Health & growth</CardTitle>
        <CardDescription>The vaccination plan, how the birds are growing against target, and vet visits.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="plan">
          <TabsList>
            <TabsTrigger value="plan">Health plan</TabsTrigger>
            <TabsTrigger value="growth">Growth</TabsTrigger>
            <TabsTrigger value="vet">Vet visits</TabsTrigger>
          </TabsList>
          <TabsContent value="plan" className="pt-4"><HealthPlan batchId={batchId} canManage={canManage} isOpen={isOpen} /></TabsContent>
          <TabsContent value="growth" className="pt-4"><Growth batchId={batchId} /></TabsContent>
          <TabsContent value="vet" className="pt-4"><VetVisits batchId={batchId} siteId={siteId} canManage={canManage} /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function HealthPlan({ batchId, canManage, isOpen }: { batchId: string; canManage: boolean; isOpen: boolean }) {
  const { data, isLoading } = useBatchHealthTasks(batchId);
  const templates = useHealthTemplates();
  const apply = useApplyHealthTemplate(batchId);
  const addTask = useAddHealthTask(batchId);
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({ dueDate: isoToday(), name: '', taskType: 'medication' as const, method: 'drinking_water' });
  const today = isoToday();
  const tasks = data?.data ?? [];

  const handleApply = async (templateId: string) => {
    if (!window.confirm('Replace the planned (not yet done) programme tasks with this programme?')) return;
    try {
      await apply.mutateAsync(Number(templateId));
      toast.success('Health programme applied');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not apply the programme'));
    }
  };

  const handleAdd = async () => {
    try {
      await addTask.mutateAsync({ ...draft, taskType: draft.taskType });
      toast.success('Task added');
      setShowAdd(false);
      setDraft({ dueDate: isoToday(), name: '', taskType: 'medication', method: 'drinking_water' });
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not add the task'));
    }
  };

  if (isLoading) return <Skeleton className="h-40 rounded-2xl" />;

  return (
    <div className="space-y-3">
      {canManage && isOpen ? (
        <div className="flex flex-wrap gap-2">
          <Select onValueChange={handleApply}>
            <SelectTrigger className="w-full sm:w-72"><SelectValue placeholder="Apply a health programme…" /></SelectTrigger>
            <SelectContent>
              {(templates.data?.data ?? []).filter((t) => t.status === 'active').map((template) => (
                <SelectItem key={template.id} value={String(template.id)}>{template.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setShowAdd(true)}><CalendarPlus className="h-4 w-4" /> Add a task</Button>
        </div>
      ) : null}

      {tasks.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">No health plan for this batch yet. Apply a programme to schedule its vaccinations.</p>
      ) : (
        <ol className="space-y-2">
          {tasks.map((task) => {
            const state = taskState(task, today);
            const actionable = isOpen && task.status === 'pending' && task.dueDate <= today;
            return (
              <li key={task.id} className="rounded-2xl border border-border p-3.5">
                <div className="flex flex-wrap items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-muted text-center leading-none">
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">Day</span>
                    <span className="text-base font-extrabold">{task.dayOfAge}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{task.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(task.dueDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                      {task.method ? ` · ${METHOD_LABELS[task.method] ?? task.method}` : ''}
                      {task.plannedQuantity && task.inventoryItemName ? ` · ${Number(task.plannedQuantity).toLocaleString()} ${task.inventoryUnit ?? ''} ${task.inventoryItemName}` : ''}
                    </p>
                    {task.status === 'done' && task.completedDate ? (
                      <p className="text-[13px] text-muted-foreground">Given {new Date(task.completedDate).toLocaleDateString()}{task.completedByName ? ` by ${task.completedByName}` : ''}</p>
                    ) : null}
                    {task.status === 'skipped' && task.skipReason ? <p className="text-[13px] text-muted-foreground">Skipped: {task.skipReason}</p> : null}
                  </div>
                  <Badge variant={state.variant}>{state.label}</Badge>
                </div>
                {actionable ? <HealthTaskActions task={task} defaultDate={today} className="mt-3" /> : null}
              </li>
            );
          })}
        </ol>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a health task</DialogTitle>
            <DialogDescription>For a treatment or vaccine that isn't in the programme.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="task-name">What</Label>
              <Input id="task-name" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. Antibiotic course (vet advised)" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="task-date">Due</Label>
                <Input id="task-date" type="date" value={draft.dueDate} onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select value={draft.taskType} onValueChange={(value: 'medication') => setDraft((d) => ({ ...d, taskType: value }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vaccination">Vaccination</SelectItem>
                    <SelectItem value="medication">Medication</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>How</Label>
              <Select value={draft.method} onValueChange={(value) => setDraft((d) => ({ ...d, method: value }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(METHOD_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!draft.name.trim() || addTask.isPending}>Add task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Growth({ batchId }: { batchId: string }) {
  const { data, isLoading } = useGrowthComparison(batchId);
  const growth = data?.data;
  if (isLoading) return <Skeleton className="h-72 rounded-2xl" />;
  if (!growth || growth.series.length === 0) {
    return <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">No daily checks yet. Growth appears here once weights are recorded.</p>;
  }
  const latest = growth.latest;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-muted-foreground">Compared with <span className="font-semibold text-foreground">{growth.standard?.name ?? 'no growth curve'}</span></p>
        {latest ? (
          <Badge variant={latest.weightVsTargetPct >= -5 ? 'success' : 'warning'}>
            Day {latest.dayOfAge}: {latest.actualWeightG?.toLocaleString()} g vs {latest.targetWeightG?.toLocaleString()} g target ({latest.weightVsTargetPct > 0 ? '+' : ''}{latest.weightVsTargetPct}%)
          </Badge>
        ) : null}
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={growth.series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="dayOfAge" tickFormatter={(day) => `D${day}`} fontSize={12} />
            <YAxis fontSize={12} width={48} tickFormatter={(g) => `${(g / 1000).toFixed(1)}kg`} />
            <Tooltip formatter={(value, name) => [`${Number(value ?? 0).toLocaleString()} g`, name]} labelFormatter={(day) => `Day ${day}`} />
            <Legend />
            <Line type="monotone" dataKey="targetWeightG" name="Target weight" stroke="var(--chart-5)" strokeDasharray="6 4" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="actualWeightG" name="Actual weight" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={growth.series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="dayOfAge" tickFormatter={(day) => `D${day}`} fontSize={12} />
            <YAxis fontSize={12} width={48} tickFormatter={(pct) => `${pct}%`} />
            <Tooltip formatter={(value, name) => [`${value ?? 0}%`, name]} labelFormatter={(day) => `Day ${day}`} />
            <Legend />
            <Line type="monotone" dataKey="targetCumMortalityPct" name="Target mortality" stroke="var(--chart-5)" strokeDasharray="6 4" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="actualCumMortalityPct" name="Mortality" stroke="var(--chart-2)" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function VetVisits({ batchId, siteId, canManage }: { batchId: string; siteId: number; canManage: boolean }) {
  const { data, isLoading } = useVetVisits({ batchId: Number(batchId) });
  const save = useSaveVetVisit();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ visitDate: isoToday(), vetName: '', reason: '', findings: '', diagnosis: '', treatment: '', feeAmount: '', followUpDate: '' });
  const visits = data?.data ?? [];

  const handleSave = async () => {
    try {
      await save.mutateAsync({
        data: {
          siteId,
          batchId: Number(batchId),
          visitDate: form.visitDate,
          vetName: form.vetName.trim(),
          reason: form.reason || null,
          findings: form.findings || null,
          diagnosis: form.diagnosis || null,
          treatment: form.treatment || null,
          feeAmount: form.feeAmount ? Number(form.feeAmount) : null,
          followUpDate: form.followUpDate || null,
        },
      });
      toast.success('Vet visit recorded');
      setOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not save the visit'));
    }
  };

  if (isLoading) return <Skeleton className="h-32 rounded-2xl" />;

  return (
    <div className="space-y-3">
      {canManage ? <Button variant="outline" onClick={() => setOpen(true)}><Stethoscope className="h-4 w-4" /> Record a vet visit</Button> : null}
      {visits.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">No vet visits recorded for this batch.</p>
      ) : visits.map((visit) => (
        <div key={visit.id} className="space-y-1 rounded-2xl border border-border p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-bold">{visit.vetName}{visit.reason ? ` · ${visit.reason}` : ''}</p>
            <p className="text-sm text-muted-foreground">{new Date(visit.visitDate).toLocaleDateString()}</p>
          </div>
          {visit.diagnosis ? <p className="text-sm"><span className="font-semibold">Diagnosis:</span> {visit.diagnosis}</p> : null}
          {visit.findings ? <p className="text-sm text-muted-foreground">{visit.findings}</p> : null}
          {visit.treatment ? <p className="text-sm"><span className="font-semibold">Treatment:</span> {visit.treatment}</p> : null}
          <p className="text-[13px] text-muted-foreground">
            {visit.feeAmount ? `Fee ${formatCurrency(Number(visit.feeAmount))}` : 'No fee recorded'}
            {visit.followUpDate ? ` · Follow up ${new Date(visit.followUpDate).toLocaleDateString()}` : ''}
          </p>
        </div>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record a vet visit</DialogTitle>
            <DialogDescription>Pay the fee in Money with the "Vet Services" category, tagged to this batch.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label htmlFor="vet-date">Date</Label><Input id="vet-date" type="date" value={form.visitDate} onChange={(e) => setForm((f) => ({ ...f, visitDate: e.target.value }))} /></div>
              <div className="grid gap-2"><Label htmlFor="vet-name">Vet</Label><Input id="vet-name" value={form.vetName} onChange={(e) => setForm((f) => ({ ...f, vetName: e.target.value }))} /></div>
            </div>
            <div className="grid gap-2"><Label htmlFor="vet-reason">Reason</Label><Input id="vet-reason" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Routine check, high mortality…" /></div>
            <div className="grid gap-2"><Label htmlFor="vet-findings">Findings</Label><Textarea id="vet-findings" value={form.findings} onChange={(e) => setForm((f) => ({ ...f, findings: e.target.value }))} /></div>
            <div className="grid gap-2"><Label htmlFor="vet-diagnosis">Diagnosis</Label><Input id="vet-diagnosis" value={form.diagnosis} onChange={(e) => setForm((f) => ({ ...f, diagnosis: e.target.value }))} /></div>
            <div className="grid gap-2"><Label htmlFor="vet-treatment">Treatment</Label><Textarea id="vet-treatment" value={form.treatment} onChange={(e) => setForm((f) => ({ ...f, treatment: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label htmlFor="vet-fee">Fee (Rs)</Label><Input id="vet-fee" inputMode="decimal" value={form.feeAmount} onChange={(e) => setForm((f) => ({ ...f, feeAmount: e.target.value.replace(/[^0-9.]/g, '') }))} /></div>
              <div className="grid gap-2"><Label htmlFor="vet-follow">Follow up</Label><Input id="vet-follow" type="date" value={form.followUpDate} onChange={(e) => setForm((f) => ({ ...f, followUpDate: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.vetName.trim() || save.isPending}>Save visit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
