import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  buyerReceiptAllocations,
  buyerReceiptLines,
  buyerReceipts,
  financeAccounts,
  saleLorries,
  sales,
} from '../db/schema';
import { assertPeriodOpen } from './period-locks';
import { postBuyerReceiptLineWithin } from './treasury';

export interface SaleLorryInput {
  lorryNumber: string;
  birdsCount: number;
  previousWeight: number;
  loadedWeight: number;
  notes?: string | null;
}

export interface ReceiptLineInput {
  paymentAmount: number;
  paymentMethod: string;
  financeAccountId?: number | null;
  referenceNumber?: string | null;
  chequeNumber?: string | null;
  chequeDate?: string | null;
  bankName?: string | null;
  notes?: string | null;
}

export interface PaymentRow {
  id: string;
  source: 'legacy' | 'receipt_line';
  saleId: number;
  receiptId?: number | null;
  receiptCode?: string | null;
  paymentAmount: string;
  paymentDate: string;
  paymentMethod: string;
  financeAccountId?: number | null;
  financeAccountName?: string | null;
  treasuryTransactionId?: number | null;
  treasuryReversalTransactionId?: number | null;
  referenceNumber?: string | null;
  chequeNumber?: string | null;
  chequeDate?: string | null;
  bankName?: string | null;
  paymentStatus: string;
  notes?: string | null;
  recordedBy?: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface BuyerBalanceSummary {
  totalSales: number;
  totalReceiptsCompleted: number;
  totalAppliedToSales: number;
  outstandingBalance: number;
  advanceCredit: number;
  netBalance: number;
}

export interface BuyerLedgerEntry {
  id: string;
  entryType: 'sale' | 'receipt';
  entryDate: string;
  referenceCode: string;
  description: string;
  amount: number;
  debit: number;
  credit: number;
  runningBalance: number;
  status: string;
  paymentMethod?: string | null;
}

export interface ReceiptSummaryRow {
  id: number;
  receiptCode: string;
  receiptDate: string;
  totalAmount: number;
  completedAmount: number;
  pendingChequeAmount: number;
  unappliedAmount: number;
  lineCount: number;
  status: 'cleared' | 'pending_cheque' | 'partially_cleared';
}

export interface BuyerReceiptLineRow {
  id: string;
  receiptId: number;
  receiptCode: string;
  receiptDate: string;
  paymentAmount: number;
  paymentMethod: string;
  financeAccountId?: number | null;
  financeAccountName?: string | null;
  treasuryTransactionId?: number | null;
  treasuryReversalTransactionId?: number | null;
  referenceNumber?: string | null;
  chequeNumber?: string | null;
  chequeDate?: string | null;
  bankName?: string | null;
  paymentStatus: string;
  notes?: string | null;
  appliedAmount: number;
  unappliedAmount: number;
}

function toDateString(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  return value;
}

function normalizeSaleWorkflowStatus(status: string | null | undefined): string {
  return status === 'pending' ? 'reviewed' : (status ?? 'draft');
}

export function parsePaymentIdentifier(paymentId: string): { source: 'legacy' | 'receipt_line'; id: number } {
  if (paymentId.startsWith('receipt-line-')) {
    return { source: 'receipt_line', id: Number(paymentId.replace('receipt-line-', '')) };
  }
  if (paymentId.startsWith('legacy-')) {
    return { source: 'legacy', id: Number(paymentId.replace('legacy-', '')) };
  }
  return { source: 'legacy', id: Number(paymentId) };
}

export function getSettlementStatus(totalAmount: number, totalPaid: number): string {
  if (totalPaid <= 0.009) {
    return 'unpaid';
  }
  if (totalPaid >= totalAmount - 0.01) {
    return 'paid';
  }
  return 'partially_paid';
}

export function normalizeSaleLorries(lorries: SaleLorryInput[]) {
  if (!lorries.length) {
    throw new Error('At least one lorry line is required');
  }

  const normalized = lorries.map((lorry, index) => {
    const netWeight = Number((lorry.loadedWeight - lorry.previousWeight).toFixed(2));
    if (netWeight <= 0) {
      throw new Error(`Lorry line ${index + 1} must have a positive net weight`);
    }
    return {
      lineSequence: index + 1,
      lorryNumber: lorry.lorryNumber.trim(),
      birdsCount: lorry.birdsCount,
      previousWeight: Number(lorry.previousWeight.toFixed(2)),
      loadedWeight: Number(lorry.loadedWeight.toFixed(2)),
      netWeight,
      notes: lorry.notes?.trim() || null,
    };
  });

  return {
    lines: normalized,
    totalBirds: normalized.reduce((sum, line) => sum + line.birdsCount, 0),
    totalWeight: Number(normalized.reduce((sum, line) => sum + line.netWeight, 0).toFixed(2)),
  };
}

export async function listSaleLorries(saleId: number) {
  return db
    .select()
    .from(saleLorries)
    .where(eq(saleLorries.saleId, saleId))
    .orderBy(asc(saleLorries.lineSequence));
}

export async function getNewSalePayments(saleId: number, executor: typeof db | any = db): Promise<PaymentRow[]> {
  // Typed view of the executor (db or a transaction) so row types are inferred
  const runner: typeof db = executor;
  const rows = await runner
    .select({
      lineId: buyerReceiptLines.id,
      receiptId: buyerReceipts.id,
      receiptCode: buyerReceipts.receiptCode,
      paymentAmount: buyerReceiptAllocations.allocatedAmount,
      paymentDate: buyerReceipts.receiptDate,
      paymentMethod: buyerReceiptLines.paymentMethod,
      financeAccountId: buyerReceiptLines.financeAccountId,
      financeAccountName: financeAccounts.accountName,
      treasuryTransactionId: buyerReceiptLines.treasuryTransactionId,
      treasuryReversalTransactionId: buyerReceiptLines.treasuryReversalTransactionId,
      referenceNumber: buyerReceiptLines.referenceNumber,
      chequeNumber: buyerReceiptLines.chequeNumber,
      chequeDate: buyerReceiptLines.chequeDate,
      bankName: buyerReceiptLines.bankName,
      paymentStatus: buyerReceiptLines.paymentStatus,
      notes: buyerReceiptLines.notes,
      recordedBy: buyerReceipts.recordedBy,
      createdAt: buyerReceiptLines.createdAt,
      updatedAt: buyerReceiptLines.updatedAt,
    })
    .from(buyerReceiptAllocations)
    .leftJoin(buyerReceiptLines, eq(buyerReceiptAllocations.receiptLineId, buyerReceiptLines.id))
    .leftJoin(buyerReceipts, eq(buyerReceiptLines.receiptId, buyerReceipts.id))
    .leftJoin(financeAccounts, eq(buyerReceiptLines.financeAccountId, financeAccounts.id))
    .where(eq(buyerReceiptAllocations.saleId, saleId))
    .orderBy(desc(buyerReceipts.receiptDate), desc(buyerReceiptLines.id));

  return rows.map((row) => ({
    id: `receipt-line-${row.lineId}`,
    source: 'receipt_line',
    saleId,
    receiptId: row.receiptId,
    receiptCode: row.receiptCode,
    paymentAmount: String(row.paymentAmount),
    paymentDate: toDateString(row.paymentDate ?? row.createdAt ?? new Date()),
    paymentMethod: row.paymentMethod ?? 'cash',
    financeAccountId: row.financeAccountId ?? null,
    financeAccountName: row.financeAccountName ?? null,
    treasuryTransactionId: row.treasuryTransactionId ?? null,
    treasuryReversalTransactionId: row.treasuryReversalTransactionId ?? null,
    referenceNumber: row.referenceNumber,
    chequeNumber: row.chequeNumber,
    chequeDate: row.chequeDate ? toDateString(row.chequeDate) : null,
    bankName: row.bankName,
    paymentStatus: row.paymentStatus ?? 'pending',
    notes: row.notes,
    recordedBy: row.recordedBy ?? null,
    createdAt: row.createdAt ?? new Date(),
    updatedAt: row.updatedAt ?? new Date(),
  }));
}

export async function getSalePaymentRows(saleId: number, executor: typeof db | any = db): Promise<PaymentRow[]> {
  // Old-style `payments` rows were converted to receipts in migration 0007; receipts are the only source now.
  const rows = await getNewSalePayments(saleId, executor);

  return rows.sort((a, b) => {
    const dateDiff = new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime();
    if (dateDiff !== 0) {
      return dateDiff;
    }
    return String(b.id).localeCompare(String(a.id));
  });
}

export async function getSaleFinancialSummary(saleId: number, totalAmount: number, executor: typeof db | any = db) {
  const paymentRows = await getSalePaymentRows(saleId, executor);
  const totalPaid = paymentRows
    .filter((row) => row.paymentStatus === 'completed')
    .reduce((sum, row) => sum + Number(row.paymentAmount), 0);
  const outstandingBalance = Number((totalAmount - totalPaid).toFixed(2));

  return {
    payments: paymentRows,
    totalPaid,
    outstandingBalance,
    settlementStatus: getSettlementStatus(totalAmount, totalPaid),
  };
}

export async function syncSaleStatusFromPayments(saleId: number, executor: typeof db | any = db) {
  const [sale] = await executor.select().from(sales).where(eq(sales.id, saleId)).limit(1);
  if (!sale || sale.status === 'cancelled' || sale.status === 'draft') {
    return;
  }

  const financial = await getSaleFinancialSummary(saleId, Number(sale.totalAmount), executor);
  const nextStatus = financial.totalPaid >= Number(sale.totalAmount) - 0.01 ? 'completed' : 'reviewed';

  if (sale.status !== nextStatus) {
    await executor.update(sales).set({ status: nextStatus, updatedAt: new Date() }).where(eq(sales.id, saleId));
  }
}

async function getNextReceiptCode(receiptDate: string, executor: typeof db | any = db) {
  const dateStr = receiptDate.replace(/-/g, '');
  const [countResult] = await executor
    .select({ count: sql<number>`count(*)::int` })
    .from(buyerReceipts)
    .where(sql`${buyerReceipts.receiptCode} LIKE ${'RCT-' + dateStr + '-%'}`);
  const seq = String((countResult?.count ?? 0) + 1).padStart(3, '0');
  return `RCT-${dateStr}-${seq}`;
}

export async function getReceiptLineAllocatedTotal(receiptLineId: number) {
  const [result] = await db
    .select({ total: sql<number>`COALESCE(sum(${buyerReceiptAllocations.allocatedAmount}::numeric), 0)::float` })
    .from(buyerReceiptAllocations)
    .where(eq(buyerReceiptAllocations.receiptLineId, receiptLineId));

  return result?.total ?? 0;
}

export async function autoApplyBuyerCreditToSale(buyerId: number, saleId: number, saleTotalAmount: number) {
  const lines = await db
    .select({
      id: buyerReceiptLines.id,
      paymentAmount: buyerReceiptLines.paymentAmount,
    })
    .from(buyerReceiptLines)
    .leftJoin(buyerReceipts, eq(buyerReceiptLines.receiptId, buyerReceipts.id))
    .where(
      and(
        eq(buyerReceipts.buyerId, buyerId),
        eq(buyerReceiptLines.paymentStatus, 'completed'),
      ),
    )
    .orderBy(asc(buyerReceipts.receiptDate), asc(buyerReceiptLines.id));

  let remaining = saleTotalAmount;
  for (const line of lines) {
    if (remaining <= 0.009) {
      break;
    }

    const allocated = await getReceiptLineAllocatedTotal(line.id);
    const available = Number(line.paymentAmount) - allocated;
    if (available <= 0.009) {
      continue;
    }

    const allocationAmount = Number(Math.min(available, remaining).toFixed(2));
    await db.insert(buyerReceiptAllocations).values({
      receiptLineId: line.id,
      saleId,
      allocatedAmount: allocationAmount.toFixed(2),
    });
    remaining = Number((remaining - allocationAmount).toFixed(2));
  }

  await syncSaleStatusFromPayments(saleId);
}

export async function createBuyerReceiptForSale(params: {
  buyerId: number;
  saleId?: number;
  receiptDate: string;
  notes?: string | null;
  lines: ReceiptLineInput[];
  recordedBy: number;
}, executor: typeof db | any = db) {
  await assertPeriodOpen(params.receiptDate, 'financial');
  const receiptCode = await getNextReceiptCode(params.receiptDate, executor);
  const [receipt] = await executor
    .insert(buyerReceipts)
    .values({
      receiptCode,
      buyerId: params.buyerId,
      receiptDate: params.receiptDate,
      notes: params.notes || null,
      recordedBy: params.recordedBy,
    })
    .returning();

  const createdLines = [];
  let remainingForSale = 0;

  if (params.saleId) {
    const [sale] = await executor.select().from(sales).where(eq(sales.id, params.saleId)).limit(1);
    if (sale) {
      const financial = await getSaleFinancialSummary(sale.id, Number(sale.totalAmount), executor);
      remainingForSale = Math.max(financial.outstandingBalance, 0);
    }
  }

  for (let index = 0; index < params.lines.length; index += 1) {
    const line = params.lines[index];
    const paymentStatus = line.paymentMethod === 'cheque' ? 'pending' : 'completed';
    const [createdLine] = await executor
      .insert(buyerReceiptLines)
      .values({
        receiptId: receipt.id,
        lineSequence: index + 1,
        paymentAmount: line.paymentAmount.toFixed(2),
        paymentMethod: line.paymentMethod,
        financeAccountId: line.financeAccountId ?? null,
        referenceNumber: line.referenceNumber || null,
        chequeNumber: line.chequeNumber || null,
        chequeDate: line.chequeDate || null,
        bankName: line.bankName || null,
        paymentStatus,
        notes: line.notes || null,
      })
      .returning();

    createdLines.push(createdLine);

    if (params.saleId && remainingForSale > 0.009) {
      const allocatedAmount = Number(Math.min(line.paymentAmount, remainingForSale).toFixed(2));
      if (allocatedAmount > 0) {
        await executor.insert(buyerReceiptAllocations).values({
          receiptLineId: createdLine.id,
          saleId: params.saleId,
          allocatedAmount: allocatedAmount.toFixed(2),
        });
        remainingForSale = Number((remainingForSale - allocatedAmount).toFixed(2));
      }
    }
  }

  if (params.saleId) {
    await syncSaleStatusFromPayments(params.saleId, executor);
  }

  return { receipt, lines: createdLines };
}

export async function getBuyerBalanceSummary(buyerId: number): Promise<BuyerBalanceSummary> {
  const [salesResult] = await db
    .select({ total: sql<number>`COALESCE(sum(${sales.totalAmount}::numeric), 0)::float` })
    .from(sales)
    .where(and(eq(sales.buyerId, buyerId), sql`${sales.status} <> 'cancelled'`));

  const [newReceiptResult] = await db
    .select({ total: sql<number>`COALESCE(sum(${buyerReceiptLines.paymentAmount}::numeric), 0)::float` })
    .from(buyerReceiptLines)
    .leftJoin(buyerReceipts, eq(buyerReceiptLines.receiptId, buyerReceipts.id))
    .where(and(eq(buyerReceipts.buyerId, buyerId), eq(buyerReceiptLines.paymentStatus, 'completed')));

  const [allocationResult] = await db
    .select({ total: sql<number>`COALESCE(sum(${buyerReceiptAllocations.allocatedAmount}::numeric), 0)::float` })
    .from(buyerReceiptAllocations)
    .leftJoin(buyerReceiptLines, eq(buyerReceiptAllocations.receiptLineId, buyerReceiptLines.id))
    .leftJoin(buyerReceipts, eq(buyerReceiptLines.receiptId, buyerReceipts.id))
    .where(and(eq(buyerReceipts.buyerId, buyerId), eq(buyerReceiptLines.paymentStatus, 'completed')));

  const totalSales = salesResult?.total ?? 0;
  const totalNewReceipts = newReceiptResult?.total ?? 0;
  const totalReceiptsCompleted = Number(totalNewReceipts.toFixed(2));
  const totalAppliedToSales = Number((allocationResult?.total ?? 0).toFixed(2));
  const outstandingBalance = Math.max(Number((totalSales - totalReceiptsCompleted).toFixed(2)), 0);
  const advanceCredit = Math.max(Number((totalNewReceipts - (allocationResult?.total ?? 0)).toFixed(2)), 0);
  const netBalance = Number((totalSales - totalReceiptsCompleted).toFixed(2));

  return {
    totalSales: Number(totalSales.toFixed(2)),
    totalReceiptsCompleted,
    totalAppliedToSales,
    outstandingBalance,
    advanceCredit,
    netBalance,
  };
}

export async function listBuyerReceipts(buyerId: number): Promise<ReceiptSummaryRow[]> {
  const receipts = await db
    .select()
    .from(buyerReceipts)
    .where(eq(buyerReceipts.buyerId, buyerId))
    .orderBy(desc(buyerReceipts.receiptDate), desc(buyerReceipts.id));

  const result: ReceiptSummaryRow[] = [];
  for (const receipt of receipts) {
    const lines = await db
      .select()
      .from(buyerReceiptLines)
      .where(eq(buyerReceiptLines.receiptId, receipt.id))
      .orderBy(asc(buyerReceiptLines.lineSequence));

    let completedAmount = 0;
    let pendingChequeAmount = 0;
    let unappliedAmount = 0;
    for (const line of lines) {
      const amount = Number(line.paymentAmount);
      const allocated = await getReceiptLineAllocatedTotal(line.id);
      if (line.paymentStatus === 'completed') {
        completedAmount += amount;
        unappliedAmount += Math.max(amount - allocated, 0);
      } else if (line.paymentMethod === 'cheque' && line.paymentStatus === 'pending') {
        pendingChequeAmount += amount;
      }
    }

    const status =
      pendingChequeAmount > 0 && completedAmount > 0
        ? 'partially_cleared'
        : pendingChequeAmount > 0
          ? 'pending_cheque'
          : 'cleared';

    result.push({
      id: receipt.id,
      receiptCode: receipt.receiptCode,
      receiptDate: toDateString(receipt.receiptDate),
      totalAmount: Number(lines.reduce((sum, line) => sum + Number(line.paymentAmount), 0).toFixed(2)),
      completedAmount: Number(completedAmount.toFixed(2)),
      pendingChequeAmount: Number(pendingChequeAmount.toFixed(2)),
      unappliedAmount: Number(unappliedAmount.toFixed(2)),
      lineCount: lines.length,
      status,
    });
  }

  return result;
}

export async function listBuyerReceiptLines(buyerId: number): Promise<BuyerReceiptLineRow[]> {
  const lines = await db
    .select({
      id: buyerReceiptLines.id,
      receiptId: buyerReceipts.id,
      receiptCode: buyerReceipts.receiptCode,
      receiptDate: buyerReceipts.receiptDate,
      paymentAmount: buyerReceiptLines.paymentAmount,
      paymentMethod: buyerReceiptLines.paymentMethod,
      financeAccountId: buyerReceiptLines.financeAccountId,
      financeAccountName: financeAccounts.accountName,
      treasuryTransactionId: buyerReceiptLines.treasuryTransactionId,
      treasuryReversalTransactionId: buyerReceiptLines.treasuryReversalTransactionId,
      referenceNumber: buyerReceiptLines.referenceNumber,
      chequeNumber: buyerReceiptLines.chequeNumber,
      chequeDate: buyerReceiptLines.chequeDate,
      bankName: buyerReceiptLines.bankName,
      paymentStatus: buyerReceiptLines.paymentStatus,
      notes: buyerReceiptLines.notes,
    })
    .from(buyerReceiptLines)
    .leftJoin(buyerReceipts, eq(buyerReceiptLines.receiptId, buyerReceipts.id))
    .leftJoin(financeAccounts, eq(buyerReceiptLines.financeAccountId, financeAccounts.id))
    .where(eq(buyerReceipts.buyerId, buyerId))
    .orderBy(desc(buyerReceipts.receiptDate), desc(buyerReceiptLines.id));

  const result: BuyerReceiptLineRow[] = [];
  for (const line of lines) {
    const appliedAmount = Number((await getReceiptLineAllocatedTotal(line.id)).toFixed(2));
    const paymentAmount = Number(line.paymentAmount);
    result.push({
      id: `receipt-line-${line.id}`,
      receiptId: line.receiptId ?? 0,
      receiptCode: line.receiptCode ?? `RCT-${line.id}`,
      receiptDate: toDateString(line.receiptDate ?? new Date()),
      paymentAmount,
      paymentMethod: line.paymentMethod ?? 'cash',
      financeAccountId: line.financeAccountId ?? null,
      financeAccountName: line.financeAccountName ?? null,
      treasuryTransactionId: line.treasuryTransactionId ?? null,
      treasuryReversalTransactionId: line.treasuryReversalTransactionId ?? null,
      referenceNumber: line.referenceNumber,
      chequeNumber: line.chequeNumber,
      chequeDate: line.chequeDate ? toDateString(line.chequeDate) : null,
      bankName: line.bankName,
      paymentStatus: line.paymentStatus ?? 'pending',
      notes: line.notes,
      appliedAmount,
      unappliedAmount: Number(Math.max(paymentAmount - appliedAmount, 0).toFixed(2)),
    });
  }

  return result;
}

export async function buildBuyerLedger(buyerId: number): Promise<BuyerLedgerEntry[]> {
  const [buyerSales, newReceipts] = await Promise.all([
    db
      .select({
        id: sales.id,
        saleCode: sales.saleCode,
        saleDate: sales.saleDate,
        totalAmount: sales.totalAmount,
        status: sales.status,
        saleType: sales.saleType,
        itemDescription: sales.itemDescription,
      })
      .from(sales)
      .where(and(eq(sales.buyerId, buyerId), sql`${sales.status} <> 'cancelled'`))
      .orderBy(asc(sales.saleDate), asc(sales.id)),
    db
      .select({
        id: buyerReceiptLines.id,
        receiptCode: buyerReceipts.receiptCode,
        receiptDate: buyerReceipts.receiptDate,
        paymentAmount: buyerReceiptLines.paymentAmount,
        paymentMethod: buyerReceiptLines.paymentMethod,
        paymentStatus: buyerReceiptLines.paymentStatus,
      })
      .from(buyerReceiptLines)
      .leftJoin(buyerReceipts, eq(buyerReceiptLines.receiptId, buyerReceipts.id))
      .where(eq(buyerReceipts.buyerId, buyerId))
      .orderBy(asc(buyerReceipts.receiptDate), asc(buyerReceiptLines.id)),
  ]);

  const entries = [
    ...buyerSales.map((sale) => ({
      id: `sale-${sale.id}`,
      entryType: 'sale' as const,
      entryDate: toDateString(sale.saleDate),
      referenceCode: sale.saleCode ?? `SALE-${sale.id}`,
      description: sale.saleType === 'other_income' ? (sale.itemDescription || 'Other income') : 'Live bird sale',
      amount: Number(sale.totalAmount),
      debit: Number(sale.totalAmount),
      credit: 0,
      status: normalizeSaleWorkflowStatus(sale.status),
      paymentMethod: null,
      sortGroup: 0,
    })),
    ...newReceipts.map((receiptLine) => ({
      id: `receipt-line-${receiptLine.id}`,
      entryType: 'receipt' as const,
      entryDate: toDateString(receiptLine.receiptDate ?? new Date()),
      referenceCode: receiptLine.receiptCode ?? `RCT-LINE-${receiptLine.id}`,
      description: 'Buyer receipt',
      amount: Number(receiptLine.paymentAmount),
      debit: 0,
      credit: receiptLine.paymentStatus === 'completed' ? Number(receiptLine.paymentAmount) : 0,
      status: receiptLine.paymentStatus ?? 'pending',
      paymentMethod: receiptLine.paymentMethod ?? 'cash',
      sortGroup: 1,
    })),
  ].sort((a, b) => {
    const dateDiff = new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime();
    if (dateDiff !== 0) {
      return dateDiff;
    }
    if (a.sortGroup !== b.sortGroup) {
      return a.sortGroup - b.sortGroup;
    }
    return a.id.localeCompare(b.id);
  });

  let runningBalance = 0;
  return entries.map((entry) => {
    runningBalance = Number((runningBalance + entry.debit - entry.credit).toFixed(2));
    return {
      id: entry.id,
      entryType: entry.entryType,
      entryDate: entry.entryDate,
      referenceCode: entry.referenceCode,
      description: entry.description,
      amount: entry.amount,
      debit: entry.debit,
      credit: entry.credit,
      runningBalance,
      status: entry.status,
      paymentMethod: entry.paymentMethod,
    };
  });
}

/**
 * Records a buyer receipt and posts every completed line into the money ledger in ONE transaction.
 * If posting fails (closed account, period lock, missing category…) nothing is saved, so a receipt
 * can never exist without its money line.
 */
export async function recordBuyerReceipt(params: Parameters<typeof createBuyerReceiptForSale>[0]) {
  return db.transaction(async (tx) => {
    const result = await createBuyerReceiptForSale(params, tx);
    for (const line of result.lines) {
      if (line.paymentStatus !== 'completed') continue;
      if (!line.financeAccountId) {
        throw new ReceiptPostingError('Choose the account the money was paid into');
      }
      await postBuyerReceiptLineWithin(tx, { receiptLineId: line.id, financeAccountId: line.financeAccountId, postedBy: params.recordedBy });
    }
    return result;
  });
}

export class ReceiptPostingError extends Error {}

/** Business-rule failures from posting that the person can fix (not server faults). */
export function isPostingRuleError(error: unknown) {
  return error instanceof Error && /closed period|finance account not found|finance account is required/i.test(error.message);
}
