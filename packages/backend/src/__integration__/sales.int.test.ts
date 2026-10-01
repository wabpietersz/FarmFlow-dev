import { eq } from 'drizzle-orm';
import { db } from '../db';
import { buyerReceiptLines, buyers, saleBookings, sales } from '../db/schema';
import { recordBuyerReceipt } from '../lib/sales-ledger';
import { buyerStatement, checkBuyerCredit, claimBookingForSale, createBooking, receivablesAgeing, SalesRuleError, updateBooking } from '../lib/sales-ops';
import { createAccount, createSale, createSiteWithBatch, createUser, entriesFor, resetDatabase } from './fixtures';

beforeEach(async () => {
  await resetDatabase();
});

describe('bookings', () => {
  it('cannot book more birds than are left, and becomes the sale exactly once', async () => {
    const user = await createUser();
    const { batch } = await createSiteWithBatch(); // 5000 birds placed
    const { buyer, sale } = await createSale(batch.id, 100000); // 1000 birds sold

    const booking = await createBooking({ buyerId: buyer.id, batchId: batch.id, catchDate: '2026-10-05', expectedBirds: 3000, pricePerKg: 620 }, user.id, null);
    expect(booking.bookingCode).toBe('BKG-20261005-001');

    // 5000 placed − 1000 sold − 3000 booked = 1000 left
    await expect(createBooking({ buyerId: buyer.id, batchId: batch.id, catchDate: '2026-10-06', expectedBirds: 1500, pricePerKg: 620 }, user.id, null))
      .rejects.toThrow(/Only 1,000 birds/);
    // Editing the same booking does not count it twice
    await expect(updateBooking(booking.id, { expectedBirds: 4000 }, null)).resolves.toBeDefined();

    // A sale for a different buyer cannot claim it
    const [otherBuyer] = await db.insert(buyers).values({ buyerName: 'Other buyer' }).returning();
    await expect(db.transaction((tx) => claimBookingForSale(tx, booking.id, { id: sale.id, buyerId: otherBuyer.id, batchId: batch.id })))
      .rejects.toBeInstanceOf(SalesRuleError);

    await db.transaction((tx) => claimBookingForSale(tx, booking.id, { id: sale.id, buyerId: buyer.id, batchId: batch.id }));
    const [converted] = await db.select().from(saleBookings).where(eq(saleBookings.id, booking.id));
    expect(converted).toEqual(expect.objectContaining({ status: 'converted', saleId: sale.id }));
    await expect(db.transaction((tx) => claimBookingForSale(tx, booking.id, { id: sale.id, buyerId: buyer.id, batchId: batch.id })))
      .rejects.toThrow(/already converted/);
    await expect(updateBooking(booking.id, { status: 'cancelled' }, null)).rejects.toThrow(/already a sale/);
  });
});

describe('other income', () => {
  it('posts manure/litter receipts as Other Farm Income on the farm, not Bird Sales', async () => {
    const user = await createUser();
    const account = await createAccount();
    const { site, centre } = await createSiteWithBatch();
    const [buyer] = await db.insert(buyers).values({ buyerName: 'Coconut estate' }).returning();
    const [litterSale] = await db.insert(sales).values({
      saleCode: 'SALE-OI-1', saleType: 'other_income', siteId: site.id, buyerId: buyer.id, saleDate: '2026-09-25',
      totalBirds: 0, totalWeight: '0', pricePerKg: '150', totalAmount: '30000', itemDescription: 'Litter', quantity: '200', unit: 'bags', unitPrice: '150', status: 'reviewed',
    }).returning();

    const { lines } = await recordBuyerReceipt({
      buyerId: buyer.id, saleId: litterSale.id, receiptDate: '2026-09-26',
      lines: [{ paymentAmount: 30000, paymentMethod: 'cash', financeAccountId: account.id }], recordedBy: user.id,
    });
    const [line] = await db.select().from(buyerReceiptLines).where(eq(buyerReceiptLines.id, lines[0].id));
    expect(await entriesFor(line.treasuryTransactionId!)).toEqual([
      expect.objectContaining({ amount: '30000.00', categoryCode: 'other_farm_income', costCentreId: centre.id, batchId: null }),
    ]);
  });

  it('refuses a live-bird sale without a batch', async () => {
    const [buyer] = await db.insert(buyers).values({ buyerName: 'B' }).returning();
    await expect(db.insert(sales).values({
      saleCode: 'SALE-X', saleType: 'live_birds', buyerId: buyer.id, saleDate: '2026-09-25', totalBirds: 1, totalWeight: '1', pricePerKg: '1', totalAmount: '1',
    })).rejects.toThrow();
  });
});

describe('receivables', () => {
  it('ages unpaid sales from their due date and nets off part payments', async () => {
    const user = await createUser();
    const account = await createAccount();
    const { batch } = await createSiteWithBatch();
    const { buyer, sale } = await createSale(batch.id, 100000); // sold 2026-09-20
    await db.update(buyers).set({ creditTerms: 7, creditLimit: '150000' }).where(eq(buyers.id, buyer.id));
    await db.update(sales).set({ status: 'reviewed', dueDate: '2026-09-27' }).where(eq(sales.id, sale.id));
    await recordBuyerReceipt({ buyerId: buyer.id, saleId: sale.id, receiptDate: '2026-09-28', lines: [{ paymentAmount: 40000, paymentMethod: 'cash', financeAccountId: account.id }], recordedBy: user.id });

    const early = await receivablesAgeing('2026-09-25');
    expect(early.buyers[0].buckets.current).toBe(100000); // not yet due, payment not yet received

    const ageing = await receivablesAgeing('2026-10-30'); // 33 days past due
    expect(ageing.totalOwed).toBe(60000);
    expect(ageing.buyers[0]).toEqual(expect.objectContaining({ oldestDaysOverdue: 33, buckets: expect.objectContaining({ days31to60: 60000, current: 0 }) }));

    const credit = await checkBuyerCredit(buyer.id, 100000);
    expect(credit).toEqual({ limit: 150000, owedNow: 60000, afterSale: 160000, overBy: 10000 });

    const statement = await buyerStatement(buyer.id, '2026-09-25', '2026-10-30');
    expect(statement.openingBalance).toBe(100000);
    expect(statement.totalReceived).toBe(40000);
    expect(statement.closingBalance).toBe(60000);
  });
});
