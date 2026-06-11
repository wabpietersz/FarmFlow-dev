import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from './index';
import {
  buyerReceiptLines,
  financeAccounts,
  payroll,
  pettyCashAllocations,
  sales,
  treasuryTransactions,
} from './schema';
import {
  createManualTreasuryTransaction,
  createPettyCashAllocation,
  postBuyerReceiptLineToTreasury,
  postPayrollToTreasury,
  reviewPettyCashExpense,
  submitPettyCashExpense,
} from '../lib/treasury';
import { createBuyerReceiptForSale } from '../lib/sales-ledger';

const ADMIN_USER_ID = 1;
const today = new Date().toISOString().split('T')[0] as string;

async function ensureFinanceAccount(input: {
  accountCode: string;
  accountName: string;
  accountType: 'bank' | 'current' | 'cash' | 'petty_cash';
  bankName?: string | null;
  branchName?: string | null;
  accountNumberMasked?: string | null;
  allowsCheque?: boolean;
  openingBalance: number;
}) {
  const [existing] = await db
    .select()
    .from(financeAccounts)
    .where(eq(financeAccounts.accountCode, input.accountCode))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(financeAccounts)
    .values({
      accountCode: input.accountCode,
      accountName: input.accountName,
      accountType: input.accountType,
      bankName: input.bankName ?? null,
      branchName: input.branchName ?? null,
      accountNumberMasked: input.accountNumberMasked ?? null,
      currencyCode: 'LKR',
      allowsCheque: input.allowsCheque ?? false,
      openingBalance: input.openingBalance.toFixed(2),
      openingBalanceDate: today,
      status: 'active',
      createdBy: ADMIN_USER_ID,
    })
    .returning();

  console.log(`Created account ${created.accountCode}`);
  return created;
}

async function ensureManualTransfer(currentAccountId: number, cashAccountId: number) {
  const [existing] = await db
    .select({ id: treasuryTransactions.id })
    .from(treasuryTransactions)
    .where(eq(treasuryTransactions.referenceNumber, 'SEED-TREASURY-XFER-001'))
    .limit(1);

  if (existing) {
    return existing.id;
  }

  const transaction = await createManualTreasuryTransaction({
    transactionDate: today,
    transactionType: 'internal_transfer',
    sourceFinanceAccountId: currentAccountId,
    destinationFinanceAccountId: cashAccountId,
    amount: 50000,
    referenceNumber: 'SEED-TREASURY-XFER-001',
    counterpartyName: 'Treasury seed setup',
    narrative: 'Seed transfer from current account to cash safe',
    postedBy: ADMIN_USER_ID,
  });

  console.log(`Created manual transfer ${transaction.transactionCode}`);
  return transaction.id;
}

async function ensureSeedReceipt(financeAccountId: number) {
  const [existing] = await db
    .select({
      id: buyerReceiptLines.id,
      treasuryTransactionId: buyerReceiptLines.treasuryTransactionId,
    })
    .from(buyerReceiptLines)
    .where(eq(buyerReceiptLines.referenceNumber, 'SEED-SALES-RCT-001'))
    .limit(1);

  if (existing) {
    if (!existing.treasuryTransactionId) {
      await postBuyerReceiptLineToTreasury({
        receiptLineId: existing.id,
        financeAccountId,
        postedBy: ADMIN_USER_ID,
      });
    }
    return existing.id;
  }

  const [sale] = await db
    .select({
      id: sales.id,
      buyerId: sales.buyerId,
      totalAmount: sales.totalAmount,
    })
    .from(sales)
    .where(eq(sales.status, 'reviewed'))
    .orderBy(desc(sales.id))
    .limit(1);

  if (!sale) {
    console.log('Skipped customer receipt seed: no reviewed sale found');
    return null;
  }

  const paymentAmount = Math.min(Number(sale.totalAmount), 250000);
  const receipt = await createBuyerReceiptForSale({
    buyerId: sale.buyerId,
    saleId: sale.id,
    receiptDate: today,
    notes: 'Seed buyer receipt for treasury testing',
    lines: [
      {
        paymentAmount,
        paymentMethod: 'bank_transfer',
        financeAccountId,
        referenceNumber: 'SEED-SALES-RCT-001',
        notes: 'Seed customer receipt',
      },
    ],
    recordedBy: ADMIN_USER_ID,
  });

  await postBuyerReceiptLineToTreasury({
    receiptLineId: receipt.lines[0].id,
    financeAccountId,
    postedBy: ADMIN_USER_ID,
  });

  console.log(`Created buyer receipt ${receipt.receipt.receiptCode}`);
  return receipt.lines[0].id;
}

async function ensureSeedPayroll(financeAccountId: number) {
  const [existingPosted] = await db
    .select({ id: payroll.id })
    .from(payroll)
    .where(and(eq(payroll.status, 'paid'), eq(payroll.financeAccountId, financeAccountId)))
    .orderBy(desc(payroll.id))
    .limit(1);

  if (existingPosted) {
    return existingPosted.id;
  }

  const [approvedPayroll] = await db
    .select({
      id: payroll.id,
    })
    .from(payroll)
    .where(and(eq(payroll.status, 'approved'), isNull(payroll.treasuryTransactionId)))
    .orderBy(desc(payroll.id))
    .limit(1);

  if (!approvedPayroll) {
    console.log('Skipped payroll seed: no approved unpaid payroll found');
    return null;
  }

  await postPayrollToTreasury({
    payrollId: approvedPayroll.id,
    financeAccountId,
    postedBy: ADMIN_USER_ID,
  });

  await db
    .update(payroll)
    .set({
      status: 'paid',
      updatedAt: new Date(),
    })
    .where(eq(payroll.id, approvedPayroll.id));

  console.log(`Posted payroll ${approvedPayroll.id} into treasury`);
  return approvedPayroll.id;
}

async function ensureSeedPettyCash(sourceFinanceAccountId: number, pettyCashAccountId: number) {
  const [existing] = await db
    .select({
      id: pettyCashAllocations.id,
    })
    .from(pettyCashAllocations)
    .where(eq(pettyCashAllocations.purpose, 'Seed petty cash allocation for treasury testing'))
    .limit(1);

  if (existing) {
    return existing.id;
  }

  const allocation = await createPettyCashAllocation({
    sourceFinanceAccountId,
    pettyCashAccountId,
    allocatedToUserId: 2,
    amount: 20000,
    allocationDate: today,
    purpose: 'Seed petty cash allocation for treasury testing',
    createdBy: ADMIN_USER_ID,
  });

  const approvedExpense = await submitPettyCashExpense({
    allocationId: allocation.id,
    expenseDate: today,
    expenseCategory: 'Stationery',
    amount: 4500,
    justification: 'Seed approved petty cash expense',
    createdBy: 2,
  });

  await reviewPettyCashExpense({
    expenseId: approvedExpense.id,
    status: 'approved',
    reviewNotes: 'Approved during treasury sample seed',
    reviewedBy: ADMIN_USER_ID,
  });

  await submitPettyCashExpense({
    allocationId: allocation.id,
    expenseDate: today,
    expenseCategory: 'Transport',
    amount: 2300,
    justification: 'Seed submitted petty cash expense awaiting review',
    createdBy: 2,
  });

  console.log(`Created petty cash allocation ${allocation.allocationCode}`);
  return allocation.id;
}

async function main() {
  console.log('Seeding treasury sample data...');

  const currentAccount = await ensureFinanceAccount({
    accountCode: 'TR-CUR-001',
    accountName: 'Main Current Account',
    accountType: 'current',
    bankName: 'FarmFlow Bank',
    branchName: 'Head Office',
    accountNumberMasked: 'xxxx-2211',
    allowsCheque: true,
    openingBalance: 750000,
  });

  const cashAccount = await ensureFinanceAccount({
    accountCode: 'TR-CASH-001',
    accountName: 'Main Cash Safe',
    accountType: 'cash',
    openingBalance: 120000,
  });

  const pettyCashAccount = await ensureFinanceAccount({
    accountCode: 'TR-PC-001',
    accountName: 'Farm Petty Cash Float',
    accountType: 'petty_cash',
    openingBalance: 0,
  });

  await ensureManualTransfer(currentAccount.id, cashAccount.id);
  await ensureSeedReceipt(currentAccount.id);
  await ensureSeedPayroll(currentAccount.id);
  await ensureSeedPettyCash(cashAccount.id, pettyCashAccount.id);

  console.log('Treasury sample seed complete.');
  process.exit(0);
}

main().catch((error) => {
  console.error('Treasury sample seed failed:', error);
  process.exit(1);
});
