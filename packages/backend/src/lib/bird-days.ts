/**
 * Bird-days: the number of live birds in a batch, summed over each day it is on the farm.
 * Shared farm costs are split between batches in proportion to bird-days, so a batch that holds
 * more birds for longer carries more of the cost.
 *
 * Live birds are derived, not typed in: accepted chicks − recorded deaths − birds sold, day by day.
 * A day counts the birds alive at the start of that day.
 */

export type BirdEvent = { date: string; count: number };

export type BatchLifeInput = {
  id: number;
  siteId: number;
  placementDate: string;
  endDate?: string | null;
  birdsPlaced: number;
  deaths: BirdEvent[];
  sold: BirdEvent[];
};

export type BatchBirdDays = {
  batchId: number;
  siteId: number;
  /** month key (YYYY-MM) → bird-days in that month */
  byMonth: Map<string, number>;
  total: number;
  /** last day with live birds (inclusive), or null if the batch never held birds */
  lastDay: string | null;
  /** still holding birds after MAX_BATCH_DAYS: almost certainly a batch nobody closed */
  stale: boolean;
};

export function toIsoDate(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

/**
 * No broiler batch legitimately runs this long; a batch still open past it has been forgotten.
 * Capping stops a forgotten batch from silently soaking up its farm's shared costs.
 */
export const MAX_BATCH_DAYS = 90;

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function sumByDate(events: BirdEvent[]) {
  const map = new Map<string, number>();
  for (const event of events) {
    const date = toIsoDate(event.date);
    map.set(date, (map.get(date) ?? 0) + Math.max(0, Number(event.count) || 0));
  }
  return map;
}

export function computeBirdDays(batch: BatchLifeInput, asOf: string): BatchBirdDays {
  const byMonth = new Map<string, number>();
  const start = toIsoDate(batch.placementDate);
  const cap = addDays(start, MAX_BATCH_DAYS - 1);
  let hardEnd = batch.endDate && toIsoDate(batch.endDate) < asOf ? toIsoDate(batch.endDate) : asOf;
  const capped = hardEnd > cap;
  if (capped) hardEnd = cap;
  const deaths = sumByDate(batch.deaths);
  const sold = sumByDate(batch.sold);

  let live = Math.max(0, batch.birdsPlaced);
  let total = 0;
  let lastDay: string | null = null;

  // Guard against runaway loops on bad dates (a broiler batch is weeks long, not decades).
  for (let day = start, guard = 0; day <= hardEnd && live > 0 && guard < 3660; day = addDays(day, 1), guard += 1) {
    const key = monthKey(day);
    byMonth.set(key, (byMonth.get(key) ?? 0) + live);
    total += live;
    lastDay = day;
    live = Math.max(0, live - (deaths.get(day) ?? 0) - (sold.get(day) ?? 0));
  }

  return { batchId: batch.id, siteId: batch.siteId, byMonth, total, lastDay, stale: capped && live > 0 };
}

/** Totals of bird-days per month, per site and across all farms, for use as allocation denominators. */
export function aggregateBirdDays(batches: BatchBirdDays[]) {
  const bySiteMonth = new Map<string, number>();
  const byMonth = new Map<string, number>();
  for (const batch of batches) {
    for (const [month, days] of batch.byMonth) {
      const siteKey = `${batch.siteId}:${month}`;
      bySiteMonth.set(siteKey, (bySiteMonth.get(siteKey) ?? 0) + days);
      byMonth.set(month, (byMonth.get(month) ?? 0) + days);
    }
  }
  return { bySiteMonth, byMonth };
}
