import { useMemo, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { CostCentre, FinanceCategory } from '@farmflow/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableActionsHead, TableActionsCell } from '@/components/ui/table';
import {
  useCostCentres,
  useCreateCostCentre,
  useCreateFinanceCategory,
  useFinanceCategories,
  useUpdateCostCentre,
  useUpdateFinanceCategory,
} from '@/hooks/useFinance';
import { getApiErrorMessage } from '@/lib/api';
import { RowActions } from '@/components/ui/row-actions';
import { StatusBadge } from '@/components/ui/status-badge';

const TYPE_LABELS: Record<string, string> = {
  income: 'Income',
  expense: 'Expense',
  financing: 'Financing',
  transfer: 'Transfer',
  suspense: 'Needs review',
};

const CENTRE_TYPE_LABELS: Record<string, string> = { site: 'Farm', mill: 'Feed mill', admin: 'Admin' };

type CategoryForm = { id?: number; code: string; name: string; categoryType: 'income' | 'expense' | 'financing'; reportGroup: string; status: 'active' | 'inactive' };
const EMPTY_CATEGORY: CategoryForm = { code: '', name: '', categoryType: 'expense', reportGroup: '', status: 'active' };

type CentreForm = { id?: number; code: string; name: string; centreType: 'mill' | 'admin'; status: 'active' | 'inactive' };
const EMPTY_CENTRE: CentreForm = { code: '', name: '', centreType: 'admin', status: 'active' };

/** Maintain the lists every money movement is tagged against. */
export function FinanceSetupTab({ canManage }: { canManage: boolean }) {
  const { data: categoriesData } = useFinanceCategories();
  const { data: centresData } = useCostCentres();
  const createCategory = useCreateFinanceCategory();
  const updateCategory = useUpdateFinanceCategory();
  const createCentre = useCreateCostCentre();
  const updateCentre = useUpdateCostCentre();

  const [categoryForm, setCategoryForm] = useState<CategoryForm | null>(null);
  const [centreForm, setCentreForm] = useState<CentreForm | null>(null);

  const categories = categoriesData?.data ?? [];
  const centres = centresData?.data ?? [];
  const reportGroups = useMemo(() => [...new Set(categories.map((category) => category.reportGroup))].sort(), [categories]);

  const saveCategory = async () => {
    if (!categoryForm) return;
    try {
      if (categoryForm.id) {
        await updateCategory.mutateAsync({
          id: categoryForm.id,
          data: { name: categoryForm.name, reportGroup: categoryForm.reportGroup, status: categoryForm.status },
        });
      } else {
        await createCategory.mutateAsync({
          code: categoryForm.code,
          name: categoryForm.name,
          categoryType: categoryForm.categoryType,
          reportGroup: categoryForm.reportGroup,
        });
      }
      toast.success('Category saved');
      setCategoryForm(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to save category'));
    }
  };

  const saveCentre = async () => {
    if (!centreForm) return;
    try {
      if (centreForm.id) {
        await updateCentre.mutateAsync({ id: centreForm.id, data: { name: centreForm.name, status: centreForm.status } });
      } else {
        await createCentre.mutateAsync({ code: centreForm.code, name: centreForm.name, centreType: centreForm.centreType });
      }
      toast.success('Cost centre saved');
      setCentreForm(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to save cost centre'));
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Finance categories</CardTitle>
            <CardDescription>What money is for. Reports group categories by their report group.</CardDescription>
          </div>
          {canManage ? (
            <Button size="sm" className="gap-2" onClick={() => setCategoryForm(EMPTY_CATEGORY)}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Report group</TableHead>
                  <TableHead>Status</TableHead>
                  <TableActionsHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category: FinanceCategory) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <p className="font-semibold">{category.name}</p>
                      <p className="text-xs text-muted-foreground">{category.code}{category.isSystem ? ' · system' : ''}</p>
                    </TableCell>
                    <TableCell>{TYPE_LABELS[category.categoryType] ?? category.categoryType}</TableCell>
                    <TableCell>{category.reportGroup}</TableCell>
                    <TableCell>
                      <StatusBadge status={category.status} />
                    </TableCell>
                    <TableActionsCell>
                      <RowActions
                        label={category.name}
                        actions={[{
                          label: 'Edit',
                          icon: Pencil,
                          hidden: !canManage || category.categoryType === 'transfer' || category.categoryType === 'suspense',
                          onSelect: () => setCategoryForm({
                            id: category.id,
                            code: category.code,
                            name: category.name,
                            categoryType: category.categoryType as CategoryForm['categoryType'],
                            reportGroup: category.reportGroup,
                            status: category.status,
                          }),
                        }]}
                      />
                    </TableActionsCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="self-start">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Cost centres</CardTitle>
            <CardDescription>Where money belongs. Each farm site gets one automatically.</CardDescription>
          </div>
          {canManage ? (
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setCentreForm(EMPTY_CENTRE)}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-2">
          {centres.map((centre: CostCentre) => (
            <div key={centre.id} className="flex min-h-14 items-center justify-between rounded-2xl border px-4 py-2">
              <div>
                <p className="font-medium">{centre.name}</p>
                <p className="text-xs text-muted-foreground">
                  {CENTRE_TYPE_LABELS[centre.centreType] ?? centre.centreType} · {centre.code}
                  {centre.status !== 'active' ? ' · inactive' : ''}
                </p>
              </div>
              <RowActions label={centre.name} actions={[{ label: 'Edit', icon: Pencil, hidden: !canManage || !!centre.siteId, onSelect: () => setCentreForm({ id: centre.id, code: centre.code, name: centre.name, centreType: centre.centreType as CentreForm['centreType'], status: centre.status }) }]} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!categoryForm} onOpenChange={(open) => !open && setCategoryForm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{categoryForm?.id ? 'Edit category' : 'New category'}</DialogTitle>
          </DialogHeader>
          {categoryForm ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="category-name">Name</Label>
                <Input
                  id="category-name"
                  value={categoryForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setCategoryForm((prev) => prev && ({
                      ...prev,
                      name,
                      code: prev.id ? prev.code : name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 50),
                    }));
                  }}
                />
              </div>
              {!categoryForm.id ? (
                <div className="grid gap-2">
                  <Label>Type</Label>
                  <Select value={categoryForm.categoryType} onValueChange={(value: CategoryForm['categoryType']) => setCategoryForm((prev) => prev && ({ ...prev, categoryType: value }))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">Expense (money out)</SelectItem>
                      <SelectItem value="income">Income (money in)</SelectItem>
                      <SelectItem value="financing">Financing (capital, loans, advances)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div className="grid gap-2">
                <Label htmlFor="category-group">Report group</Label>
                <Input id="category-group" list="finance-report-groups" value={categoryForm.reportGroup}
                  onChange={(e) => setCategoryForm((prev) => prev && ({ ...prev, reportGroup: e.target.value }))} />
                <datalist id="finance-report-groups">
                  {reportGroups.map((group) => <option key={group} value={group} />)}
                </datalist>
              </div>
              {categoryForm.id ? (
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={categoryForm.status} onValueChange={(value: 'active' | 'inactive') => setCategoryForm((prev) => prev && ({ ...prev, status: value }))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryForm(null)}>Cancel</Button>
            <Button onClick={saveCategory} disabled={!categoryForm?.name || !categoryForm?.reportGroup || createCategory.isPending || updateCategory.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!centreForm} onOpenChange={(open) => !open && setCentreForm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{centreForm?.id ? 'Edit cost centre' : 'New cost centre'}</DialogTitle>
          </DialogHeader>
          {centreForm ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="centre-name">Name</Label>
                <Input
                  id="centre-name"
                  value={centreForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setCentreForm((prev) => prev && ({
                      ...prev,
                      name,
                      code: prev.id ? prev.code : name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50),
                    }));
                  }}
                />
              </div>
              {!centreForm.id ? (
                <div className="grid gap-2">
                  <Label>Type</Label>
                  <Select value={centreForm.centreType} onValueChange={(value: 'mill' | 'admin') => setCentreForm((prev) => prev && ({ ...prev, centreType: value }))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin / overhead</SelectItem>
                      <SelectItem value="mill">Feed mill</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Farm cost centres are created from Sites.</p>
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={centreForm.status} onValueChange={(value: 'active' | 'inactive') => setCentreForm((prev) => prev && ({ ...prev, status: value }))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCentreForm(null)}>Cancel</Button>
            <Button onClick={saveCentre} disabled={!centreForm?.name || createCentre.isPending || updateCentre.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
