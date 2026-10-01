import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  chequeBooks,
  chequeLeaves,
  buyerReceiptAllocations,
  buyerReceiptLines,
  buyerReceipts,
  buyers,
  financeAccounts,
  employees,
  pettyCashAllocations,
  pettyCashExpenses,
  payroll,
  operationalExpenses,
  purchaseOrders,
  serviceWorkOrders,
  supplierInvoices,
  supplierPaymentAllocations,
  supplierContracts,
  batches,
  sales,
  sites,
  supplierPayments,
  suppliers,
  financeReconciliations,
  treasuryTransactionEntries,
  treasuryTransactionLinks,
  treasuryTransactions,
  users,
  costCentres,
  financeCategories,
  purchaseOrderItems,
  feedInventory,
  inventoryItemTypes,
} from '../db/schema';
import { assertPeriodOpen } from './period-locks';
import { requestApproval } from './approvals';
import {
  type EntryTagInput,
  FinanceTagError,
  ensureSiteCostCentre,
  getCostCentreByCode,
  resolveEntryTags,
  splitAmountByWeights,
} from './finance-tags';

function toIsoDate(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  return value;
}

async function getNextTreasuryTransactionCode(transactionDate: string, executor: typeof db | any = db) {
  const dateStr = transactionDate.replace(/-/g, '');
  const [countResult] = await executor
    .select({ count: sql<number>`count(*)::int` })
    .from(treasuryTransactions)
    .where(sql`${treasuryTransactions.transactionCode} LIKE ${`TRX-${dateStr}-%`}`);

  const seq = String((countResult?.count ?? 0) + 1).padStart(3, '0');
  return `TRX-${dateStr}-${seq}`;
}

async function getNextChequeBookCode(issuedDate: string, executor: typeof db | any = db) {
  const dateStr = issuedDate.replace(/-/g, '');
  const [countResult] = await executor
    .select({ count: sql<number>`count(*)::int` })
    .from(chequeBooks)
    .where(sql`${chequeBooks.bookCode} LIKE ${`CHQ-${dateStr}-%`}`);

  const seq = String((countResult?.count ?? 0) + 1).padStart(3, '0');
  return `CHQ-${dateStr}-${seq}`;
}

async function getNextSupplierPaymentCode(paymentDate: string, executor: typeof db | any = db) {
  const dateStr = paymentDate.replace(/-/g, '');
  const [countResult] = await executor
    .select({ count: sql<number>`count(*)::int` })
    .from(supplierPayments)
    .where(sql`${supplierPayments.paymentCode} LIKE ${`SPY-${dateStr}-%`}`);

  const seq = String((countResult?.count ?? 0) + 1).padStart(3, '0');
  return `SPY-${dateStr}-${seq}`;
}

export async function getFinanceAccountBalance(financeAccountId: number) {
  return getFinanceAccountBalanceAsOf(financeAccountId);
}

export async function getFinanceAccountBalanceAsOf(financeAccountId: number, asOfDate?: string) {
  const [account] = await db
    .select({
      id: financeAccounts.id,
      openingBalance: financeAccounts.openingBalance,
    })
    .from(financeAccounts)
    .where(eq(financeAccounts.id, financeAccountId))
    .limit(1);

  if (!account) {
    throw new Error('Finance account not found');
  }

  const [movement] = await db
    .select({
      netMovement: sql<number>`
        COALESCE(SUM(
          CASE
            WHEN ${treasuryTransactionEntries.entryDirection} = 'inflow' THEN ${treasuryTransactionEntries.amount}::numeric
            WHEN ${treasuryTransactionEntries.entryDirection} = 'outflow' THEN -${treasuryTransactionEntries.amount}::numeric
            ELSE 0
          END
        ), 0)::float
      `,
    })
    .from(treasuryTransactionEntries)
    .leftJoin(
      treasuryTransactions,
      eq(treasuryTransactionEntries.treasuryTransactionId, treasuryTransactions.id),
    )
    .where(
      and(
        eq(treasuryTransactionEntries.financeAccountId, financeAccountId),
        sql`${treasuryTransactions.status} in ('posted', 'cleared')`,
        ...(asOfDate ? [sql`${treasuryTransactions.transactionDate} <= ${asOfDate}`] : []),
      ),
    );

  return Number((Number(account.openingBalance) + (movement?.netMovement ?? 0)).toFixed(2));
}

export async function getFinanceAccountClearedBalance(financeAccountId: number, asOfDate?: string) {
  const [account] = await db
    .select({
      id: financeAccounts.id,
      openingBalance: financeAccounts.openingBalance,
    })
    .from(financeAccounts)
    .where(eq(financeAccounts.id, financeAccountId))
    .limit(1);

  if (!account) {
    throw new Error('Finance account not found');
  }

  const [movement] = await db
    .select({
      netMovement: sql<number>`
        COALESCE(SUM(
          CASE
            WHEN ${treasuryTransactionEntries.entryDirection} = 'inflow' THEN ${treasuryTransactionEntries.amount}::numeric
            WHEN ${treasuryTransactionEntries.entryDirection} = 'outflow' THEN -${treasuryTransactionEntries.amount}::numeric
            ELSE 0
          END
        ), 0)::float
      `,
    })
    .from(treasuryTransactionEntries)
    .leftJoin(
      treasuryTransactions,
      eq(treasuryTransactionEntries.treasuryTransactionId, treasuryTransactions.id),
    )
    .where(
      and(
        eq(treasuryTransactionEntries.financeAccountId, financeAccountId),
        sql`${treasuryTransactions.status} in ('posted', 'cleared')`,
        sql`${treasuryTransactionEntries.clearedAt} is not null`,
        ...(asOfDate ? [sql`${treasuryTransactionEntries.clearedAt} <= ${asOfDate}`] : []),
      ),
    );

  return Number((Number(account.openingBalance) + (movement?.netMovement ?? 0)).toFixed(2));
}

export async function listFinanceAccountsWithBalances() {
  const accounts = await db
    .select()
    .from(financeAccounts)
    .orderBy(asc(financeAccounts.accountName));

  return Promise.all(
    accounts.map(async (account) => ({
      ...account,
      currentBalance: await getFinanceAccountBalance(account.id),
      clearedBalance: await getFinanceAccountClearedBalance(account.id),
    })),
  );
}

async function getBuyerReceiptPostingContext(receiptLineId: number, executor: typeof db | any = db) {
  const [receiptLine] = await executor
    .select({
      lineId: buyerReceiptLines.id,
      receiptId: buyerReceipts.id,
      receiptCode: buyerReceipts.receiptCode,
      receiptDate: buyerReceipts.receiptDate,
      paymentAmount: buyerReceiptLines.paymentAmount,
      paymentMethod: buyerReceiptLines.paymentMethod,
      paymentStatus: buyerReceiptLines.paymentStatus,
      financeAccountId: buyerReceiptLines.financeAccountId,
      treasuryTransactionId: buyerReceiptLines.treasuryTransactionId,
      treasuryReversalTransactionId: buyerReceiptLines.treasuryReversalTransactionId,
      referenceNumber: buyerReceiptLines.referenceNumber,
      buyerId: buyers.id,
      buyerName: buyers.buyerName,
    })
    .from(buyerReceiptLines)
    .leftJoin(buyerReceipts, eq(buyerReceiptLines.receiptId, buyerReceipts.id))
    .leftJoin(buyers, eq(buyerReceipts.buyerId, buyers.id))
    .where(eq(buyerReceiptLines.id, receiptLineId))
    .limit(1);

  if (!receiptLine) {
    throw new Error('Buyer receipt line not found');
  }

  return receiptLine;
}

async function getBuyerReceiptSaleLinks(receiptLineId: number, executor: typeof db | any = db) {
  return executor
    .select({
      saleId: sales.id,
      saleCode: sales.saleCode,
      saleType: sales.saleType,
      batchId: sales.batchId,
      siteId: sales.siteId,
      allocatedAmount: buyerReceiptAllocations.allocatedAmount,
    })
    .from(buyerReceiptAllocations)
    .leftJoin(sales, eq(buyerReceiptAllocations.saleId, sales.id))
    .where(eq(buyerReceiptAllocations.receiptLineId, receiptLineId))
    .orderBy(desc(buyerReceiptAllocations.id));
}

type PostBuyerReceiptLineParams = {
  receiptLineId: number;
  financeAccountId?: number | null;
  postedBy: number;
};

export async function postBuyerReceiptLineToTreasury(params: PostBuyerReceiptLineParams) {
  return db.transaction((tx) => postBuyerReceiptLineWithin(tx, params));
}

/** Posts a receipt line using the caller's transaction, so the receipt and its money line commit together. */
export async function postBuyerReceiptLineWithin(tx: typeof db | any, params: PostBuyerReceiptLineParams) {
  {
    const receiptLine = await getBuyerReceiptPostingContext(params.receiptLineId, tx);
    const targetAccountId = params.financeAccountId ?? receiptLine.financeAccountId;

    if (!targetAccountId) {
      throw new Error('Finance account is required to post buyer receipt into treasury');
    }
    if (receiptLine.paymentStatus !== 'completed') {
      throw new Error('Only completed buyer receipt lines can be posted into treasury');
    }
    if (receiptLine.treasuryTransactionId && !receiptLine.treasuryReversalTransactionId) {
      return { treasuryTransactionId: receiptLine.treasuryTransactionId, posted: false };
    }

    const [account] = await tx
      .select()
      .from(financeAccounts)
      .where(and(eq(financeAccounts.id, targetAccountId), eq(financeAccounts.status, 'active')))
      .limit(1);

    if (!account) {
      throw new Error('Active finance account not found');
    }

    if (!receiptLine.receiptId) {
      throw new Error('Buyer receipt header not found');
    }
    const receiptDate = toIsoDate(receiptLine.receiptDate ?? new Date());
    const transactionCode = await getNextTreasuryTransactionCode(receiptDate, tx);
    const [treasuryTransaction] = await tx
      .insert(treasuryTransactions)
      .values({
        transactionCode,
        transactionType: 'customer_receipt',
        transactionDate: receiptDate,
        status: 'posted',
        referenceNumber: receiptLine.referenceNumber || receiptLine.receiptCode,
        counterpartyType: 'buyer',
        counterpartyId: receiptLine.buyerId,
        counterpartyNameSnapshot: receiptLine.buyerName,
        sourceModule: 'sales',
        narrative: `Buyer receipt ${receiptLine.receiptCode}`,
        createdBy: params.postedBy,
        approvedBy: params.postedBy,
        postedBy: params.postedBy,
      })
      .returning();

    const saleLinks = (await getBuyerReceiptSaleLinks(receiptLine.lineId, tx)).filter(
      (saleLink: { saleId: number | null }) => saleLink.saleId,
    );
    await insertTaggedEntries(
      treasuryTransaction.id,
      await buildReceiptEntries({
        financeAccountId: targetAccountId,
        entryDirection: 'inflow',
        totalAmount: Number(receiptLine.paymentAmount),
        valueDate: receiptDate,
        notes: `${receiptLine.paymentMethod} receipt`,
        saleLinks,
      }),
      tx,
    );
    await tx.insert(treasuryTransactionLinks).values([
      {
        treasuryTransactionId: treasuryTransaction.id,
        sourceModule: 'sales',
        sourceEntityType: 'buyer_receipt',
        sourceEntityId: receiptLine.receiptId,
        sourceCodeSnapshot: receiptLine.receiptCode,
        allocatedAmount: Number(receiptLine.paymentAmount).toFixed(2),
      },
      {
        treasuryTransactionId: treasuryTransaction.id,
        sourceModule: 'sales',
        sourceEntityType: 'buyer_receipt_line',
        sourceEntityId: receiptLine.lineId,
        sourceCodeSnapshot: receiptLine.receiptCode,
        allocatedAmount: Number(receiptLine.paymentAmount).toFixed(2),
      },
      ...saleLinks.map((saleLink: { saleId: number | null; saleCode: string | null; allocatedAmount: string | number }) => ({
        treasuryTransactionId: treasuryTransaction.id,
        sourceModule: 'sales',
        sourceEntityType: 'sale',
        sourceEntityId: saleLink.saleId as number,
        sourceCodeSnapshot: saleLink.saleCode,
        allocatedAmount: Number(saleLink.allocatedAmount).toFixed(2),
      })),
    ]);

    await tx
      .update(buyerReceiptLines)
      .set({
        financeAccountId: targetAccountId,
        treasuryTransactionId: treasuryTransaction.id,
        treasuryReversalTransactionId: null,
        updatedAt: new Date(),
      })
      .where(eq(buyerReceiptLines.id, receiptLine.lineId));

    return { treasuryTransactionId: treasuryTransaction.id, posted: true };
  }
}

type ReverseBuyerReceiptLineParams = {
  receiptLineId: number;
  postedBy: number;
  reversalDate?: string;
};

export async function reverseBuyerReceiptLineTreasuryPosting(params: ReverseBuyerReceiptLineParams) {
  return db.transaction((tx) => reverseBuyerReceiptLineWithin(tx, params));
}

/** Reverses a receipt line's posting using the caller's transaction. */
export async function reverseBuyerReceiptLineWithin(tx: typeof db | any, params: ReverseBuyerReceiptLineParams) {
  {
    const receiptLine = await getBuyerReceiptPostingContext(params.receiptLineId, tx);

    if (!receiptLine.treasuryTransactionId || !receiptLine.financeAccountId) {
      return { treasuryTransactionId: null, reversed: false };
    }
    if (receiptLine.treasuryReversalTransactionId) {
      return {
        treasuryTransactionId: receiptLine.treasuryReversalTransactionId,
        reversed: false,
      };
    }

    const reversalDate = params.reversalDate ?? new Date().toISOString().split('T')[0];
    const transactionCode = await getNextTreasuryTransactionCode(reversalDate, tx);
    const [reversalTransaction] = await tx
      .insert(treasuryTransactions)
      .values({
        transactionCode,
        transactionType: 'customer_receipt_reversal',
        transactionDate: reversalDate,
        status: 'posted',
        referenceNumber: receiptLine.referenceNumber || receiptLine.receiptCode,
        counterpartyType: 'buyer',
        counterpartyId: receiptLine.buyerId,
        counterpartyNameSnapshot: receiptLine.buyerName,
        sourceModule: 'sales',
        narrative: `Buyer receipt reversal ${receiptLine.receiptCode}`,
        createdBy: params.postedBy,
        approvedBy: params.postedBy,
        postedBy: params.postedBy,
      })
      .returning();

    await insertMirroredEntries({
      originalTransactionId: receiptLine.treasuryTransactionId,
      reversalTransactionId: reversalTransaction.id,
      valueDate: reversalDate,
      notes: `Reversal for ${receiptLine.receiptCode}`,
      executor: tx,
    });

    const saleLinks = (await getBuyerReceiptSaleLinks(receiptLine.lineId, tx)).filter(
      (saleLink: { saleId: number | null }) => saleLink.saleId,
    );
    await tx.insert(treasuryTransactionLinks).values([
      {
        treasuryTransactionId: reversalTransaction.id,
        sourceModule: 'sales',
        sourceEntityType: 'buyer_receipt_line',
        sourceEntityId: receiptLine.lineId,
        sourceCodeSnapshot: receiptLine.receiptCode,
        allocatedAmount: Number(receiptLine.paymentAmount).toFixed(2),
      },
      ...saleLinks.map((saleLink: { saleId: number | null; saleCode: string | null; allocatedAmount: string | number }) => ({
        treasuryTransactionId: reversalTransaction.id,
        sourceModule: 'sales',
        sourceEntityType: 'sale',
        sourceEntityId: saleLink.saleId as number,
        sourceCodeSnapshot: saleLink.saleCode,
        allocatedAmount: Number(saleLink.allocatedAmount).toFixed(2),
      })),
    ]);

    await tx
      .update(buyerReceiptLines)
      .set({
        treasuryReversalTransactionId: reversalTransaction.id,
        updatedAt: new Date(),
      })
      .where(eq(buyerReceiptLines.id, receiptLine.lineId));

    return { treasuryTransactionId: reversalTransaction.id, reversed: true };
  }
}

type PostPayrollParams = {
  payrollId: number;
  financeAccountId: number;
  postedBy: number;
  paymentMethod?: 'cash' | 'cheque' | 'bank_transfer';
  chequeLeafId?: number | null;
  payDate?: string;
};

export async function postPayrollToTreasury(params: PostPayrollParams) {
  return db.transaction((tx) => postPayrollWithin(tx, params));
}

/**
 * Pays one approved payroll and marks it paid, in the caller's transaction.
 * The cash that leaves is the net pay, split so each part lands in the right place:
 *   Wages & Salaries (out)   gross pay less manual deductions        → employee's cost centre
 *   EPF withheld (in)        employee EPF kept back, paid over later  → employee's cost centre
 *   Staff advances (in)      advance/loan instalments recovered       → employee's cost centre
 */
export async function postPayrollWithin(tx: typeof db | any, params: PostPayrollParams) {
  const [payrollRecord] = await tx
    .select({
      id: payroll.id,
      payPeriod: payroll.payPeriod,
      grossSalary: payroll.grossSalary,
      otherDeductions: payroll.otherDeductions,
      epfEmployee: payroll.epfEmployee,
      loanRecovery: payroll.loanRecovery,
      netSalary: payroll.netSalary,
      status: payroll.status,
      treasuryTransactionId: payroll.treasuryTransactionId,
      employeeId: employees.id,
      employeeName: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
      employeeCostCentreId: employees.costCentreId,
      employeeSiteId: employees.siteId,
    })
    .from(payroll)
    .leftJoin(employees, eq(payroll.employeeId, employees.id))
    .where(eq(payroll.id, params.payrollId))
    .limit(1);

  if (!payrollRecord) {
    throw new Error('Payroll record not found');
  }
  if (payrollRecord.treasuryTransactionId) {
    return { treasuryTransactionId: payrollRecord.treasuryTransactionId, posted: false };
  }
  if (payrollRecord.status !== 'approved') {
    throw new FinanceTagError(`Only approved payroll can be paid (this one is ${payrollRecord.status})`);
  }

  const paymentMethod = params.paymentMethod ?? 'bank_transfer';
  const payDate = params.payDate ?? new Date().toISOString().split('T')[0];
  await assertPeriodOpen(payDate, 'financial');
  if (paymentMethod === 'cheque') {
    await ensureChequeEnabledCurrentAccount(params.financeAccountId, tx);
  } else {
    await ensureActiveFinanceAccount(params.financeAccountId, tx);
  }
  const chequeLeaf = paymentMethod === 'cheque' && params.chequeLeafId
    ? await getIssuableChequeLeaf(params.chequeLeafId, params.financeAccountId, tx)
    : null;

  const net = Number(payrollRecord.netSalary);
  const epfWithheld = Number(payrollRecord.epfEmployee ?? 0);
  const recovered = Number(payrollRecord.loanRecovery ?? 0);
  const wages = Number((net + epfWithheld + recovered).toFixed(2));
  const tags = { costCentreId: payrollRecord.employeeCostCentreId, siteId: payrollRecord.employeeSiteId };
  const base = { financeAccountId: params.financeAccountId, valueDate: payDate };
  const entries: TreasuryEntryInput[] = [
    { ...base, entryDirection: 'outflow', amount: wages, notes: `Pay ${payrollRecord.employeeName}`, tags: { categoryCode: 'wages_salaries', ...tags } },
  ];
  if (epfWithheld > 0) {
    entries.push({ ...base, entryDirection: 'inflow', amount: epfWithheld, notes: 'Employee EPF withheld', tags: { categoryCode: 'epf_withheld', ...tags } });
  }
  if (recovered > 0) {
    entries.push({ ...base, entryDirection: 'inflow', amount: recovered, notes: 'Advance/loan recovered', tags: { categoryCode: 'staff_advances', ...tags } });
  }

  const treasuryTransaction = await createTreasuryTransactionRecord({
    transactionType: 'payroll_disbursement',
    transactionDate: payDate,
    status: paymentMethod === 'cheque' ? 'pending' : 'posted',
    referenceNumber: `PAYROLL-${payrollRecord.id}`,
    counterpartyType: 'employee',
    counterpartyId: payrollRecord.employeeId,
    counterpartyNameSnapshot: payrollRecord.employeeName,
    sourceModule: 'payroll',
    narrative: `Payroll disbursement for ${payrollRecord.employeeName}`,
    createdBy: params.postedBy,
    entries,
    links: [{ sourceModule: 'payroll', sourceEntityType: 'payroll', sourceEntityId: payrollRecord.id, sourceCodeSnapshot: `PAYROLL-${payrollRecord.id}`, allocatedAmount: net }],
    executor: tx,
  });

  await tx
    .update(payroll)
    .set({
      status: 'paid',
      paidDate: payDate,
      financeAccountId: params.financeAccountId,
      paymentMethod,
      chequeLeafId: chequeLeaf?.id ?? null,
      treasuryTransactionId: treasuryTransaction.id,
      updatedAt: new Date(),
    })
    .where(eq(payroll.id, payrollRecord.id));

  if (chequeLeaf) {
    await tx
      .update(chequeLeaves)
      .set({
        status: 'issued',
        issueDate: payDate,
        amount: net.toFixed(2),
        payeeName: payrollRecord.employeeName,
        treasuryTransactionId: treasuryTransaction.id,
        sourceModule: 'payroll',
        sourceEntityType: 'payroll',
        sourceEntityId: payrollRecord.id,
        notes: `Payroll cheque for ${payrollRecord.employeeName}`,
        updatedAt: new Date(),
      })
      .where(eq(chequeLeaves.id, chequeLeaf.id));
  }

  return { treasuryTransactionId: treasuryTransaction.id, posted: true, paidDate: payDate };
}

export type TreasuryEntryInput = {
  financeAccountId: number;
  entryDirection: 'inflow' | 'outflow';
  amount: number;
  valueDate: string;
  notes?: string;
  tags: EntryTagInput;
};

const TRANSFER_TAGS: EntryTagInput = { categoryCode: 'internal_transfer' };

/** The only way ledger lines are written: every line's tags are resolved and validated first. */
async function insertTaggedEntries(
  treasuryTransactionId: number,
  entries: TreasuryEntryInput[],
  executor: typeof db | any,
) {
  if (entries.length === 0) {
    throw new Error('A treasury transaction needs at least one entry');
  }
  const rows = [];
  for (const entry of entries) {
    const tags = await resolveEntryTags(entry.tags, executor);
    rows.push({
      treasuryTransactionId,
      financeAccountId: entry.financeAccountId,
      entryDirection: entry.entryDirection,
      amount: Number(entry.amount).toFixed(2),
      categoryId: tags.categoryId,
      costCentreId: tags.costCentreId,
      batchId: tags.batchId,
      valueDate: entry.valueDate,
      notes: entry.notes ?? null,
    });
  }
  await executor.insert(treasuryTransactionEntries).values(rows);
}

/** Reversals mirror the original lines (same account and tags, opposite direction). */
async function insertMirroredEntries(params: {
  originalTransactionId: number;
  reversalTransactionId: number;
  valueDate: string;
  notes: string;
  executor: typeof db | any;
}) {
  const originalEntries = await params.executor
    .select()
    .from(treasuryTransactionEntries)
    .where(eq(treasuryTransactionEntries.treasuryTransactionId, params.originalTransactionId));
  if (originalEntries.length === 0) {
    throw new Error('Original treasury transaction has no entries to reverse');
  }
  await params.executor.insert(treasuryTransactionEntries).values(
    originalEntries.map((entry: typeof treasuryTransactionEntries.$inferSelect) => ({
      treasuryTransactionId: params.reversalTransactionId,
      financeAccountId: entry.financeAccountId,
      entryDirection: entry.entryDirection === 'inflow' ? 'outflow' : 'inflow',
      amount: entry.amount,
      categoryId: entry.categoryId,
      costCentreId: entry.costCentreId,
      batchId: entry.batchId,
      valueDate: params.valueDate,
      notes: params.notes,
    })),
  );
}

/** A receipt line splits into Bird Sales per allocated sale (tagged to that batch); any remainder is a customer advance. */
async function buildReceiptEntries(params: {
  financeAccountId: number;
  entryDirection: 'inflow' | 'outflow';
  totalAmount: number;
  valueDate: string;
  notes: string;
  saleLinks: Array<{ saleId: number | null; saleType?: string | null; batchId: number | null; siteId?: number | null; allocatedAmount: string | number }>;
}): Promise<TreasuryEntryInput[]> {
  const entries: TreasuryEntryInput[] = [];
  let allocatedCents = 0;
  for (const link of params.saleLinks) {
    const cents = Math.round(Number(link.allocatedAmount) * 100);
    if (cents <= 0) continue;
    // Bird sales belong to their batch; manure/litter/scrap go to Other Farm Income on the batch or farm
    const isOtherIncome = link.saleType === 'other_income';
    if (!link.batchId && !(isOtherIncome && link.siteId)) continue;
    allocatedCents += cents;
    entries.push({
      financeAccountId: params.financeAccountId,
      entryDirection: params.entryDirection,
      amount: cents / 100,
      valueDate: params.valueDate,
      notes: params.notes,
      tags: isOtherIncome
        ? (link.batchId ? { categoryCode: 'other_farm_income', batchId: link.batchId } : { categoryCode: 'other_farm_income', siteId: link.siteId })
        : { categoryCode: 'bird_sales', batchId: link.batchId },
    });
  }
  const remainderCents = Math.round(params.totalAmount * 100) - allocatedCents;
  if (remainderCents < 0) {
    throw new Error('Receipt allocations exceed the receipt amount');
  }
  if (remainderCents > 0) {
    entries.push({
      financeAccountId: params.financeAccountId,
      entryDirection: params.entryDirection,
      amount: remainderCents / 100,
      valueDate: params.valueDate,
      notes: `${params.notes} (unallocated credit)`,
      tags: { categoryCode: 'customer_advances', costCentreCode: 'ADMIN' },
    });
  }
  return entries;
}

type TreasuryLinkInput = {
  sourceModule: string;
  sourceEntityType: string;
  sourceEntityId: number;
  sourceCodeSnapshot?: string | null;
  allocatedAmount?: number | null;
};

export async function createTreasuryTransactionRecord(params: {
  transactionType: string;
  transactionDate: string;
  status?: string;
  referenceNumber?: string | null;
  counterpartyType?: string | null;
  counterpartyId?: number | null;
  counterpartyNameSnapshot?: string | null;
  sourceModule?: string | null;
  narrative: string;
  createdBy: number;
  approvedBy?: number | null;
  postedBy?: number | null;
  entries: TreasuryEntryInput[];
  links?: TreasuryLinkInput[];
  executor: typeof db | any;
}) {
  const transactionCode = await getNextTreasuryTransactionCode(params.transactionDate, params.executor);
  const [transaction] = await params.executor
    .insert(treasuryTransactions)
    .values({
      transactionCode,
      transactionType: params.transactionType,
      transactionDate: params.transactionDate,
      status: params.status ?? 'posted',
      referenceNumber: params.referenceNumber ?? null,
      counterpartyType: params.counterpartyType ?? null,
      counterpartyId: params.counterpartyId ?? null,
      counterpartyNameSnapshot: params.counterpartyNameSnapshot ?? null,
      sourceModule: params.sourceModule ?? null,
      narrative: params.narrative,
      createdBy: params.createdBy,
      approvedBy: params.approvedBy ?? params.createdBy,
      postedBy: params.postedBy ?? params.createdBy,
    })
    .returning();

  await insertTaggedEntries(transaction.id, params.entries, params.executor);

  if (params.links && params.links.length > 0) {
    await params.executor.insert(treasuryTransactionLinks).values(
      params.links.map((link) => ({
        treasuryTransactionId: transaction.id,
        sourceModule: link.sourceModule,
        sourceEntityType: link.sourceEntityType,
        sourceEntityId: link.sourceEntityId,
        sourceCodeSnapshot: link.sourceCodeSnapshot ?? null,
        allocatedAmount:
          typeof link.allocatedAmount === 'number' ? Number(link.allocatedAmount).toFixed(2) : null,
      })),
    );
  }

  return transaction;
}

function buildTreasuryOwnedLink(args: {
  transactionId: number;
  transactionType: string;
  sourceCodeSnapshot?: string | null;
  amount?: number | null;
}) {
  return {
    treasuryTransactionId: args.transactionId,
    sourceModule: 'treasury',
    sourceEntityType: args.transactionType,
    sourceEntityId: args.transactionId,
    sourceCodeSnapshot: args.sourceCodeSnapshot ?? null,
    allocatedAmount:
      typeof args.amount === 'number' ? Number(args.amount).toFixed(2) : null,
  };
}

export async function ensureActiveFinanceAccount(
  financeAccountId: number,
  executor: typeof db | any = db,
) {
  const [account] = await executor
    .select()
    .from(financeAccounts)
    .where(and(eq(financeAccounts.id, financeAccountId), eq(financeAccounts.status, 'active')))
    .limit(1);

  if (!account) {
    throw new Error('Active finance account not found');
  }

  return account;
}

async function ensureChequeEnabledCurrentAccount(
  financeAccountId: number,
  executor: typeof db | any = db,
) {
  const account = await ensureActiveFinanceAccount(financeAccountId, executor);
  if (account.accountType !== 'current' || !account.allowsCheque) {
    throw new Error('Selected account must be a cheque-enabled current account');
  }

  return account;
}

async function getIssuableChequeLeaf(
  chequeLeafId: number,
  financeAccountId: number,
  executor: typeof db | any = db,
) {
  const [leaf] = await executor
    .select()
    .from(chequeLeaves)
    .where(eq(chequeLeaves.id, chequeLeafId))
    .limit(1);

  if (!leaf) {
    throw new Error('Cheque leaf not found');
  }
  if (leaf.financeAccountId !== financeAccountId) {
    throw new Error('Cheque leaf does not belong to the selected finance account');
  }
  if (leaf.status !== 'available') {
    throw new Error('Cheque leaf is not available');
  }

  return leaf;
}

async function getNextPettyCashAllocationCode(
  allocationDate: string,
  executor: typeof db | any = db,
) {
  const dateStr = allocationDate.replace(/-/g, '');
  const [countResult] = await executor
    .select({ count: sql<number>`count(*)::int` })
    .from(pettyCashAllocations)
    .where(sql`${pettyCashAllocations.allocationCode} LIKE ${`PCA-${dateStr}-%`}`);

  const seq = String((countResult?.count ?? 0) + 1).padStart(3, '0');
  return `PCA-${dateStr}-${seq}`;
}

async function getNextOperationalExpenseCode(
  expenseDate: string,
  executor: typeof db | any = db,
) {
  const dateStr = expenseDate.replace(/-/g, '');
  const [countResult] = await executor
    .select({ count: sql<number>`count(*)::int` })
    .from(operationalExpenses)
    .where(sql`${operationalExpenses.expenseCode} LIKE ${`OPE-${dateStr}-%`}`);

  const seq = String((countResult?.count ?? 0) + 1).padStart(3, '0');
  return `OPE-${dateStr}-${seq}`;
}

async function refreshPettyCashAllocationStatus(
  allocationId: number,
  executor: typeof db | any = db,
) {
  const expenses = await executor
    .select({
      status: pettyCashExpenses.status,
    })
    .from(pettyCashExpenses)
    .where(eq(pettyCashExpenses.allocationId, allocationId));

  let nextStatus = 'allocated';
  if (expenses.length > 0) {
    const hasSubmitted = expenses.some((expense: { status: string }) => expense.status === 'submitted');
    nextStatus = hasSubmitted ? 'submitted' : 'reviewed';
  }

  await executor
    .update(pettyCashAllocations)
    .set({
      status: nextStatus,
      updatedAt: new Date(),
    })
    .where(eq(pettyCashAllocations.id, allocationId));

  return nextStatus;
}

async function getCostCentreById(costCentreId: number, executor: typeof db | any) {
  const [centre] = await executor.select().from(costCentres).where(eq(costCentres.id, costCentreId)).limit(1);
  if (!centre) {
    throw new FinanceTagError('Cost centre not found');
  }
  return centre as typeof costCentres.$inferSelect;
}

/** Income categories only take money in; expense categories only take money out. Financing/suspense go either way. */
async function assertCategoryFitsDirection(
  categoryId: number | null,
  direction: 'inflow' | 'outflow',
  executor: typeof db | any,
) {
  if (!categoryId) {
    throw new FinanceTagError('Finance category is required');
  }
  const [category] = await executor
    .select()
    .from(financeCategories)
    .where(eq(financeCategories.id, categoryId))
    .limit(1);
  if (!category) {
    throw new FinanceTagError('Finance category not found');
  }
  if (category.categoryType === 'income' && direction === 'outflow') {
    throw new FinanceTagError(`"${category.name}" is an income category and cannot be used for money going out`);
  }
  if (category.categoryType === 'expense' && direction === 'inflow') {
    throw new FinanceTagError(`"${category.name}" is an expense category and cannot be used for money coming in`);
  }
  if (category.categoryType === 'transfer') {
    throw new FinanceTagError('Use an internal transfer to move money between accounts');
  }
  return category as typeof financeCategories.$inferSelect;
}

/**
 * Supplier payments are tagged by what was bought: explicit tags win; otherwise the payment is split
 * across the linked PO lines by item-type category into the PO's cost centre; otherwise the supplier's
 * default category (or "uncategorized") against Admin.
 */
async function buildSupplierPaymentEntries(params: {
  financeAccountId: number;
  amount: number;
  valueDate: string;
  notes: string;
  explicitTags: EntryTagInput | null;
  purchaseOrderIds: number[];
  supplierDefaultCategoryId: number | null;
  executor: typeof db | any;
}): Promise<TreasuryEntryInput[]> {
  const base = {
    financeAccountId: params.financeAccountId,
    entryDirection: 'outflow' as const,
    valueDate: params.valueDate,
    notes: params.notes,
  };

  if (params.explicitTags && (params.explicitTags.categoryId || params.explicitTags.categoryCode)) {
    return [{ ...base, amount: params.amount, tags: params.explicitTags }];
  }

  if (params.purchaseOrderIds.length > 0) {
    const lines = await params.executor
      .select({
        purchaseOrderId: purchaseOrderItems.purchaseOrderId,
        lineValue: sql<number>`(${purchaseOrderItems.orderedQuantity}::numeric * ${purchaseOrderItems.unitPrice}::numeric)::float`,
        categoryId: inventoryItemTypes.financeCategoryId,
        costCentreId: purchaseOrders.costCentreId,
      })
      .from(purchaseOrderItems)
      .innerJoin(purchaseOrders, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
      .innerJoin(feedInventory, eq(purchaseOrderItems.inventoryItemId, feedInventory.id))
      .leftJoin(inventoryItemTypes, eq(feedInventory.itemTypeId, inventoryItemTypes.id))
      .where(inArray(purchaseOrderItems.purchaseOrderId, params.purchaseOrderIds));

    const admin = await getCostCentreByCode('ADMIN', params.executor);
    const groups = new Map<string, { categoryId: number | null; costCentreId: number; weight: number }>();
    for (const line of lines as Array<{ lineValue: number; categoryId: number | null; costCentreId: number | null }>) {
      const categoryId = line.categoryId ?? params.supplierDefaultCategoryId;
      const costCentreId = line.costCentreId ?? admin.id;
      const key = `${categoryId ?? 'x'}:${costCentreId}`;
      const group = groups.get(key) ?? { categoryId, costCentreId, weight: 0 };
      group.weight += Number(line.lineValue) || 0;
      groups.set(key, group);
    }

    const parts = splitAmountByWeights(params.amount, [...groups.values()]);
    if (parts.length > 0) {
      return parts.map((part) => ({
        ...base,
        amount: part.amount,
        tags: part.categoryId
          ? { categoryId: part.categoryId, costCentreId: part.costCentreId }
          : { categoryCode: 'uncategorized', costCentreId: part.costCentreId },
      }));
    }
  }

  return [{
    ...base,
    amount: params.amount,
    tags: {
      ...(params.supplierDefaultCategoryId ? { categoryId: params.supplierDefaultCategoryId } : { categoryCode: 'uncategorized' }),
      costCentreId: params.explicitTags?.costCentreId ?? null,
      batchId: params.explicitTags?.batchId ?? null,
      costCentreCode: params.explicitTags?.costCentreId || params.explicitTags?.batchId ? null : 'ADMIN',
    },
  }];
}

export async function createManualTreasuryTransaction(params: {
  transactionDate: string;
  transactionType: 'manual_inflow' | 'manual_outflow' | 'internal_transfer';
  financeAccountId?: number;
  sourceFinanceAccountId?: number;
  destinationFinanceAccountId?: number;
  amount: number;
  referenceNumber?: string | null;
  counterpartyName?: string | null;
  narrative: string;
  postedBy: number;
  sourceLink?: Omit<TreasuryLinkInput, 'allocatedAmount'> | null;
  categoryId?: number | null;
  costCentreId?: number | null;
  batchId?: number | null;
  /** Money out over the approval limit: saved as pending_approval (not in balances) with an approval request */
  approval?: { requestedBy: number; summary: string } | null;
}) {
  return db.transaction(async (tx) => {
    await assertPeriodOpen(params.transactionDate, 'financial');
    const manualLinks: TreasuryLinkInput[] = params.sourceLink
      ? [{
          ...params.sourceLink,
          allocatedAmount: params.amount,
        }]
      : [];

    if (params.transactionType === 'internal_transfer') {
      if (!params.sourceFinanceAccountId || !params.destinationFinanceAccountId) {
        throw new Error('Transfer accounts are required');
      }
      await ensureActiveFinanceAccount(params.sourceFinanceAccountId, tx);
      await ensureActiveFinanceAccount(params.destinationFinanceAccountId, tx);

      const transaction = await createTreasuryTransactionRecord({
        transactionType: 'internal_transfer',
        transactionDate: params.transactionDate,
        referenceNumber: params.referenceNumber,
        counterpartyNameSnapshot: params.counterpartyName ?? 'Internal transfer',
        sourceModule: 'treasury',
        narrative: params.narrative,
        createdBy: params.postedBy,
        entries: [
          {
            financeAccountId: params.sourceFinanceAccountId,
            entryDirection: 'outflow',
            amount: params.amount,
            valueDate: params.transactionDate,
            notes: params.narrative,
            tags: TRANSFER_TAGS,
          },
          {
            financeAccountId: params.destinationFinanceAccountId,
            entryDirection: 'inflow',
            amount: params.amount,
            valueDate: params.transactionDate,
            notes: params.narrative,
            tags: TRANSFER_TAGS,
          },
        ],
        links: manualLinks,
        executor: tx,
      });

      if (manualLinks.length === 0) {
        await tx.insert(treasuryTransactionLinks).values(
          buildTreasuryOwnedLink({
            transactionId: transaction.id,
            transactionType: params.transactionType,
            sourceCodeSnapshot: params.referenceNumber ?? transaction.transactionCode,
            amount: params.amount,
          }),
        );
      }

      return transaction;
    }

    if (!params.financeAccountId) {
      throw new Error('Finance account is required');
    }
    await ensureActiveFinanceAccount(params.financeAccountId, tx);

    const direction = params.transactionType === 'manual_inflow' ? 'inflow' : 'outflow';
    await assertCategoryFitsDirection(params.categoryId ?? null, direction, tx);
    const waitsForApproval = direction === 'outflow' && !!params.approval;
    const transaction = await createTreasuryTransactionRecord({
      transactionType: params.transactionType,
      status: waitsForApproval ? 'pending_approval' : 'posted',
      transactionDate: params.transactionDate,
      referenceNumber: params.referenceNumber,
      counterpartyNameSnapshot: params.counterpartyName ?? null,
      sourceModule: 'treasury',
      narrative: params.narrative,
      createdBy: params.postedBy,
      entries: [
        {
          financeAccountId: params.financeAccountId,
          entryDirection: direction,
          amount: params.amount,
          valueDate: params.transactionDate,
          notes: params.narrative,
          tags: {
            categoryId: params.categoryId,
            costCentreId: params.costCentreId,
            batchId: params.batchId,
          },
        },
      ],
      links: manualLinks,
      executor: tx,
    });

    if (manualLinks.length === 0) {
      await tx.insert(treasuryTransactionLinks).values(
        buildTreasuryOwnedLink({
          transactionId: transaction.id,
          transactionType: params.transactionType,
          sourceCodeSnapshot: params.referenceNumber ?? transaction.transactionCode,
          amount: params.amount,
        }),
      );
    }

    if (waitsForApproval) {
      await requestApproval(tx, { entityType: 'money_out', entityId: transaction.id, amount: params.amount, summary: params.approval!.summary, requestedBy: params.approval!.requestedBy });
    }

    return transaction;
  });
}

export async function createChequeBook(params: {
  financeAccountId: number;
  bookCode?: string | null;
  startNumber: number;
  endNumber: number;
  issuedDate: string;
  createdBy: number;
}) {
  return db.transaction(async (tx) => {
    await ensureChequeEnabledCurrentAccount(params.financeAccountId, tx);

    const width = Math.max(String(params.startNumber).length, String(params.endNumber).length);
    const generatedNumbers = Array.from(
      { length: params.endNumber - params.startNumber + 1 },
      (_, index) => String(params.startNumber + index).padStart(width, '0'),
    );

    const existingLeaves = await tx
      .select({ chequeNumber: chequeLeaves.chequeNumber })
      .from(chequeLeaves)
      .where(inArray(chequeLeaves.chequeNumber, generatedNumbers));

    if (existingLeaves.length > 0) {
      throw new Error('One or more cheque numbers already exist');
    }

    const bookCode = params.bookCode?.trim() || await getNextChequeBookCode(params.issuedDate, tx);
    const [book] = await tx
      .insert(chequeBooks)
      .values({
        financeAccountId: params.financeAccountId,
        bookCode,
        startNumber: params.startNumber,
        endNumber: params.endNumber,
        issuedDate: params.issuedDate,
        status: 'active',
        createdBy: params.createdBy,
      })
      .returning();

    await tx.insert(chequeLeaves).values(
      generatedNumbers.map((chequeNumber) => ({
        chequeBookId: book.id,
        financeAccountId: params.financeAccountId,
        chequeNumber,
        status: 'available',
      })),
    );

    return book;
  });
}

export async function updateChequeLeafStatus(params: {
  chequeLeafId: number;
  status: 'cleared' | 'bounced' | 'voided';
  effectiveDate?: string;
  notes?: string | null;
}) {
  return db.transaction(async (tx) => {
    const effectiveDate = params.effectiveDate ?? new Date().toISOString().split('T')[0];
    await assertPeriodOpen(effectiveDate, 'financial');
    const [leaf] = await tx
      .select({
        id: chequeLeaves.id,
        status: chequeLeaves.status,
        treasuryTransactionId: chequeLeaves.treasuryTransactionId,
        sourceModule: chequeLeaves.sourceModule,
        sourceEntityType: chequeLeaves.sourceEntityType,
        sourceEntityId: chequeLeaves.sourceEntityId,
      })
      .from(chequeLeaves)
      .where(eq(chequeLeaves.id, params.chequeLeafId))
      .limit(1);

    if (!leaf) {
      throw new Error('Cheque leaf not found');
    }
    if (leaf.status === 'available') {
      throw new Error('Cheque leaf has not been issued');
    }
    if (leaf.status !== 'issued') {
      throw new Error('Only issued cheques can change status');
    }
    if (params.status === 'cleared' && leaf.status !== 'issued') {
      throw new Error('Only issued cheques can be cleared');
    }

    await tx
      .update(chequeLeaves)
      .set({
        status: params.status,
        clearDate: params.status === 'cleared' ? effectiveDate : null,
        notes: params.notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(chequeLeaves.id, leaf.id));

    if (leaf.treasuryTransactionId) {
      await tx
        .update(treasuryTransactions)
        .set({
          status: params.status,
          updatedAt: new Date(),
        })
        .where(eq(treasuryTransactions.id, leaf.treasuryTransactionId));
    }

    if (leaf.sourceModule === 'inventory' && leaf.sourceEntityType === 'supplier_payment' && leaf.sourceEntityId) {
      await tx
        .update(supplierPayments)
        .set({
          paymentStatus: params.status === 'cleared' ? 'completed' : params.status,
          updatedAt: new Date(),
        })
        .where(eq(supplierPayments.id, leaf.sourceEntityId));

      await tx
        .update(serviceWorkOrders)
        .set({
          status: params.status === 'cleared' ? 'paid' : params.status,
          updatedAt: new Date(),
        })
        .where(eq(serviceWorkOrders.supplierPaymentId, leaf.sourceEntityId));
    }

    const [updatedLeaf] = await tx.select().from(chequeLeaves).where(eq(chequeLeaves.id, leaf.id)).limit(1);
    return updatedLeaf;
  });
}

export async function createSupplierPayment(params: {
  supplierId: number;
  purchaseOrderId?: number | null;
  supplierInvoiceId?: number | null;
  supplierInvoiceAllocations?: Array<{ supplierInvoiceId: number; allocatedAmount: number }> | null;
  paymentDate: string;
  financeAccountId: number;
  paymentMethod: 'cash' | 'cheque' | 'bank_transfer';
  amount: number;
  referenceNumber?: string | null;
  chequeLeafId?: number | null;
  notes?: string | null;
  recordedBy: number;
  /** Explicit tags (e.g. from a service work order or the payment form). Otherwise derived from the PO lines. */
  tags?: EntryTagInput | null;
}) {
  return db.transaction(async (tx) => {
    await assertPeriodOpen(params.paymentDate, 'financial');
    const [supplier] = await tx.select().from(suppliers).where(eq(suppliers.id, params.supplierId)).limit(1);
    if (!supplier || supplier.status !== 'active') {
      throw new Error('Supplier must exist and be active');
    }

    let purchaseOrderCode: string | null = null;
    const taggingPurchaseOrderIds = new Set<number>();
    let contractCode: string | null = null;
    let contractId: number | null = null;
    if (params.purchaseOrderId) {
      const [purchaseOrder] = await tx
        .select({
          id: purchaseOrders.id,
          supplierId: purchaseOrders.supplierId,
          orderCode: purchaseOrders.orderCode,
          contractId: purchaseOrders.contractId,
        })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, params.purchaseOrderId))
        .limit(1);

      if (!purchaseOrder || purchaseOrder.supplierId !== params.supplierId) {
        throw new Error('Purchase order does not belong to the selected supplier');
      }
      purchaseOrderCode = purchaseOrder.orderCode;
      taggingPurchaseOrderIds.add(purchaseOrder.id);
      if (purchaseOrder.contractId) {
        const [contract] = await tx
          .select({ contractCode: supplierContracts.contractCode })
          .from(supplierContracts)
          .where(eq(supplierContracts.id, purchaseOrder.contractId))
          .limit(1);
        contractCode = contract?.contractCode ?? null;
        contractId = purchaseOrder.contractId;
      }
    }

    const invoiceAllocations = params.supplierInvoiceAllocations?.length
      ? params.supplierInvoiceAllocations
      : (params.supplierInvoiceId ? [{ supplierInvoiceId: params.supplierInvoiceId, allocatedAmount: params.amount }] : []);

    if (invoiceAllocations.length > 0) {
      const totalAllocated = invoiceAllocations.reduce((sum, allocation) => sum + allocation.allocatedAmount, 0);
      if (Math.round(totalAllocated * 100) / 100 !== Math.round(params.amount * 100) / 100) {
        throw new Error('Supplier invoice allocations must equal the payment amount');
      }

      for (const allocation of invoiceAllocations) {
        const [invoice] = await tx
          .select({
            id: supplierInvoices.id,
            supplierId: supplierInvoices.supplierId,
            purchaseOrderId: supplierInvoices.purchaseOrderId,
            contractId: supplierInvoices.contractId,
            invoiceCode: supplierInvoices.invoiceCode,
            invoiceReference: supplierInvoices.invoiceReference,
            invoiceAmount: supplierInvoices.invoiceAmount,
            status: supplierInvoices.status,
          })
          .from(supplierInvoices)
          .where(eq(supplierInvoices.id, allocation.supplierInvoiceId))
          .limit(1);

        if (!invoice || invoice.supplierId !== params.supplierId || invoice.status !== 'approved') {
          throw new Error(`Supplier invoice ${allocation.supplierInvoiceId} is invalid for this payment`);
        }

        if (params.purchaseOrderId && invoice.purchaseOrderId && invoice.purchaseOrderId !== params.purchaseOrderId) {
          throw new Error(`Supplier invoice ${allocation.supplierInvoiceId} does not belong to the selected purchase order`);
        }
        if (invoice.purchaseOrderId) {
          taggingPurchaseOrderIds.add(invoice.purchaseOrderId);
        }

        const [paid] = await tx
          .select({
            totalPaid: sql<number>`COALESCE(SUM(${supplierPaymentAllocations.allocatedAmount}::numeric), 0)::float`,
          })
          .from(supplierPaymentAllocations)
          .where(eq(supplierPaymentAllocations.supplierInvoiceId, allocation.supplierInvoiceId));

        const remaining = Math.round((Number(invoice.invoiceAmount) - (paid?.totalPaid ?? 0)) * 100) / 100;
        if (allocation.allocatedAmount > remaining) {
          throw new Error(`Allocated amount exceeds balance due for invoice ${invoice.invoiceReference}`);
        }

        if (!contractCode && invoice.contractId) {
          const [contract] = await tx
            .select({ contractCode: supplierContracts.contractCode })
            .from(supplierContracts)
            .where(eq(supplierContracts.id, invoice.contractId))
            .limit(1);
          contractCode = contract?.contractCode ?? null;
          contractId = invoice.contractId;
        }
      }
    }

    const account = params.paymentMethod === 'cheque'
      ? await ensureChequeEnabledCurrentAccount(params.financeAccountId, tx)
      : await ensureActiveFinanceAccount(params.financeAccountId, tx);
    const chequeLeaf = params.paymentMethod === 'cheque' && params.chequeLeafId
      ? await getIssuableChequeLeaf(params.chequeLeafId, params.financeAccountId, tx)
      : null;

    const paymentCode = await getNextSupplierPaymentCode(params.paymentDate, tx);
    const transaction = await createTreasuryTransactionRecord({
      transactionType: 'supplier_payment',
      transactionDate: params.paymentDate,
      status: params.paymentMethod === 'cheque' ? 'pending' : 'posted',
      referenceNumber: params.referenceNumber ?? paymentCode,
      counterpartyType: 'supplier',
      counterpartyId: supplier.id,
      counterpartyNameSnapshot: supplier.supplierName,
      sourceModule: 'inventory',
      narrative: params.notes?.trim() || `Supplier payment ${paymentCode}`,
      createdBy: params.recordedBy,
      entries: await buildSupplierPaymentEntries({
        financeAccountId: account.id,
        amount: params.amount,
        valueDate: params.paymentDate,
        notes: `Supplier payment to ${supplier.supplierName}`,
        explicitTags: params.tags ?? null,
        purchaseOrderIds: [...taggingPurchaseOrderIds],
        supplierDefaultCategoryId: supplier.defaultCategoryId ?? null,
        executor: tx,
      }),
      executor: tx,
    });

    const [payment] = await tx
      .insert(supplierPayments)
      .values({
        paymentCode,
        supplierId: supplier.id,
        purchaseOrderId: params.purchaseOrderId ?? null,
        paymentDate: params.paymentDate,
        financeAccountId: account.id,
        paymentMethod: params.paymentMethod,
        amount: Number(params.amount).toFixed(2),
        paymentStatus: params.paymentMethod === 'cheque' ? 'pending' : 'completed',
        referenceNumber: params.referenceNumber ?? null,
        chequeLeafId: chequeLeaf?.id ?? null,
        chequeNumber: chequeLeaf?.chequeNumber ?? null,
        chequeDate: params.paymentMethod === 'cheque' ? params.paymentDate : null,
        bankName: account.bankName ?? null,
        treasuryTransactionId: transaction.id,
        notes: params.notes ?? null,
        recordedBy: params.recordedBy,
      })
      .returning();

    if (invoiceAllocations.length > 0) {
      await tx.insert(supplierPaymentAllocations).values(
        invoiceAllocations.map((allocation) => ({
          supplierPaymentId: payment.id,
          supplierInvoiceId: allocation.supplierInvoiceId,
          allocatedAmount: allocation.allocatedAmount.toFixed(2),
        })),
      );
    }

    await tx.insert(treasuryTransactionLinks).values([
      {
        treasuryTransactionId: transaction.id,
        sourceModule: 'inventory',
        sourceEntityType: 'supplier_payment',
        sourceEntityId: payment.id,
        sourceCodeSnapshot: paymentCode,
        allocatedAmount: Number(params.amount).toFixed(2),
      },
      {
        treasuryTransactionId: transaction.id,
        sourceModule: 'inventory',
        sourceEntityType: 'supplier',
        sourceEntityId: supplier.id,
        sourceCodeSnapshot: supplier.supplierName,
        allocatedAmount: Number(params.amount).toFixed(2),
      },
      ...(params.purchaseOrderId ? [{
        treasuryTransactionId: transaction.id,
        sourceModule: 'inventory',
        sourceEntityType: 'purchase_order',
        sourceEntityId: params.purchaseOrderId,
        sourceCodeSnapshot: purchaseOrderCode,
        allocatedAmount: Number(params.amount).toFixed(2),
      }] : []),
      ...invoiceAllocations.map((allocation) => ({
        treasuryTransactionId: transaction.id,
        sourceModule: 'inventory',
        sourceEntityType: 'supplier_invoice',
        sourceEntityId: allocation.supplierInvoiceId,
        sourceCodeSnapshot: null,
        allocatedAmount: Number(allocation.allocatedAmount).toFixed(2),
      })),
      ...(contractCode && contractId ? [{
        treasuryTransactionId: transaction.id,
        sourceModule: 'inventory',
        sourceEntityType: 'supplier_contract',
        sourceEntityId: contractId,
        sourceCodeSnapshot: contractCode,
        allocatedAmount: Number(params.amount).toFixed(2),
      }] : []),
    ]);

    if (chequeLeaf) {
      await tx
        .update(chequeLeaves)
        .set({
          status: 'issued',
          issueDate: params.paymentDate,
          amount: Number(params.amount).toFixed(2),
          payeeName: supplier.supplierName,
          treasuryTransactionId: transaction.id,
          sourceModule: 'inventory',
          sourceEntityType: 'supplier_payment',
          sourceEntityId: payment.id,
          notes: params.notes ?? `Supplier payment ${paymentCode}`,
          updatedAt: new Date(),
        })
        .where(eq(chequeLeaves.id, chequeLeaf.id));
    }

    return payment;
  });
}

async function listBuyerChequeReceiptsByStatus(status: 'pending' | 'bounced') {
  const rows = await db
    .select({
      id: buyerReceiptLines.id,
      receiptId: buyerReceipts.id,
      receiptCode: buyerReceipts.receiptCode,
      buyerId: buyers.id,
      buyerName: buyers.buyerName,
      receiptDate: buyerReceipts.receiptDate,
      paymentAmount: buyerReceiptLines.paymentAmount,
      financeAccountId: buyerReceiptLines.financeAccountId,
      financeAccountName: financeAccounts.accountName,
      chequeNumber: buyerReceiptLines.chequeNumber,
      chequeDate: buyerReceiptLines.chequeDate,
      bankName: buyerReceiptLines.bankName,
      paymentStatus: buyerReceiptLines.paymentStatus,
      treasuryTransactionId: buyerReceiptLines.treasuryTransactionId,
      treasuryReversalTransactionId: buyerReceiptLines.treasuryReversalTransactionId,
    })
    .from(buyerReceiptLines)
    .leftJoin(buyerReceipts, eq(buyerReceiptLines.receiptId, buyerReceipts.id))
    .leftJoin(buyers, eq(buyerReceipts.buyerId, buyers.id))
    .leftJoin(financeAccounts, eq(buyerReceiptLines.financeAccountId, financeAccounts.id))
    .where(and(eq(buyerReceiptLines.paymentMethod, 'cheque'), eq(buyerReceiptLines.paymentStatus, status)))
    .orderBy(desc(buyerReceipts.receiptDate), desc(buyerReceiptLines.id));

  return rows.map((row) => ({
    id: `receipt-line-${row.id}`,
    receiptId: row.receiptId ?? 0,
    receiptCode: row.receiptCode ?? `RCT-${row.id}`,
    buyerId: row.buyerId ?? 0,
    buyerName: row.buyerName ?? 'Unknown buyer',
    receiptDate: row.receiptDate ? toIsoDate(row.receiptDate) : new Date().toISOString().split('T')[0],
    paymentAmount: Number(row.paymentAmount),
    financeAccountId: row.financeAccountId ?? null,
    financeAccountName: row.financeAccountName ?? null,
    chequeNumber: row.chequeNumber ?? null,
    chequeDate: row.chequeDate ? toIsoDate(row.chequeDate) : null,
    bankName: row.bankName ?? null,
    paymentStatus: row.paymentStatus ?? 'pending',
    treasuryTransactionId: row.treasuryTransactionId ?? null,
    treasuryReversalTransactionId: row.treasuryReversalTransactionId ?? null,
  }));
}

export async function listPendingBuyerChequeReceipts() {
  return listBuyerChequeReceiptsByStatus('pending');
}

export async function listBouncedBuyerChequeReceipts() {
  return listBuyerChequeReceiptsByStatus('bounced');
}

export async function createPettyCashAllocation(params: {
  sourceFinanceAccountId: number;
  pettyCashAccountId: number;
  allocatedToUserId: number;
  amount: number;
  allocationDate: string;
  purpose: string;
  createdBy: number;
}) {
  return db.transaction(async (tx) => {
    await assertPeriodOpen(params.allocationDate, 'financial');
    const sourceAccount = await ensureActiveFinanceAccount(params.sourceFinanceAccountId, tx);
    const pettyCashAccount = await ensureActiveFinanceAccount(params.pettyCashAccountId, tx);

    if (sourceAccount.id === pettyCashAccount.id) {
      throw new Error('Source account and petty cash account must be different');
    }
    if (sourceAccount.accountType === 'petty_cash') {
      throw new Error('Source account must be a bank, current, or cash account');
    }
    if (pettyCashAccount.accountType !== 'petty_cash') {
      throw new Error('Selected destination account is not a petty cash account');
    }

    const [manager] = await tx
      .select({
        id: users.id,
        fullName: users.fullName,
        siteId: users.siteId,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, params.allocatedToUserId))
      .limit(1);

    if (!manager || !manager.isActive) {
      throw new Error('Allocated user not found');
    }

    const allocationCode = await getNextPettyCashAllocationCode(params.allocationDate, tx);
    const transaction = await createTreasuryTransactionRecord({
      transactionType: 'petty_cash_allocation',
      transactionDate: params.allocationDate,
      referenceNumber: allocationCode,
      counterpartyType: 'user',
      counterpartyId: manager.id,
      counterpartyNameSnapshot: manager.fullName,
      sourceModule: 'treasury',
      narrative: params.purpose,
      createdBy: params.createdBy,
      entries: [
        {
          financeAccountId: sourceAccount.id,
          entryDirection: 'outflow',
          amount: params.amount,
          valueDate: params.allocationDate,
          notes: `Petty cash allocation to ${manager.fullName}`,
          tags: TRANSFER_TAGS,
        },
        {
          financeAccountId: pettyCashAccount.id,
          entryDirection: 'inflow',
          amount: params.amount,
          valueDate: params.allocationDate,
          notes: `Petty cash funded for ${manager.fullName}`,
          tags: TRANSFER_TAGS,
        },
      ],
      executor: tx,
    });

    const [allocation] = await tx
      .insert(pettyCashAllocations)
      .values({
        allocationCode,
        sourceFinanceAccountId: sourceAccount.id,
        pettyCashAccountId: pettyCashAccount.id,
        allocatedToUserId: manager.id,
        siteId: manager.siteId,
        purpose: params.purpose,
        amount: Number(params.amount).toFixed(2),
        allocationDate: params.allocationDate,
        status: 'allocated',
        treasuryTransactionId: transaction.id,
        createdBy: params.createdBy,
      })
      .returning();

    await tx.insert(treasuryTransactionLinks).values({
      treasuryTransactionId: transaction.id,
      sourceModule: 'treasury',
      sourceEntityType: 'petty_cash_allocation',
      sourceEntityId: allocation.id,
      sourceCodeSnapshot: allocationCode,
      allocatedAmount: Number(params.amount).toFixed(2),
    });

    return allocation;
  });
}

export async function submitPettyCashExpense(params: {
  allocationId: number;
  expenseDate: string;
  categoryId: number;
  costCentreId?: number | null;
  amount: number;
  justification: string;
  createdBy: number;
}) {
  return db.transaction(async (tx) => {
    const [allocation] = await tx
      .select()
      .from(pettyCashAllocations)
      .where(eq(pettyCashAllocations.id, params.allocationId))
      .limit(1);

    if (!allocation) {
      throw new Error('Petty cash allocation not found');
    }

    const [totals] = await tx
      .select({
        approvedAmount: sql<number>`
          COALESCE(
            SUM(
              CASE
                WHEN ${pettyCashExpenses.status} = 'approved' THEN ${pettyCashExpenses.amount}::numeric
                ELSE 0
              END
            ),
            0
          )::float
        `,
        submittedAmount: sql<number>`
          COALESCE(
            SUM(
              CASE
                WHEN ${pettyCashExpenses.status} = 'submitted' THEN ${pettyCashExpenses.amount}::numeric
                ELSE 0
              END
            ),
            0
          )::float
        `,
      })
      .from(pettyCashExpenses)
      .where(eq(pettyCashExpenses.allocationId, params.allocationId));

    const committedAmount = (totals?.approvedAmount ?? 0) + (totals?.submittedAmount ?? 0);
    if (committedAmount + params.amount > Number(allocation.amount)) {
      throw new Error('Expense exceeds remaining petty cash allocation balance');
    }

    const costCentreId = params.costCentreId
      ?? (allocation.siteId ? (await ensureSiteCostCentre(allocation.siteId, tx)).id : (await getCostCentreByCode('ADMIN', tx)).id);
    const tags = await resolveEntryTags({ categoryId: params.categoryId, costCentreId }, tx);
    const category = await assertCategoryFitsDirection(tags.categoryId, 'outflow', tx);

    const [expense] = await tx
      .insert(pettyCashExpenses)
      .values({
        allocationId: allocation.id,
        expenseDate: params.expenseDate,
        expenseCategory: category.name,
        categoryId: tags.categoryId,
        costCentreId: tags.costCentreId,
        amount: Number(params.amount).toFixed(2),
        justification: params.justification,
        status: 'submitted',
        createdBy: params.createdBy,
      })
      .returning();

    await refreshPettyCashAllocationStatus(allocation.id, tx);
    return expense;
  });
}

export async function reviewPettyCashExpense(params: {
  expenseId: number;
  status: 'approved' | 'rejected';
  reviewNotes?: string | null;
  reviewedBy: number;
}) {
  return db.transaction(async (tx) => {
    const [expense] = await tx
      .select({
        id: pettyCashExpenses.id,
        allocationId: pettyCashExpenses.allocationId,
        amount: pettyCashExpenses.amount,
        expenseDate: pettyCashExpenses.expenseDate,
        expenseCategory: pettyCashExpenses.expenseCategory,
        categoryId: pettyCashExpenses.categoryId,
        costCentreId: pettyCashExpenses.costCentreId,
        justification: pettyCashExpenses.justification,
        status: pettyCashExpenses.status,
        treasuryTransactionId: pettyCashExpenses.treasuryTransactionId,
        pettyCashAccountId: pettyCashAllocations.pettyCashAccountId,
        allocationCode: pettyCashAllocations.allocationCode,
      })
      .from(pettyCashExpenses)
      .leftJoin(pettyCashAllocations, eq(pettyCashExpenses.allocationId, pettyCashAllocations.id))
      .where(eq(pettyCashExpenses.id, params.expenseId))
      .limit(1);

    if (!expense || !expense.pettyCashAccountId) {
      throw new Error('Petty cash expense not found');
    }
    if (expense.status !== 'submitted') {
      return { expenseId: expense.id, status: expense.status, treasuryTransactionId: expense.treasuryTransactionId };
    }

    let treasuryTransactionId = expense.treasuryTransactionId;
    if (params.status === 'approved') {
      await assertPeriodOpen(expense.expenseDate, 'financial');
      await ensureActiveFinanceAccount(expense.pettyCashAccountId, tx);
      const transaction = await createTreasuryTransactionRecord({
        transactionType: 'petty_cash_expense',
        transactionDate: expense.expenseDate,
        referenceNumber: expense.allocationCode,
        counterpartyType: 'user',
        sourceModule: 'treasury',
        narrative: `${expense.expenseCategory}: ${expense.justification}`,
        createdBy: params.reviewedBy,
        entries: [
          {
            financeAccountId: expense.pettyCashAccountId,
            entryDirection: 'outflow',
            amount: Number(expense.amount),
            valueDate: expense.expenseDate,
            notes: expense.justification,
            tags: { categoryId: expense.categoryId, costCentreId: expense.costCentreId },
          },
        ],
        executor: tx,
      });

      treasuryTransactionId = transaction.id;
      await tx.insert(treasuryTransactionLinks).values({
        treasuryTransactionId: transaction.id,
        sourceModule: 'treasury',
        sourceEntityType: 'petty_cash_expense',
        sourceEntityId: expense.id,
        sourceCodeSnapshot: expense.allocationCode,
        allocatedAmount: Number(expense.amount).toFixed(2),
      });
    }

    const [updatedExpense] = await tx
      .update(pettyCashExpenses)
      .set({
        status: params.status,
        treasuryTransactionId: treasuryTransactionId ?? null,
        reviewedBy: params.reviewedBy,
        reviewedAt: new Date(),
        reviewNotes: params.reviewNotes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(pettyCashExpenses.id, expense.id))
      .returning();

    await refreshPettyCashAllocationStatus(expense.allocationId, tx);
    return updatedExpense;
  });
}

export async function createOperationalExpense(params: {
  expenseDate: string;
  categoryId: number;
  counterpartyName?: string | null;
  costCentreId?: number | null;
  siteId?: number | null;
  batchId?: number | null;
  amount: number;
  notes?: string | null;
  requestedBy: number;
}) {
  return db.transaction(async (tx) => {
    await assertPeriodOpen(params.expenseDate, 'financial');
    const tags = await resolveEntryTags({
      categoryId: params.categoryId,
      costCentreId: params.costCentreId,
      siteId: params.siteId,
      batchId: params.batchId,
    }, tx);
    const category = await assertCategoryFitsDirection(tags.categoryId, 'outflow', tx);
    const centre = await getCostCentreById(tags.costCentreId!, tx);
    // allocationType drives batch costing: batch = direct, site = split across the site's batches,
    // shared_overhead = split across all farm batches, mill = absorbed into feed cost (Phase 2).
    const allocationType = tags.batchId
      ? 'batch'
      : centre.centreType === 'site' ? 'site' : centre.centreType === 'mill' ? 'mill' : 'shared_overhead';

    const expenseCode = await getNextOperationalExpenseCode(params.expenseDate, tx);
    const [expense] = await tx
      .insert(operationalExpenses)
      .values({
        expenseCode,
        expenseDate: params.expenseDate,
        expenseCategory: category.name,
        categoryId: tags.categoryId,
        costCentreId: tags.costCentreId,
        counterpartyName: params.counterpartyName ?? null,
        allocationType,
        siteId: centre.siteId ?? null,
        batchId: tags.batchId,
        amount: Number(params.amount).toFixed(2),
        status: 'pending_approval',
        requestedBy: params.requestedBy,
        notes: params.notes ?? null,
      })
      .returning();

    return expense;
  });
}

export async function reviewOperationalExpense(params: {
  expenseId: number;
  status: 'approved' | 'rejected';
  approvalNotes?: string | null;
  approvedBy: number;
}) {
  const [expense] = await db
    .select()
    .from(operationalExpenses)
    .where(eq(operationalExpenses.id, params.expenseId))
    .limit(1);

  if (!expense) {
    throw new Error('Operational expense not found');
  }
  if (expense.status !== 'pending_approval') {
    return expense;
  }

  const [updatedExpense] = await db
    .update(operationalExpenses)
    .set({
      status: params.status,
      approvalNotes: params.approvalNotes ?? null,
      approvedBy: params.approvedBy,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(operationalExpenses.id, params.expenseId))
    .returning();

  return updatedExpense;
}

export async function settleOperationalExpense(params: {
  expenseId: number;
  financeAccountId: number;
  paymentMethod: 'cash' | 'cheque' | 'bank_transfer';
  paymentDate?: string;
  referenceNumber?: string | null;
  chequeLeafId?: number | null;
  paidBy: number;
}) {
  return db.transaction(async (tx) => {
    const [expense] = await tx
      .select({
        id: operationalExpenses.id,
        expenseCode: operationalExpenses.expenseCode,
        expenseDate: operationalExpenses.expenseDate,
        expenseCategory: operationalExpenses.expenseCategory,
        categoryId: operationalExpenses.categoryId,
        costCentreId: operationalExpenses.costCentreId,
        batchId: operationalExpenses.batchId,
        counterpartyName: operationalExpenses.counterpartyName,
        amount: operationalExpenses.amount,
        status: operationalExpenses.status,
        notes: operationalExpenses.notes,
      })
      .from(operationalExpenses)
      .where(eq(operationalExpenses.id, params.expenseId))
      .limit(1);

    if (!expense) {
      throw new Error('Operational expense not found');
    }
    if (expense.status !== 'approved') {
      throw new Error('Operational expense must be approved before settlement');
    }

    const paymentDate = params.paymentDate ?? toIsoDate(expense.expenseDate);
    await assertPeriodOpen(paymentDate, 'financial');
    const account = params.paymentMethod === 'cheque'
      ? await ensureChequeEnabledCurrentAccount(params.financeAccountId, tx)
      : await ensureActiveFinanceAccount(params.financeAccountId, tx);
    const chequeLeaf = params.paymentMethod === 'cheque' && params.chequeLeafId
      ? await getIssuableChequeLeaf(params.chequeLeafId, params.financeAccountId, tx)
      : null;

    const transaction = await createTreasuryTransactionRecord({
      transactionType: 'operational_expense',
      transactionDate: paymentDate,
      status: params.paymentMethod === 'cheque' ? 'pending' : 'posted',
      referenceNumber: params.referenceNumber ?? expense.expenseCode,
      counterpartyNameSnapshot: expense.counterpartyName ?? null,
      sourceModule: 'treasury',
      narrative: expense.notes?.trim() || `${expense.expenseCategory} ${expense.expenseCode}`,
      createdBy: params.paidBy,
      entries: [
        {
          financeAccountId: account.id,
          entryDirection: 'outflow',
          amount: Number(expense.amount),
          valueDate: paymentDate,
          notes: expense.notes ?? expense.expenseCategory,
          tags: {
            categoryId: expense.categoryId,
            costCentreId: expense.costCentreId,
            batchId: expense.batchId,
          },
        },
      ],
      executor: tx,
    });

    await tx.insert(treasuryTransactionLinks).values({
      treasuryTransactionId: transaction.id,
      sourceModule: 'treasury',
      sourceEntityType: 'operational_expense',
      sourceEntityId: expense.id,
      sourceCodeSnapshot: expense.expenseCode,
      allocatedAmount: Number(expense.amount).toFixed(2),
    });

    const [updatedExpense] = await tx
      .update(operationalExpenses)
      .set({
        status: 'paid',
        financeAccountId: account.id,
        paymentMethod: params.paymentMethod,
        referenceNumber: params.referenceNumber ?? null,
        chequeLeafId: chequeLeaf?.id ?? null,
        chequeNumber: chequeLeaf?.chequeNumber ?? null,
        chequeDate: params.paymentMethod === 'cheque' ? paymentDate : null,
        bankName: account.bankName ?? null,
        treasuryTransactionId: transaction.id,
        updatedAt: new Date(),
      })
      .where(eq(operationalExpenses.id, expense.id))
      .returning();

    if (chequeLeaf) {
      await tx
        .update(chequeLeaves)
        .set({
          status: 'issued',
          issueDate: paymentDate,
          amount: Number(expense.amount).toFixed(2),
          payeeName: expense.counterpartyName ?? expense.expenseCategory,
          treasuryTransactionId: transaction.id,
          sourceModule: 'treasury',
          sourceEntityType: 'operational_expense',
          sourceEntityId: expense.id,
          notes: expense.notes ?? expense.expenseCategory,
          updatedAt: new Date(),
        })
        .where(eq(chequeLeaves.id, chequeLeaf.id));
    }

    return updatedExpense;
  });
}

export async function createFinanceReconciliation(params: {
  financeAccountId: number;
  periodStart: string;
  periodEnd: string;
  statementDate: string;
  statementBalance: number;
  clearedEntryIds: number[];
  notes?: string | null;
  createdBy: number;
}) {
  return db.transaction(async (tx) => {
    await assertPeriodOpen(params.periodEnd, 'financial');
    await ensureActiveFinanceAccount(params.financeAccountId, tx);

    if (params.clearedEntryIds.length > 0) {
      const entries = await tx
        .select({
          id: treasuryTransactionEntries.id,
          financeAccountId: treasuryTransactionEntries.financeAccountId,
          clearedAt: treasuryTransactionEntries.clearedAt,
        })
        .from(treasuryTransactionEntries)
        .where(inArray(treasuryTransactionEntries.id, params.clearedEntryIds));

      if (entries.length !== params.clearedEntryIds.length) {
        throw new Error('One or more treasury entries were not found');
      }
      if (entries.some((entry) => entry.financeAccountId !== params.financeAccountId)) {
        throw new Error('All selected entries must belong to the same finance account');
      }
      if (entries.some((entry) => entry.clearedAt)) {
        throw new Error('One or more selected entries are already reconciled');
      }
    }

    const bookBalance = await getFinanceAccountBalanceAsOf(params.financeAccountId, params.periodEnd);

    const [selectedBalanceResult] = await tx
      .select({
        selectedMovement: sql<number>`
          COALESCE(SUM(
            CASE
              WHEN ${treasuryTransactionEntries.entryDirection} = 'inflow' THEN ${treasuryTransactionEntries.amount}::numeric
              WHEN ${treasuryTransactionEntries.entryDirection} = 'outflow' THEN -${treasuryTransactionEntries.amount}::numeric
              ELSE 0
            END
          ), 0)::float
        `,
      })
      .from(treasuryTransactionEntries)
      .where(
        params.clearedEntryIds.length > 0
          ? inArray(treasuryTransactionEntries.id, params.clearedEntryIds)
          : sql`false`,
      );

    const previouslyClearedBalance = await getFinanceAccountClearedBalance(
      params.financeAccountId,
      params.statementDate,
    );
    const clearedBalance = Number(
      (previouslyClearedBalance + (selectedBalanceResult?.selectedMovement ?? 0)).toFixed(2),
    );
    const varianceAmount = Number((params.statementBalance - clearedBalance).toFixed(2));

    const [reconciliation] = await tx
      .insert(financeReconciliations)
      .values({
        financeAccountId: params.financeAccountId,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        statementDate: params.statementDate,
        bookBalance: bookBalance.toFixed(2),
        clearedBalance: clearedBalance.toFixed(2),
        statementBalance: params.statementBalance.toFixed(2),
        varianceAmount: varianceAmount.toFixed(2),
        status: 'closed',
        notes: params.notes ?? null,
        createdBy: params.createdBy,
        closedBy: params.createdBy,
        closedAt: new Date(),
      })
      .returning();

    if (params.clearedEntryIds.length > 0) {
      await tx
        .update(treasuryTransactionEntries)
        .set({
          clearedAt: params.statementDate,
          reconciliationId: reconciliation.id,
        })
        .where(inArray(treasuryTransactionEntries.id, params.clearedEntryIds));
    }

    return reconciliation;
  });
}
