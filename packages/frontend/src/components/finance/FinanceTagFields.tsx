import { useMemo } from 'react';
import type { FinanceCategory } from '@farmflow/shared';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCostCentres, useFinanceCategories } from '@/hooks/useFinance';
import { useBatches } from '@/hooks/useBatches';

const NONE = 'none';

export interface FinanceTagValue {
  categoryId: string;
  costCentreId: string;
  batchId: string;
}

export const EMPTY_FINANCE_TAGS: FinanceTagValue = { categoryId: '', costCentreId: '', batchId: '' };

/** Convert form state to API fields (omits blanks). */
export function financeTagsToPayload(value: FinanceTagValue) {
  return {
    ...(value.categoryId ? { categoryId: Number(value.categoryId) } : {}),
    ...(value.costCentreId ? { costCentreId: Number(value.costCentreId) } : {}),
    ...(value.batchId ? { batchId: Number(value.batchId) } : {}),
  };
}

/** Which categories make sense for the direction of money: income only comes in, expenses only go out. */
export function categoryFitsDirection(category: FinanceCategory, direction: 'inflow' | 'outflow' | 'any') {
  if (category.categoryType === 'transfer' || category.categoryType === 'suspense') return false;
  if (direction === 'inflow') return category.categoryType !== 'expense';
  if (direction === 'outflow') return category.categoryType !== 'income';
  return true;
}

interface FinanceTagFieldsProps {
  value: FinanceTagValue;
  onChange: (value: FinanceTagValue) => void;
  direction: 'inflow' | 'outflow' | 'any';
  /** Show the batch picker (defaults to true). */
  showBatch?: boolean;
  /** Show the cost centre picker (defaults to true). */
  showCostCentre?: boolean;
  categoryLabel?: string;
  required?: boolean;
}

/**
 * The three questions every money movement answers: what it was for (category), where it belongs
 * (cost centre: a farm, the feed mill, or admin) and, optionally, which batch.
 */
export function FinanceTagFields({
  value,
  onChange,
  direction,
  showBatch = true,
  showCostCentre = true,
  categoryLabel = 'Category',
  required = true,
}: FinanceTagFieldsProps) {
  const { data: categoriesData } = useFinanceCategories({ status: 'active' });
  const { data: costCentresData } = useCostCentres({ status: 'active' });
  const { data: batchesData } = useBatches({ limit: 200 });

  const groupedCategories = useMemo(() => {
    const groups = new Map<string, FinanceCategory[]>();
    for (const category of categoriesData?.data ?? []) {
      if (!categoryFitsDirection(category, direction)) continue;
      const list = groups.get(category.reportGroup) ?? [];
      list.push(category);
      groups.set(category.reportGroup, list);
    }
    return [...groups.entries()];
  }, [categoriesData, direction]);

  const costCentres = costCentresData?.data ?? [];
  const selectedCentre = costCentres.find((centre) => String(centre.id) === value.costCentreId);
  // Sold batches stay selectable: bills often arrive after the birds have gone.
  const batches = (batchesData?.data ?? []).filter((batch) =>
    !selectedCentre?.siteId || batch.siteId === selectedCentre.siteId,
  );
  const batchAllowed = !selectedCentre || selectedCentre.centreType === 'site';

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label>{categoryLabel}{required ? ' *' : ''}</Label>
        <Select value={value.categoryId || undefined} onValueChange={(categoryId) => onChange({ ...value, categoryId })}>
          <SelectTrigger className="w-full"><SelectValue placeholder="What was this for?" /></SelectTrigger>
          <SelectContent>
            {groupedCategories.map(([group, categories]) => (
              <SelectGroup key={group}>
                <SelectLabel>{group}</SelectLabel>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>
      {showCostCentre && (
        <div className="space-y-2">
          <Label>Cost centre{required ? ' *' : ''}</Label>
          <Select
            value={value.costCentreId || undefined}
            onValueChange={(costCentreId) => {
              const centre = costCentres.find((item) => String(item.id) === costCentreId);
              const keepBatch = centre?.centreType === 'site'
                && (batchesData?.data ?? []).some((batch) => String(batch.id) === value.batchId && batch.siteId === centre.siteId);
              onChange({ ...value, costCentreId, batchId: keepBatch ? value.batchId : '' });
            }}
          >
            <SelectTrigger className="w-full"><SelectValue placeholder="Farm, mill or admin" /></SelectTrigger>
            <SelectContent>
              {costCentres.map((centre) => (
                <SelectItem key={centre.id} value={String(centre.id)}>{centre.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {showBatch && (
        <div className="space-y-2">
          <Label>Batch (optional)</Label>
          <Select
            value={value.batchId || NONE}
            disabled={!batchAllowed}
            onValueChange={(batchId) => {
              if (batchId === NONE) {
                onChange({ ...value, batchId: '' });
                return;
              }
              const batch = (batchesData?.data ?? []).find((item) => String(item.id) === batchId);
              const centre = costCentres.find((item) => item.siteId === batch?.siteId);
              onChange({ ...value, batchId, costCentreId: centre ? String(centre.id) : value.costCentreId });
            }}
          >
            <SelectTrigger className="w-full"><SelectValue placeholder="Not batch-specific" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not batch-specific</SelectItem>
              {batches.map((batch) => (
                <SelectItem key={batch.id} value={String(batch.id)}>
                  {batch.batchCode}{batch.siteName ? ` · ${batch.siteName}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

const UNSET = '__unset';

/** A single category picker (e.g. a supplier's default category or an item type's category). */
export function CategorySelect({
  value,
  onChange,
  direction = 'outflow',
  placeholder = 'Choose a category',
  allowNone = true,
}: {
  value: string;
  onChange: (value: string) => void;
  direction?: 'inflow' | 'outflow' | 'any';
  placeholder?: string;
  allowNone?: boolean;
}) {
  const { data } = useFinanceCategories({ status: 'active' });
  const categories = (data?.data ?? []).filter((category) => categoryFitsDirection(category, direction));
  return (
    <Select value={value || (allowNone ? UNSET : undefined)} onValueChange={(next) => onChange(next === UNSET ? '' : next)}>
      <SelectTrigger className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {allowNone ? <SelectItem value={UNSET}>Not set</SelectItem> : null}
        {categories.map((category) => (
          <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** A single cost-centre picker. */
export function CostCentreSelect({
  value,
  onChange,
  placeholder = 'Choose a cost centre',
  allowNone = true,
  noneLabel = 'Automatic',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowNone?: boolean;
  noneLabel?: string;
}) {
  const { data } = useCostCentres({ status: 'active' });
  return (
    <Select value={value || (allowNone ? UNSET : undefined)} onValueChange={(next) => onChange(next === UNSET ? '' : next)}>
      <SelectTrigger className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {allowNone ? <SelectItem value={UNSET}>{noneLabel}</SelectItem> : null}
        {(data?.data ?? []).map((centre) => (
          <SelectItem key={centre.id} value={String(centre.id)}>{centre.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
