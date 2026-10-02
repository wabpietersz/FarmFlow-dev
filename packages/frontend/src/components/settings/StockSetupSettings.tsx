import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CategorySelect } from '@/components/finance/FinanceTagFields';
import {
  useCreateInventoryItemType,
  useInventoryItemTypes,
  useUpdateInventoryItemType,
  type InventoryItemType,
} from '@/hooks/useInventoryManagement';
import { useCreateStockLocation, useStockLocations, useUpdateStockLocation, type StockLocation } from '@/hooks/useStock';
import { useFinanceCategories } from '@/hooks/useFinance';
import { getApiErrorMessage } from '@/lib/api';
import { RowActions } from '@/components/ui/row-actions';

const CATEGORY_LABELS: Record<string, string> = { feed: 'Feed & raw materials', health: 'Medicine & vaccines', operations: 'Farm supplies', assets: 'Equipment' };

type TypeForm = {
  typeName: string;
  typeCode: string;
  category: string;
  defaultUnit: string;
  isFeed: boolean;
  allowsBatchAllocation: boolean;
  financeCategoryId: string;
  status: string;
};
const EMPTY_TYPE: TypeForm = { typeName: '', typeCode: '', category: 'operations', defaultUnit: 'unit', isFeed: false, allowsBatchAllocation: true, financeCategoryId: '', status: 'active' };

/** The kinds of stock the farm keeps, and how each behaves. */
export function ItemTypesSettings({ canEdit }: { canEdit: boolean }) {
  const { data, isLoading } = useInventoryItemTypes();
  const { data: categories } = useFinanceCategories();
  const [editing, setEditing] = useState<{ id?: number; form: TypeForm } | null>(null);
  const create = useCreateInventoryItemType();
  const update = useUpdateInventoryItemType(editing?.id);
  const types = data?.data ?? [];
  const categoryName = (id?: number | null) => (categories?.data ?? []).find((c) => c.id === id)?.name;

  const open = (type?: InventoryItemType) => setEditing(type
    ? {
        id: type.id,
        form: {
          typeName: type.typeName, typeCode: type.typeCode, category: type.category, defaultUnit: type.defaultUnit,
          isFeed: type.isFeed, allowsBatchAllocation: type.allowsBatchAllocation,
          financeCategoryId: type.financeCategoryId ? String(type.financeCategoryId) : '', status: type.status,
        },
      }
    : { form: EMPTY_TYPE });

  const save = async () => {
    if (!editing) return;
    const f = editing.form;
    const payload = {
      typeName: f.typeName.trim(),
      typeCode: f.typeCode.trim() || f.typeName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      category: f.category,
      defaultUnit: f.defaultUnit.trim(),
      isFeed: f.isFeed,
      allowsBatchAllocation: f.isFeed ? false : f.allowsBatchAllocation,
      financeCategoryId: f.financeCategoryId ? Number(f.financeCategoryId) : null,
      status: f.status,
    };
    try {
      if (editing.id) await update.mutateAsync(payload);
      else await create.mutateAsync(payload);
      toast.success('Item type saved');
      setEditing(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not save the item type'));
    }
  };

  if (isLoading) return <Skeleton className="h-48 rounded-3xl" />;
  return (
    <div className="space-y-4">
      {canEdit ? <Button onClick={() => open()}><Plus className="h-4 w-4" /> New item type</Button> : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {types.map((type) => (
          <div key={type.id} className="flex flex-col gap-2 rounded-3xl border border-border p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold">{type.typeName}</p>
                <p className="text-sm text-muted-foreground">{CATEGORY_LABELS[type.category] ?? type.category} · counted in {type.defaultUnit}</p>
              </div>
              <RowActions label={type.typeName} actions={[{ label: 'Edit', icon: Pencil, hidden: !canEdit, onSelect: () => open(type) }]} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {type.isFeed ? <Badge variant="info">Feed mill</Badge> : null}
              {type.allowsBatchAllocation ? <Badge variant="secondary">Can be used on batches</Badge> : null}
              {categoryName(type.financeCategoryId) ? <Badge variant="outline">{categoryName(type.financeCategoryId)}</Badge> : null}
              {type.status !== 'active' ? <Badge variant="outline">Inactive</Badge> : null}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit item type' : 'New item type'}</DialogTitle>
            <DialogDescription>Item types decide where stock is used and which money category its purchases go to.</DialogDescription>
          </DialogHeader>
          {editing ? (
            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2"><Label htmlFor="type-name">Name</Label><Input id="type-name" value={editing.form.typeName} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, typeName: e.target.value } })} /></div>
                <div className="grid gap-2"><Label htmlFor="type-unit">Counted in</Label><Input id="type-unit" value={editing.form.defaultUnit} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, defaultUnit: e.target.value } })} placeholder="kg, dose, bag…" /></div>
              </div>
              <div className="grid gap-2">
                <Label>Group</Label>
                <Select value={editing.form.category} onValueChange={(category) => setEditing({ ...editing, form: { ...editing.form, category } })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Money category for purchases</Label>
                <CategorySelect value={editing.form.financeCategoryId} onChange={(financeCategoryId) => setEditing({ ...editing, form: { ...editing.form, financeCategoryId } })} />
              </div>
              <label className="flex min-h-11 items-center gap-3 rounded-2xl bg-muted/60 px-3">
                <Checkbox checked={editing.form.isFeed} onCheckedChange={(isFeed) => setEditing({ ...editing, form: { ...editing.form, isFeed } })} />
                <span className="text-sm font-semibold">Feed mill raw material (used in recipes)</span>
              </label>
              {!editing.form.isFeed ? (
                <label className="flex min-h-11 items-center gap-3 rounded-2xl bg-muted/60 px-3">
                  <Checkbox checked={editing.form.allowsBatchAllocation} onCheckedChange={(allowsBatchAllocation) => setEditing({ ...editing, form: { ...editing.form, allowsBatchAllocation } })} />
                  <span className="text-sm font-semibold">Can be used directly on batches (medicine, vaccines, litter…)</span>
                </label>
              ) : null}
              {editing.id ? (
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={editing.form.status} onValueChange={(status) => setEditing({ ...editing, form: { ...editing.form, status } })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={!editing?.form.typeName.trim() || !editing?.form.defaultUnit.trim() || create.isPending || update.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const LOCATION_LABELS: Record<string, string> = { central: 'Main store', mill_store: 'Feed mill', farm_store: 'Farm store', other: 'Other' };

/** Where stock is kept. Every farm gets a store automatically. */
export function StoresSettings({ canEdit }: { canEdit: boolean }) {
  const { data, isLoading } = useStockLocations();
  const create = useCreateStockLocation();
  const update = useUpdateStockLocation();
  const [draft, setDraft] = useState<{ id?: number; name: string; status: 'active' | 'inactive' } | null>(null);
  const stores = data?.data ?? [];

  const save = async () => {
    if (!draft) return;
    try {
      if (draft.id) await update.mutateAsync({ id: draft.id, data: { name: draft.name.trim(), status: draft.status } });
      else await create.mutateAsync({ name: draft.name.trim(), code: draft.name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 40), locationType: 'other' });
      toast.success('Store saved');
      setDraft(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not save the store'));
    }
  };

  if (isLoading) return <Skeleton className="h-40 rounded-3xl" />;
  return (
    <div className="space-y-4">
      {canEdit ? <Button onClick={() => setDraft({ name: '', status: 'active' })}><Plus className="h-4 w-4" /> New store</Button> : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {stores.map((store: StockLocation) => (
          <div key={store.id} className="flex items-center justify-between gap-2 rounded-3xl border border-border p-4">
            <div>
              <p className="font-bold">{store.name}</p>
              <p className="text-sm text-muted-foreground">{LOCATION_LABELS[store.locationType] ?? store.locationType}{store.status !== 'active' ? ' · inactive' : ''}</p>
            </div>
            <RowActions label={store.name} actions={[{ label: 'Edit', icon: Pencil, hidden: !canEdit, onSelect: () => setDraft({ id: store.id, name: store.name, status: store.status }) }]} />
          </div>
        ))}
      </div>
      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{draft?.id ? 'Edit store' : 'New store'}</DialogTitle></DialogHeader>
          {draft ? (
            <div className="grid gap-4">
              <div className="grid gap-2"><Label htmlFor="store-name">Name</Label><Input id="store-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
              {draft.id ? (
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={draft.status} onValueChange={(status: 'active' | 'inactive') => setDraft({ ...draft, status })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
            <Button onClick={save} disabled={!draft?.name.trim() || create.isPending || update.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
