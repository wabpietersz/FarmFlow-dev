import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import { batches, costCentres, feedInventory, financeCategories, inventoryItemTypes, sites } from '../db/schema';

type Executor = typeof db | any;

/**
 * Every money-ledger line carries: what it was for (category), where it belongs (cost centre),
 * and optionally which batch. This module is the single place those tags are resolved and validated.
 */
export type EntryTags = {
  categoryId: number;
  costCentreId: number | null;
  batchId: number | null;
};

export type EntryTagInput = {
  categoryId?: number | null;
  categoryCode?: string | null;
  costCentreId?: number | null;
  costCentreCode?: string | null;
  siteId?: number | null;
  batchId?: number | null;
};

export class FinanceTagError extends Error {
  readonly statusCode = 400;
  readonly code = 'FINANCE_TAG_INVALID';
}

export function isFinanceTagError(error: unknown): error is FinanceTagError {
  return error instanceof FinanceTagError;
}

export function sendFinanceTagError(
  res: { status: (code: number) => { json: (body: unknown) => void } },
  error: FinanceTagError,
) {
  res.status(400).json({
    success: false,
    error: error.message,
    code: error.code,
    statusCode: 400,
    timestamp: new Date().toISOString(),
  });
}

export async function getCategoryByCode(code: string, executor: Executor = db) {
  const [category] = await executor
    .select()
    .from(financeCategories)
    .where(eq(financeCategories.code, code))
    .limit(1);
  if (!category) {
    throw new FinanceTagError(`Finance category "${code}" is not configured`);
  }
  return category as typeof financeCategories.$inferSelect;
}

export async function getCostCentreByCode(code: string, executor: Executor = db) {
  const [centre] = await executor
    .select()
    .from(costCentres)
    .where(eq(costCentres.code, code))
    .limit(1);
  if (!centre) {
    throw new FinanceTagError(`Cost centre "${code}" is not configured`);
  }
  return centre as typeof costCentres.$inferSelect;
}

/** Returns the site's cost centre, creating it if the site predates cost centres. */
export async function ensureSiteCostCentre(siteId: number, executor: Executor = db) {
  const [existing] = await executor
    .select()
    .from(costCentres)
    .where(eq(costCentres.siteId, siteId))
    .limit(1);
  if (existing) return existing as typeof costCentres.$inferSelect;

  const [site] = await executor.select().from(sites).where(eq(sites.id, siteId)).limit(1);
  if (!site) {
    throw new FinanceTagError('Site not found');
  }
  const [created] = await executor
    .insert(costCentres)
    .values({ code: `SITE-${site.id}`, name: site.siteName, centreType: 'site', siteId: site.id })
    .returning();
  return created as typeof costCentres.$inferSelect;
}

export async function getBatchCostCentre(batchId: number, executor: Executor = db) {
  const [batch] = await executor
    .select({ id: batches.id, siteId: batches.siteId })
    .from(batches)
    .where(eq(batches.id, batchId))
    .limit(1);
  if (!batch) {
    throw new FinanceTagError('Batch not found');
  }
  return ensureSiteCostCentre(batch.siteId, executor);
}

/**
 * Resolve and validate tags for one ledger line.
 * - category is required and must be active
 * - transfer categories never carry a cost centre or batch
 * - a batch implies its site's cost centre (an explicit, different cost centre is rejected)
 * - every other line must have an active cost centre
 */
export async function resolveEntryTags(input: EntryTagInput, executor: Executor = db): Promise<EntryTags> {
  let category: typeof financeCategories.$inferSelect | undefined;
  if (input.categoryId) {
    [category] = await executor
      .select()
      .from(financeCategories)
      .where(eq(financeCategories.id, input.categoryId))
      .limit(1);
  } else if (input.categoryCode) {
    category = await getCategoryByCode(input.categoryCode, executor);
  }
  if (!category) {
    throw new FinanceTagError('Finance category is required');
  }
  if (category.status !== 'active') {
    throw new FinanceTagError(`Finance category "${category.name}" is inactive`);
  }

  if (category.categoryType === 'transfer') {
    return { categoryId: category.id, costCentreId: null, batchId: null };
  }

  let costCentreId = input.costCentreId ?? null;
  if (!costCentreId && input.costCentreCode) {
    costCentreId = (await getCostCentreByCode(input.costCentreCode, executor)).id;
  }

  const batchId = input.batchId ?? null;
  if (batchId) {
    const batchCentre = await getBatchCostCentre(batchId, executor);
    if (costCentreId && costCentreId !== batchCentre.id) {
      throw new FinanceTagError('Batch does not belong to the selected cost centre');
    }
    costCentreId = batchCentre.id;
  } else if (!costCentreId && input.siteId) {
    costCentreId = (await ensureSiteCostCentre(input.siteId, executor)).id;
  }

  if (!costCentreId) {
    throw new FinanceTagError('Cost centre is required');
  }

  const [centre] = await executor
    .select({ id: costCentres.id, status: costCentres.status, name: costCentres.name })
    .from(costCentres)
    .where(and(eq(costCentres.id, costCentreId)))
    .limit(1);
  if (!centre) {
    throw new FinanceTagError('Cost centre not found');
  }
  if (centre.status !== 'active') {
    throw new FinanceTagError(`Cost centre "${centre.name}" is inactive`);
  }

  return { categoryId: category.id, costCentreId, batchId };
}

/**
 * Split an amount across weighted parts, rounding to cents and putting the remainder on the
 * largest part so the pieces always sum exactly to the original amount.
 */
export function splitAmountByWeights<T extends { weight: number }>(amount: number, parts: T[]): Array<T & { amount: number }> {
  const positive = parts.filter((part) => part.weight > 0);
  if (positive.length === 0) return [];
  const totalWeight = positive.reduce((sum, part) => sum + part.weight, 0);
  const totalCents = Math.round(amount * 100);
  const result = positive.map((part) => ({
    ...part,
    cents: Math.floor((totalCents * part.weight) / totalWeight),
  }));
  const remainder = totalCents - result.reduce((sum, part) => sum + part.cents, 0);
  const largest = result.reduce((best, part) => (part.weight > best.weight ? part : best), result[0]);
  largest.cents += remainder;
  return result.map(({ cents, ...part }) => ({ ...(part as unknown as T), amount: cents / 100 }));
}

/** Where a purchase lands if the user doesn't say: feed raw materials → Feed Mill, anything else → Admin. */
export async function defaultPurchaseCostCentreId(inventoryItemIds: number[], executor: Executor = db) {
  if (inventoryItemIds.length > 0) {
    const rows = await executor
      .select({ isFeed: inventoryItemTypes.isFeed })
      .from(feedInventory)
      .innerJoin(inventoryItemTypes, eq(feedInventory.itemTypeId, inventoryItemTypes.id))
      .where(inArray(feedInventory.id, inventoryItemIds));
    if (rows.some((row: { isFeed: boolean }) => row.isFeed)) {
      return (await getCostCentreByCode('MILL', executor)).id;
    }
  }
  return (await getCostCentreByCode('ADMIN', executor)).id;
}
