import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import { batches, buyerReceiptAllocations, buyerReceiptLines, buyerReceipts, buyers, saleBookings, sales, sites } from '../db/schema';
import { buildBuyerLedger, getBuyerBalanceSummary } from './sales-ledger';

/** A rule the person can fix (shown as a 400, never a server error). */
export class SalesRuleError extends Error {
  constructor(message: string, public code = 'SALES_RULE') {
    super(message);
  }
}

const today = () => new Date().toISOString().slice(0, 10);

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);
}

// ---------------------------------------------------------------------------
// Credit
// ---------------------------------------------------------------------------

export type CreditCheck = { limit: number | null; owedNow: number; afterSale: number; overBy: number };

/** What the buyer would owe after a new sale, against their credit limit. */
export async function checkBuyerCredit(buyerId: number, newAmount: number): Promise<CreditCheck> {
  const [buyer] = await db.select({ creditLimit: buyers.creditLimit }).from(buyers).where(eq(buyers.id, buyerId)).limit(1);
  const balance = await getBuyerBalanceSummary(buyerId);
  const owedNow = Math.max(balance.netBalance, 0);
  const afterSale = Number((owedNow + newAmount).toFixed(2));
  const limit = buyer?.creditLimit != null ? Number(buyer.creditLimit) : null;
  const overBy = limit != null ? Math.max(Number((afterSale - limit).toFixed(2)), 0) : 0;
  return { limit, owedNow, afterSale, overBy };
}

export function dueDateFor(saleDate: string, creditTermsDays: number | null | undefined) {
  return addDays(saleDate, creditTermsDays ?? 0);
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

async function nextBookingCode(catchDate: string, executor: typeof db | any = db) {
  const dateStr = catchDate.replace(/-/g, '');
  const [row] = await executor
    .select({ count: sql<number>`count(*)::int` })
    .from(saleBookings)
    .where(sql`${saleBookings.bookingCode} LIKE ${'BKG-' + dateStr + '-%'}`);
  return `BKG-${dateStr}-${String((row?.count ?? 0) + 1).padStart(3, '0')}`;
}

export async function listBookings(filters: { status?: string; siteId?: number | null; from?: string; to?: string } = {}) {
  const conditions = [];
  if (filters.status) conditions.push(eq(saleBookings.status, filters.status));
  if (filters.siteId) conditions.push(eq(batches.siteId, filters.siteId));
  if (filters.from) conditions.push(sql`${saleBookings.catchDate} >= ${filters.from}`);
  if (filters.to) conditions.push(sql`${saleBookings.catchDate} <= ${filters.to}`);

  const rows = await db
    .select({
      id: saleBookings.id,
      bookingCode: saleBookings.bookingCode,
      buyerId: saleBookings.buyerId,
      buyerName: buyers.buyerName,
      batchId: saleBookings.batchId,
      batchCode: batches.batchCode,
      siteId: batches.siteId,
      siteName: sites.siteName,
      catchDate: saleBookings.catchDate,
      expectedBirds: saleBookings.expectedBirds,
      expectedAvgWeightKg: saleBookings.expectedAvgWeightKg,
      pricePerKg: saleBookings.pricePerKg,
      status: saleBookings.status,
      saleId: saleBookings.saleId,
      saleCode: sales.saleCode,
      notes: saleBookings.notes,
      createdAt: saleBookings.createdAt,
    })
    .from(saleBookings)
    .innerJoin(buyers, eq(saleBookings.buyerId, buyers.id))
    .innerJoin(batches, eq(saleBookings.batchId, batches.id))
    .leftJoin(sites, eq(batches.siteId, sites.id))
    .leftJoin(sales, eq(saleBookings.saleId, sales.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(saleBookings.catchDate), asc(saleBookings.id));

  return rows.map((row) => {
    const avg = row.expectedAvgWeightKg != null ? Number(row.expectedAvgWeightKg) : null;
    const expectedWeight = avg != null ? Number((avg * row.expectedBirds).toFixed(2)) : null;
    return {
      ...row,
      expectedAvgWeightKg: avg,
      pricePerKg: Number(row.pricePerKg),
      expectedWeightKg: expectedWeight,
      expectedValue: expectedWeight != null ? Number((expectedWeight * Number(row.pricePerKg)).toFixed(2)) : null,
    };
  });
}

type BookingInput = {
  buyerId: number;
  batchId: number;
  catchDate: string;
  expectedBirds: number;
  expectedAvgWeightKg?: number | null;
  pricePerKg: number;
  notes?: string | null;
};

async function assertBookable(input: Pick<BookingInput, 'buyerId' | 'batchId' | 'expectedBirds'>, userSiteId: number | null, excludeBookingId?: number) {
  const [batch] = await db.select().from(batches).where(eq(batches.id, input.batchId)).limit(1);
  if (!batch) throw new SalesRuleError('Batch not found', 'BATCH_NOT_FOUND');
  if (!['growing', 'ready_for_sale'].includes(batch.status)) throw new SalesRuleError('Only growing or ready batches can be booked', 'BATCH_NOT_READY');
  if (userSiteId && batch.siteId !== userSiteId) throw new SalesRuleError('You can only book batches on your own farm', 'FORBIDDEN');

  const [buyer] = await db.select().from(buyers).where(eq(buyers.id, input.buyerId)).limit(1);
  if (!buyer) throw new SalesRuleError('Buyer not found', 'BUYER_NOT_FOUND');
  if (buyer.status === 'inactive') throw new SalesRuleError('Buyer is inactive', 'BUYER_INACTIVE');

  // Birds already sold or booked from this batch
  const [sold] = await db
    .select({ birds: sql<number>`COALESCE(SUM(${sales.totalBirds}), 0)::int` })
    .from(sales)
    .where(and(eq(sales.batchId, batch.id), sql`${sales.status} <> 'cancelled'`));
  const [booked] = await db
    .select({ birds: sql<number>`COALESCE(SUM(${saleBookings.expectedBirds}), 0)::int` })
    .from(saleBookings)
    .where(and(
      eq(saleBookings.batchId, batch.id),
      eq(saleBookings.status, 'booked'),
      excludeBookingId ? sql`${saleBookings.id} <> ${excludeBookingId}` : undefined,
    ));
  const available = batch.chicksPlaced - (sold?.birds ?? 0) - (booked?.birds ?? 0);
  if (input.expectedBirds > available) {
    throw new SalesRuleError(`Only ${Math.max(available, 0).toLocaleString('en-US')} birds in ${batch.batchCode} are not already sold or booked`, 'BOOKING_EXCEEDS_BATCH');
  }
}

export async function createBooking(input: BookingInput, userId: number, userSiteId: number | null) {
  await assertBookable(input, userSiteId);
  const [booking] = await db
    .insert(saleBookings)
    .values({
      bookingCode: await nextBookingCode(input.catchDate),
      buyerId: input.buyerId,
      batchId: input.batchId,
      catchDate: input.catchDate,
      expectedBirds: input.expectedBirds,
      expectedAvgWeightKg: input.expectedAvgWeightKg != null ? input.expectedAvgWeightKg.toFixed(3) : null,
      pricePerKg: input.pricePerKg.toFixed(2),
      notes: input.notes || null,
      createdBy: userId,
    })
    .returning();
  return booking;
}

export async function updateBooking(id: number, input: Partial<BookingInput> & { status?: 'booked' | 'cancelled' }, userSiteId: number | null) {
  const [existing] = await db.select().from(saleBookings).where(eq(saleBookings.id, id)).limit(1);
  if (!existing) throw new SalesRuleError('Booking not found', 'NOT_FOUND');
  if (existing.status === 'converted') throw new SalesRuleError('This booking is already a sale', 'BOOKING_CONVERTED');

  const merged = {
    buyerId: input.buyerId ?? existing.buyerId,
    batchId: input.batchId ?? existing.batchId,
    expectedBirds: input.expectedBirds ?? existing.expectedBirds,
  };
  if ((input.status ?? existing.status) === 'booked') await assertBookable(merged, userSiteId, id);

  const [updated] = await db
    .update(saleBookings)
    .set({
      ...merged,
      catchDate: input.catchDate ?? existing.catchDate,
      expectedAvgWeightKg: input.expectedAvgWeightKg !== undefined
        ? (input.expectedAvgWeightKg != null ? input.expectedAvgWeightKg.toFixed(3) : null)
        : existing.expectedAvgWeightKg,
      pricePerKg: input.pricePerKg != null ? input.pricePerKg.toFixed(2) : existing.pricePerKg,
      notes: input.notes !== undefined ? input.notes || null : existing.notes,
      status: input.status ?? existing.status,
      updatedAt: new Date(),
    })
    .where(eq(saleBookings.id, id))
    .returning();
  return updated;
}

/** Called inside the sale-creation transaction: the booking must still be open and match the sale. */
export async function claimBookingForSale(executor: typeof db | any, bookingId: number, sale: { id: number; buyerId: number; batchId: number | null }) {
  const [booking] = await executor.select().from(saleBookings).where(eq(saleBookings.id, bookingId)).limit(1);
  if (!booking) throw new SalesRuleError('Booking not found', 'NOT_FOUND');
  if (booking.status !== 'booked') throw new SalesRuleError(`Booking ${booking.bookingCode} is already ${booking.status}`, 'BOOKING_NOT_OPEN');
  if (booking.buyerId !== sale.buyerId || booking.batchId !== sale.batchId) {
    throw new SalesRuleError('The sale must be for the same buyer and batch as the booking', 'BOOKING_MISMATCH');
  }
  await executor
    .update(saleBookings)
    .set({ status: 'converted', saleId: sale.id, updatedAt: new Date() })
    .where(eq(saleBookings.id, bookingId));
}

// ---------------------------------------------------------------------------
// Receivables
// ---------------------------------------------------------------------------

export const AGEING_BUCKETS = ['current', 'days1to30', 'days31to60', 'days61to90', 'over90'] as const;
type Bucket = (typeof AGEING_BUCKETS)[number];

function bucketFor(daysOverdue: number): Bucket {
  if (daysOverdue <= 0) return 'current';
  if (daysOverdue <= 30) return 'days1to30';
  if (daysOverdue <= 60) return 'days31to60';
  if (daysOverdue <= 90) return 'days61to90';
  return 'over90';
}

const emptyBuckets = (): Record<Bucket, number> => ({ current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0 });

/**
 * Who owes what, by how late it is. Each unpaid sale is aged from its due date
 * (sale date + the buyer's credit terms). Unapplied receipts show as credit.
 */
export async function receivablesAgeing(asOf = today()) {
  const openSales = await db
    .select({
      saleId: sales.id,
      saleCode: sales.saleCode,
      saleDate: sales.saleDate,
      dueDate: sales.dueDate,
      totalAmount: sales.totalAmount,
      buyerId: sales.buyerId,
      buyerName: buyers.buyerName,
      creditTerms: buyers.creditTerms,
      creditLimit: buyers.creditLimit,
      phoneNumber: buyers.phoneNumber,
      paid: sql<number>`COALESCE((
        SELECT SUM(${buyerReceiptAllocations.allocatedAmount}::numeric)
        FROM ${buyerReceiptAllocations}
        JOIN ${buyerReceiptLines} ON ${buyerReceiptLines.id} = ${buyerReceiptAllocations.receiptLineId}
        JOIN ${buyerReceipts} ON ${buyerReceipts.id} = ${buyerReceiptLines.receiptId}
        WHERE ${buyerReceiptAllocations.saleId} = ${sales.id}
          AND ${buyerReceiptLines.paymentStatus} = 'completed'
          AND ${buyerReceipts.receiptDate} <= ${asOf}
      ), 0)::float`,
    })
    .from(sales)
    .innerJoin(buyers, eq(sales.buyerId, buyers.id))
    .where(and(
      sql`${sales.status} NOT IN ('cancelled', 'draft')`,
      sql`${sales.saleDate} <= ${asOf}`,
    ))
    .orderBy(asc(sales.saleDate));

  type BuyerRow = {
    buyerId: number; buyerName: string; phoneNumber: string | null; creditTerms: number; creditLimit: number | null;
    buckets: Record<Bucket, number>; totalOwed: number; unappliedCredit: number; oldestDaysOverdue: number;
    sales: Array<{ saleId: number; saleCode: string; saleDate: string; dueDate: string; outstanding: number; daysOverdue: number; bucket: Bucket }>;
  };
  const byBuyer = new Map<number, BuyerRow>();

  for (const row of openSales) {
    const outstanding = Number((Number(row.totalAmount) - row.paid).toFixed(2));
    if (outstanding <= 0.009) continue;
    const dueDate = row.dueDate ?? dueDateFor(row.saleDate, row.creditTerms);
    const daysOverdue = daysBetween(dueDate, asOf);
    const bucket = bucketFor(daysOverdue);
    let entry = byBuyer.get(row.buyerId);
    if (!entry) {
      entry = {
        buyerId: row.buyerId, buyerName: row.buyerName, phoneNumber: row.phoneNumber,
        creditTerms: row.creditTerms ?? 0, creditLimit: row.creditLimit != null ? Number(row.creditLimit) : null,
        buckets: emptyBuckets(), totalOwed: 0, unappliedCredit: 0, oldestDaysOverdue: 0, sales: [],
      };
      byBuyer.set(row.buyerId, entry);
    }
    entry.buckets[bucket] = Number((entry.buckets[bucket] + outstanding).toFixed(2));
    entry.totalOwed = Number((entry.totalOwed + outstanding).toFixed(2));
    entry.oldestDaysOverdue = Math.max(entry.oldestDaysOverdue, daysOverdue);
    entry.sales.push({ saleId: row.saleId, saleCode: row.saleCode, saleDate: row.saleDate, dueDate, outstanding, daysOverdue, bucket });
  }

  // Money received but not yet applied to any sale
  if (byBuyer.size > 0) {
    const credits = await db
      .select({
        buyerId: buyerReceipts.buyerId,
        received: sql<number>`COALESCE(SUM(${buyerReceiptLines.paymentAmount}::numeric), 0)::float`,
        applied: sql<number>`COALESCE(SUM((SELECT COALESCE(SUM(${buyerReceiptAllocations.allocatedAmount}::numeric), 0) FROM ${buyerReceiptAllocations} WHERE ${buyerReceiptAllocations.receiptLineId} = ${buyerReceiptLines.id})), 0)::float`,
      })
      .from(buyerReceiptLines)
      .innerJoin(buyerReceipts, eq(buyerReceiptLines.receiptId, buyerReceipts.id))
      .where(and(
        inArray(buyerReceipts.buyerId, [...byBuyer.keys()]),
        eq(buyerReceiptLines.paymentStatus, 'completed'),
        sql`${buyerReceipts.receiptDate} <= ${asOf}`,
      ))
      .groupBy(buyerReceipts.buyerId);
    for (const credit of credits) {
      const entry = byBuyer.get(credit.buyerId);
      if (entry) entry.unappliedCredit = Math.max(Number((credit.received - credit.applied).toFixed(2)), 0);
    }
  }

  const buyersList = [...byBuyer.values()].sort((a, b) => b.oldestDaysOverdue - a.oldestDaysOverdue || b.totalOwed - a.totalOwed);
  const totals = emptyBuckets();
  let totalOwed = 0;
  for (const entry of buyersList) {
    for (const key of AGEING_BUCKETS) totals[key] = Number((totals[key] + entry.buckets[key]).toFixed(2));
    totalOwed = Number((totalOwed + entry.totalOwed).toFixed(2));
  }
  return { asOf, buyers: buyersList, totals, totalOwed, overdue: Number((totalOwed - totals.current).toFixed(2)) };
}

/** Buyer statement for a period: opening balance, every sale and receipt, closing balance. */
export async function buyerStatement(buyerId: number, from: string, to: string) {
  const [buyer] = await db.select().from(buyers).where(eq(buyers.id, buyerId)).limit(1);
  if (!buyer) throw new SalesRuleError('Buyer not found', 'NOT_FOUND');
  const ledger = await buildBuyerLedger(buyerId);

  const before = ledger.filter((entry) => entry.entryDate < from);
  const openingBalance = before.length ? before[before.length - 1].runningBalance : 0;
  let balance = openingBalance;
  const entries = ledger
    .filter((entry) => entry.entryDate >= from && entry.entryDate <= to)
    .map((entry) => {
      balance = Number((balance + entry.debit - entry.credit).toFixed(2));
      return { ...entry, runningBalance: balance };
    });

  const ageing = await receivablesAgeing(to);
  const buyerAgeing = ageing.buyers.find((row) => row.buyerId === buyerId);

  return {
    buyer: { id: buyer.id, buyerName: buyer.buyerName, contactPerson: buyer.contactPerson, phoneNumber: buyer.phoneNumber, address: buyer.address, creditTerms: buyer.creditTerms ?? 0, creditLimit: buyer.creditLimit != null ? Number(buyer.creditLimit) : null },
    from,
    to,
    openingBalance,
    totalSales: Number(entries.reduce((sum, e) => sum + e.debit, 0).toFixed(2)),
    totalReceived: Number(entries.reduce((sum, e) => sum + e.credit, 0).toFixed(2)),
    closingBalance: balance,
    entries,
    ageing: buyerAgeing?.buckets ?? emptyBuckets(),
  };
}

/** Bookings due soon, for the Home to-do list. */
export async function upcomingBookings(withinDays = 3, asOf = today()) {
  return db
    .select({ id: saleBookings.id, bookingCode: saleBookings.bookingCode, catchDate: saleBookings.catchDate, buyerName: buyers.buyerName, expectedBirds: saleBookings.expectedBirds })
    .from(saleBookings)
    .innerJoin(buyers, eq(saleBookings.buyerId, buyers.id))
    .where(and(eq(saleBookings.status, 'booked'), sql`${saleBookings.catchDate} <= ${addDays(asOf, withinDays)}`))
    .orderBy(asc(saleBookings.catchDate), desc(saleBookings.id));
}

/** When a sale made from a booking is cancelled, the booking is open again. */
export async function reopenBookingForSale(saleId: number) {
  await db
    .update(saleBookings)
    .set({ status: 'booked', saleId: null, updatedAt: new Date() })
    .where(and(eq(saleBookings.saleId, saleId), eq(saleBookings.status, 'converted')));
}
