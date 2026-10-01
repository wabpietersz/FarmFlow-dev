import { eq } from 'drizzle-orm';
import { db } from '../db';
import { businessLoans, sales, supplierInvoices, suppliers } from '../db/schema';
import { cashFlow, managementPnl, payablesAgeing, pnlByCostCentre, supplierStatement } from '../lib/finance-reports';
import { receiveBusinessLoan, recordOwnerMoney, repayBusinessLoan, listBusinessLoans } from '../lib/owner-loans';
import { autoApplyBuyerCreditToSale, recordBuyerReceipt } from '../lib/sales-ledger';
import { createManualTreasuryTransaction, createSupplierPayment, getFinanceAccountBalance } from '../lib/treasury';
import { categoryId, createAccount, createSale, createSiteWithBatch, createUser, resetDatabase } from './fixtures';

beforeEach(async () => {
  await resetDatabase();
});

describe('management P&L and cash flow', () => {
  it('reports sales, costs, advances applied later, owner money and loans from the ledger', async () => {
    const user = await createUser();
    const account = await createAccount('bank', 1_000_000);
    const { batch, centre } = await createSiteWithBatch();

    // Sale 300k; buyer pays 350k → 300k Bird Sales + 50k Customer Advance
    const { buyer, sale } = await createSale(batch.id, 300000);
    await db.update(sales).set({ status: 'reviewed', saleDate: '2026-09-20' }).where(eq(sales.id, sale.id));
    await recordBuyerReceipt({ buyerId: buyer.id, saleId: sale.id, receiptDate: '2026-09-21', lines: [{ paymentAmount: 350000, paymentMethod: 'bank_transfer', financeAccountId: account.id }], recordedBy: user.id });
    // Later a 50k sale to the same buyer is settled from that credit: no cash, but now it's Bird Sales
    const [second] = await db.insert(sales).values({ saleCode: 'SALE-2', saleType: 'live_birds', batchId: batch.id, siteId: batch.siteId, buyerId: buyer.id, saleDate: '2026-09-25', totalBirds: 100, totalWeight: '200', pricePerKg: '250', totalAmount: '50000', status: 'reviewed' }).returning();
    await autoApplyBuyerCreditToSale(buyer.id, second.id, 50000);

    // A farm cost, owner money, and a loan with one repayment
    await createManualTreasuryTransaction({ transactionDate: '2026-09-22', transactionType: 'manual_outflow', financeAccountId: account.id, amount: 80000, narrative: 'Medicine', postedBy: user.id, categoryId: await categoryId('medicine_vaccines'), batchId: batch.id });
    await recordOwnerMoney({ direction: 'in', amount: 200000, date: '2026-09-01', financeAccountId: account.id, userId: user.id });
    await recordOwnerMoney({ direction: 'out', amount: 30000, date: '2026-10-02', financeAccountId: account.id, userId: user.id });
    const loan = await receiveBusinessLoan({ lender: 'People\'s Bank', principal: 500000, receivedDate: '2026-09-05', financeAccountId: account.id, interestRate: 12, userId: user.id });
    await repayBusinessLoan({ loanId: loan.id, paymentDate: '2026-10-05', principalAmount: 20000, interestAmount: 5000, financeAccountId: account.id, userId: user.id });

    const pnl = await managementPnl({ from: '2026-09-01', to: '2026-10-31' });
    expect(pnl.months).toEqual(['2026-09', '2026-10']);
    expect(pnl.income).toEqual([expect.objectContaining({ categoryCode: 'bird_sales', total: 350000 })]);
    expect(pnl.advancesRecognised).toBe(50000);
    expect(pnl.expenses.map((l) => [l.categoryCode, l.total])).toEqual([['medicine_vaccines', 80000], ['loan_interest', 5000]]);
    expect(pnl.netProfit.total).toBe(265000);
    // Capital, drawings and loan principal are not profit or loss
    expect([...pnl.income, ...pnl.expenses].some((l) => ['owner_capital', 'owner_drawings', 'loan_received', 'loan_repayment'].includes(l.categoryCode))).toBe(false);

    // Filtered to the farm: the farm's sales and medicine; interest sits in Admin
    const farm = await managementPnl({ from: '2026-09-01', to: '2026-10-31', costCentreId: centre.id });
    expect(farm.netProfit.total).toBe(270000);
    const byCentre = await pnlByCostCentre({ from: '2026-09-01', to: '2026-10-31' });
    expect(byCentre.columns.find((c) => c.costCentreId === centre.id)).toEqual(expect.objectContaining({ income: 350000, expenses: 80000 }));
    expect(byCentre.total.net).toBe(265000);

    const flow = await cashFlow({ from: '2026-09-01', to: '2026-10-31' });
    expect(flow.openingBalance).toBe(1_000_000);
    // Operating: +300k sales −80k medicine −5k interest; financing: +50k advance +200k capital −30k drawings +500k loan −20k principal
    expect(flow.operating.total).toBe(215000);
    expect(flow.financing.total).toBe(700000);
    expect(flow.closingBalance).toBe(await getFinanceAccountBalance(account.id));
    expect(flow.balances['2026-10'].opening).toBe(flow.balances['2026-09'].closing);

    const [listed] = await listBusinessLoans();
    expect(listed).toEqual(expect.objectContaining({ outstanding: 480000, interestPaid: 5000, suggestedInterest: 4800 }));
    await expect(repayBusinessLoan({ loanId: loan.id, paymentDate: '2026-10-06', principalAmount: 500000, interestAmount: 0, financeAccountId: account.id, userId: user.id })).rejects.toThrow(/480,000/);
    await repayBusinessLoan({ loanId: loan.id, paymentDate: '2026-10-06', principalAmount: 480000, interestAmount: 0, financeAccountId: account.id, userId: user.id });
    const [repaid] = await db.select().from(businessLoans).where(eq(businessLoans.id, loan.id));
    expect(repaid.status).toBe('repaid');
  });
});

describe('payables', () => {
  it('ages unpaid supplier invoices and builds a statement', async () => {
    const user = await createUser();
    const account = await createAccount();
    const [supplier] = await db.insert(suppliers).values({ supplierName: 'Agri Feeds' }).returning();
    const [inv1] = await db.insert(supplierInvoices).values({ invoiceCode: 'INV-1', supplierId: supplier.id, invoiceReference: 'A-1', invoiceDate: '2026-08-01', dueDate: '2026-08-31', invoiceAmount: '100000', status: 'approved', createdBy: user.id }).returning();
    await db.insert(supplierInvoices).values({ invoiceCode: 'INV-2', supplierId: supplier.id, invoiceReference: 'A-2', invoiceDate: '2026-09-25', dueDate: '2026-10-25', invoiceAmount: '40000', status: 'recorded', createdBy: user.id });
    await createSupplierPayment({
      supplierId: supplier.id, supplierInvoiceAllocations: [{ supplierInvoiceId: inv1.id, allocatedAmount: 60000 }], paymentDate: '2026-09-10',
      financeAccountId: account.id, paymentMethod: 'bank_transfer', amount: 60000, recordedBy: user.id, tags: { categoryCode: 'feed_raw_materials', costCentreCode: 'MILL' },
    });

    const ageing = await payablesAgeing('2026-10-01');
    expect(ageing.totalOwed).toBe(80000);
    expect(ageing.suppliers[0]).toEqual(expect.objectContaining({ oldestDaysOverdue: 31, awaitingApproval: 40000, buckets: expect.objectContaining({ days31to60: 40000, current: 40000 }) }));

    const statement = await supplierStatement(supplier.id, '2026-09-01', '2026-10-01');
    expect(statement).toEqual(expect.objectContaining({ openingBalance: 100000, totalInvoiced: 40000, totalPaid: 60000, closingBalance: 80000 }));
  });
});
