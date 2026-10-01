import { eq } from 'drizzle-orm';
import { db } from '../db';
import { buyerReceiptLines, buyerReceipts, financeAccounts, operationalExpenses, payroll, pettyCashExpenses, sales } from '../db/schema';
import {
  createManualTreasuryTransaction,
  createOperationalExpense,
  createPettyCashAllocation,
  createSupplierPayment,
  postBuyerReceiptLineToTreasury,
  postPayrollToTreasury,
  reverseBuyerReceiptLineTreasuryPosting,
  reviewOperationalExpense,
  reviewPettyCashExpense,
  settleOperationalExpense,
  submitPettyCashExpense,
} from '../lib/treasury';
import { createBuyerReceiptForSale, recordBuyerReceipt } from '../lib/sales-ledger';
import { FinanceTagError, splitAmountByWeights } from '../lib/finance-tags';
import {
  categoryId,
  costCentreId,
  createAccount,
  createEmployee,
  createPurchaseOrder,
  createSale,
  createSiteWithBatch,
  createUser,
  entriesFor,
  resetDatabase,
} from './fixtures';

const DATE = '2026-09-25';

beforeEach(async () => {
  await resetDatabase();
});

describe('splitAmountByWeights', () => {
  it('splits to the cent and always sums back to the original amount', () => {
    const parts = splitAmountByWeights(100, [{ weight: 1 }, { weight: 1 }, { weight: 1 }]);
    expect(parts.map((p) => p.amount).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 2);
    expect(parts.map((p) => p.amount).sort()).toEqual([33.33, 33.33, 33.34]);
  });

  it('ignores zero-weight parts', () => {
    expect(splitAmountByWeights(50, [{ weight: 0 }, { weight: 2 }])).toEqual([{ weight: 2, amount: 50 }]);
  });
});

describe('manual money movements', () => {
  it('stores the category, cost centre and batch on the ledger line', async () => {
    const user = await createUser();
    const account = await createAccount();
    const { batch, centre } = await createSiteWithBatch();

    const transaction = await createManualTreasuryTransaction({
      transactionDate: DATE,
      transactionType: 'manual_outflow',
      financeAccountId: account.id,
      amount: 1200,
      narrative: 'Litter for house 1',
      postedBy: user.id,
      categoryId: await categoryId('litter_bedding'),
      batchId: batch.id,
    });

    expect(await entriesFor(transaction.id)).toEqual([
      expect.objectContaining({ amount: '1200.00', direction: 'outflow', categoryCode: 'litter_bedding', costCentreId: centre.id, batchId: batch.id }),
    ]);
  });

  it('rejects a line with no cost centre', async () => {
    const user = await createUser();
    const account = await createAccount();
    await expect(createManualTreasuryTransaction({
      transactionDate: DATE,
      transactionType: 'manual_outflow',
      financeAccountId: account.id,
      amount: 100,
      narrative: 'No cost centre',
      postedBy: user.id,
      categoryId: await categoryId('office_admin'),
    })).rejects.toThrow('Cost centre is required');
  });

  it('rejects an income category on money going out, and an expense category on money coming in', async () => {
    const user = await createUser();
    const account = await createAccount();
    const admin = await costCentreId('ADMIN');
    await expect(createManualTreasuryTransaction({
      transactionDate: DATE, transactionType: 'manual_outflow', financeAccountId: account.id, amount: 100,
      narrative: 'x', postedBy: user.id, categoryId: await categoryId('bird_sales'), costCentreId: admin,
    })).rejects.toBeInstanceOf(FinanceTagError);
    await expect(createManualTreasuryTransaction({
      transactionDate: DATE, transactionType: 'manual_inflow', financeAccountId: account.id, amount: 100,
      narrative: 'x', postedBy: user.id, categoryId: await categoryId('electricity'), costCentreId: admin,
    })).rejects.toBeInstanceOf(FinanceTagError);
  });

  it('rejects a batch that belongs to a different cost centre', async () => {
    const user = await createUser();
    const account = await createAccount();
    const { batch } = await createSiteWithBatch();
    await expect(createManualTreasuryTransaction({
      transactionDate: DATE, transactionType: 'manual_outflow', financeAccountId: account.id, amount: 100,
      narrative: 'x', postedBy: user.id, categoryId: await categoryId('electricity'),
      costCentreId: await costCentreId('MILL'), batchId: batch.id,
    })).rejects.toThrow('Batch does not belong to the selected cost centre');
  });

  it('tags internal transfers as transfers with no cost centre', async () => {
    const user = await createUser();
    const bank = await createAccount('bank');
    const cash = await createAccount('cash');
    const transaction = await createManualTreasuryTransaction({
      transactionDate: DATE,
      transactionType: 'internal_transfer',
      sourceFinanceAccountId: bank.id,
      destinationFinanceAccountId: cash.id,
      amount: 5000,
      narrative: 'Cash float',
      postedBy: user.id,
    });
    const entries = await entriesFor(transaction.id);
    expect(entries).toHaveLength(2);
    expect(entries.every((e) => e.categoryCode === 'internal_transfer' && e.costCentreId === null)).toBe(true);
  });
});

describe('customer receipts', () => {
  it('saves the receipt and its money line together, or neither', async () => {
    const user = await createUser();
    const account = await createAccount();
    const { batch } = await createSiteWithBatch();
    const { buyer, sale } = await createSale(batch.id, 100000);
    await db.update(sales).set({ status: 'reviewed' }).where(eq(sales.id, sale.id));

    // Posting fails (account closed) → no receipt is left behind and the sale is untouched
    await db.update(financeAccounts).set({ status: 'inactive' }).where(eq(financeAccounts.id, account.id));
    await expect(recordBuyerReceipt({
      buyerId: buyer.id, saleId: sale.id, receiptDate: DATE,
      lines: [{ paymentAmount: 100000, paymentMethod: 'cash', financeAccountId: account.id }],
      recordedBy: user.id,
    })).rejects.toThrow(/finance account not found/i);
    expect(await db.select().from(buyerReceipts)).toHaveLength(0);
    const [unchanged] = await db.select().from(sales).where(eq(sales.id, sale.id));
    expect(unchanged.status).toBe('reviewed');

    await db.update(financeAccounts).set({ status: 'active' }).where(eq(financeAccounts.id, account.id));
    const { lines } = await recordBuyerReceipt({
      buyerId: buyer.id, saleId: sale.id, receiptDate: DATE,
      lines: [{ paymentAmount: 100000, paymentMethod: 'cash', financeAccountId: account.id }],
      recordedBy: user.id,
    });
    const [savedLine] = await db.select().from(buyerReceiptLines).where(eq(buyerReceiptLines.id, lines[0].id));
    expect(savedLine.treasuryTransactionId).not.toBeNull();
    const [paid] = await db.select().from(sales).where(eq(sales.id, sale.id));
    expect(paid.status).toBe('completed');
  });

  it('splits a receipt into bird sales for the allocated sale and a customer advance for the rest, and mirrors it on reversal', async () => {
    const user = await createUser();
    const account = await createAccount();
    const { batch, centre } = await createSiteWithBatch();
    const { buyer, sale } = await createSale(batch.id, 300000);

    const { lines } = await createBuyerReceiptForSale({
      buyerId: buyer.id,
      saleId: sale.id,
      receiptDate: DATE,
      lines: [{ paymentAmount: 350000, paymentMethod: 'bank_transfer', financeAccountId: account.id }],
      recordedBy: user.id,
    });
    const posted = await postBuyerReceiptLineToTreasury({ receiptLineId: lines[0].id, financeAccountId: account.id, postedBy: user.id });

    const entries = await entriesFor(posted.treasuryTransactionId);
    expect(entries).toEqual([
      expect.objectContaining({ amount: '300000.00', direction: 'inflow', categoryCode: 'bird_sales', costCentreId: centre.id, batchId: batch.id }),
      expect.objectContaining({ amount: '50000.00', direction: 'inflow', categoryCode: 'customer_advances', costCentreId: await costCentreId('ADMIN'), batchId: null }),
    ]);

    const reversal = await reverseBuyerReceiptLineTreasuryPosting({ receiptLineId: lines[0].id, postedBy: user.id, reversalDate: DATE });
    const reversed = await entriesFor(reversal.treasuryTransactionId!);
    expect(reversed.map((e) => [e.amount, e.direction, e.categoryCode, e.batchId])).toEqual([
      ['300000.00', 'outflow', 'bird_sales', batch.id],
      ['50000.00', 'outflow', 'customer_advances', null],
    ]);
  });
});

describe('payroll payments', () => {
  it('posts net pay as wages against the employee cost centre', async () => {
    const user = await createUser();
    const account = await createAccount();
    const { site } = await createSiteWithBatch();
    const mill = await costCentreId('MILL');
    const employee = await createEmployee(site.id, mill);
    const [run] = await db.insert(payroll).values({
      employeeId: employee.id,
      payPeriod: '2026-09-01',
      baseSalary: '60000',
      workingDays: 26,
      attendedDays: '26',
      grossSalary: '60000',
      netSalary: '55200',
      status: 'approved',
    }).returning();

    const posted = await postPayrollToTreasury({ payrollId: run.id, financeAccountId: account.id, postedBy: user.id });
    expect(await entriesFor(posted.treasuryTransactionId)).toEqual([
      expect.objectContaining({ amount: '55200.00', direction: 'outflow', categoryCode: 'wages_salaries', costCentreId: mill }),
    ]);
  });
});

describe('supplier payments', () => {
  it('splits a PO payment across item-type categories in proportion to line value, into the PO cost centre', async () => {
    const user = await createUser();
    const account = await createAccount();
    const { supplier, po } = await createPurchaseOrder([
      { typeCategory: 'feed', isFeed: true, quantity: 1000, unitPrice: 150 }, // 150,000
      { typeCategory: 'health', isFeed: false, quantity: 10, unitPrice: 5000 }, // 50,000
    ]);

    const payment = await createSupplierPayment({
      supplierId: supplier.id,
      purchaseOrderId: po.id,
      paymentDate: DATE,
      financeAccountId: account.id,
      paymentMethod: 'bank_transfer',
      amount: 100000, // part payment: split 75/25
      recordedBy: user.id,
    });

    const entries = await entriesFor(payment.treasuryTransactionId!);
    const byCategory = Object.fromEntries(entries.map((e) => [e.categoryCode, e]));
    expect(byCategory.feed_raw_materials.amount).toBe('75000.00');
    expect(byCategory.medicine_vaccines.amount).toBe('25000.00');
    expect(entries.every((e) => e.costCentreId === po.costCentreId)).toBe(true);
  });

  it('uses explicit tags when given (e.g. a chick invoice with no PO)', async () => {
    const user = await createUser();
    const account = await createAccount();
    const { batch, centre } = await createSiteWithBatch();
    const { supplier } = await createPurchaseOrder([]);

    const payment = await createSupplierPayment({
      supplierId: supplier.id,
      paymentDate: DATE,
      financeAccountId: account.id,
      paymentMethod: 'bank_transfer',
      amount: 900000,
      recordedBy: user.id,
      tags: { categoryId: await categoryId('chicks'), batchId: batch.id },
    });

    expect(await entriesFor(payment.treasuryTransactionId!)).toEqual([
      expect.objectContaining({ amount: '900000.00', categoryCode: 'chicks', costCentreId: centre.id, batchId: batch.id }),
    ]);
  });

  it('falls back to "uncategorized" against Admin when nothing identifies the purchase', async () => {
    const user = await createUser();
    const account = await createAccount();
    const { supplier } = await createPurchaseOrder([]);

    const payment = await createSupplierPayment({
      supplierId: supplier.id,
      paymentDate: DATE,
      financeAccountId: account.id,
      paymentMethod: 'cash',
      amount: 1500,
      recordedBy: user.id,
    });

    expect(await entriesFor(payment.treasuryTransactionId!)).toEqual([
      expect.objectContaining({ categoryCode: 'uncategorized', costCentreId: await costCentreId('ADMIN') }),
    ]);
  });
});

describe('petty cash', () => {
  it('funds petty cash as a transfer, and posts approved expenses with their category and the manager’s site', async () => {
    const admin = await createUser();
    const { site, centre } = await createSiteWithBatch();
    const manager = await createUser({ userRole: 'farm_manager', siteId: site.id });
    const bank = await createAccount('bank');
    const petty = await createAccount('petty_cash', 0);

    const allocation = await createPettyCashAllocation({
      sourceFinanceAccountId: bank.id,
      pettyCashAccountId: petty.id,
      allocatedToUserId: manager.id,
      amount: 20000,
      allocationDate: DATE,
      purpose: 'Farm float',
      createdBy: admin.id,
    });
    const fundingEntries = await entriesFor(allocation.treasuryTransactionId);
    expect(fundingEntries.every((e) => e.categoryCode === 'internal_transfer')).toBe(true);

    const expense = await submitPettyCashExpense({
      allocationId: allocation.id,
      expenseDate: DATE,
      categoryId: await categoryId('fuel_gas'),
      amount: 3000,
      justification: 'Brooder gas',
      createdBy: manager.id,
    });
    expect(expense.expenseCategory).toBe('Fuel & Gas');
    expect(expense.costCentreId).toBe(centre.id);

    const reviewed = await reviewPettyCashExpense({ expenseId: expense.id, status: 'approved', reviewedBy: admin.id });
    expect(await entriesFor(reviewed.treasuryTransactionId!)).toEqual([
      expect.objectContaining({ amount: '3000.00', direction: 'outflow', categoryCode: 'fuel_gas', costCentreId: centre.id }),
    ]);

    const [stored] = await db.select().from(pettyCashExpenses).where(eq(pettyCashExpenses.id, expense.id));
    expect(stored.status).toBe('approved');
  });

  it('rejects an income category on a petty cash expense', async () => {
    const admin = await createUser();
    const manager = await createUser({ userRole: 'farm_manager' });
    const bank = await createAccount('bank');
    const petty = await createAccount('petty_cash', 0);
    const allocation = await createPettyCashAllocation({
      sourceFinanceAccountId: bank.id, pettyCashAccountId: petty.id, allocatedToUserId: manager.id,
      amount: 1000, allocationDate: DATE, purpose: 'x', createdBy: admin.id,
    });
    await expect(submitPettyCashExpense({
      allocationId: allocation.id, expenseDate: DATE, categoryId: await categoryId('bird_sales'),
      amount: 10, justification: 'x', createdBy: manager.id,
    })).rejects.toBeInstanceOf(FinanceTagError);
  });
});

describe('operational expenses', () => {
  it('derives the costing allocation from the cost centre and carries tags through to settlement', async () => {
    const user = await createUser();
    const account = await createAccount();
    const { site, centre } = await createSiteWithBatch();

    const siteExpense = await createOperationalExpense({
      expenseDate: DATE, categoryId: await categoryId('electricity'), siteId: site.id, amount: 45000, requestedBy: user.id,
    });
    expect(siteExpense).toEqual(expect.objectContaining({ allocationType: 'site', costCentreId: centre.id, expenseCategory: 'Electricity' }));

    const millExpense = await createOperationalExpense({
      expenseDate: DATE, categoryId: await categoryId('electricity'), costCentreId: await costCentreId('MILL'), amount: 80000, requestedBy: user.id,
    });
    expect(millExpense.allocationType).toBe('mill');

    const adminExpense = await createOperationalExpense({
      expenseDate: DATE, categoryId: await categoryId('professional_fees'), costCentreId: await costCentreId('ADMIN'), amount: 15000, requestedBy: user.id,
    });
    expect(adminExpense.allocationType).toBe('shared_overhead');

    await reviewOperationalExpense({ expenseId: siteExpense.id, status: 'approved', approvedBy: user.id });
    const settled = await settleOperationalExpense({
      expenseId: siteExpense.id, financeAccountId: account.id, paymentMethod: 'bank_transfer', paidBy: user.id,
    });
    expect(await entriesFor(settled.treasuryTransactionId!)).toEqual([
      expect.objectContaining({ amount: '45000.00', categoryCode: 'electricity', costCentreId: centre.id, batchId: null }),
    ]);

    const [stored] = await db.select().from(operationalExpenses).where(eq(operationalExpenses.id, siteExpense.id));
    expect(stored.status).toBe('paid');
  });
});
