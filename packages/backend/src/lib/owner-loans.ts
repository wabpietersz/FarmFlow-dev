import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { businessLoanRepayments, businessLoans } from '../db/schema';
import { assertPeriodOpen } from './period-locks';
import { createTreasuryTransactionRecord, ensureActiveFinanceAccount } from './treasury';

/** A rule the person can fix (400). */
export class OwnerLoanError extends Error {}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

// ---------------------------------------------------------------------------
// Owner money in / out
// ---------------------------------------------------------------------------

/** Owner puts money into the business (capital) or takes it out (drawings). Not income or expense. */
export async function recordOwnerMoney(input: { direction: 'in' | 'out'; amount: number; date: string; financeAccountId: number; reference?: string | null; notes?: string | null; userId: number }) {
  if (input.amount <= 0) throw new OwnerLoanError('Amount must be positive');
  return db.transaction(async (tx) => {
    await assertPeriodOpen(input.date, 'financial');
    await ensureActiveFinanceAccount(input.financeAccountId, tx);
    const capital = input.direction === 'in';
    return createTreasuryTransactionRecord({
      transactionType: capital ? 'owner_capital' : 'owner_drawings',
      transactionDate: input.date,
      referenceNumber: input.reference || null,
      counterpartyType: 'owner',
      counterpartyNameSnapshot: 'Owner',
      sourceModule: 'treasury',
      narrative: input.notes || (capital ? 'Owner money in' : 'Owner drawings'),
      createdBy: input.userId,
      entries: [{
        financeAccountId: input.financeAccountId,
        entryDirection: capital ? 'inflow' : 'outflow',
        amount: input.amount,
        valueDate: input.date,
        notes: input.notes || undefined,
        tags: { categoryCode: capital ? 'owner_capital' : 'owner_drawings', costCentreCode: 'ADMIN' },
      }],
      executor: tx,
    });
  });
}

// ---------------------------------------------------------------------------
// Business loans
// ---------------------------------------------------------------------------

export async function listBusinessLoans() {
  const loans = await db
    .select({
      loan: businessLoans,
      principalRepaid: sql<number>`COALESCE((SELECT SUM(r.principal_amount::numeric) FROM business_loan_repayments r WHERE r.loan_id = "business_loans"."id"), 0)::float`,
      interestPaid: sql<number>`COALESCE((SELECT SUM(r.interest_amount::numeric) FROM business_loan_repayments r WHERE r.loan_id = "business_loans"."id"), 0)::float`,
      lastPayment: sql<string | null>`(SELECT to_char(MAX(r.payment_date), 'YYYY-MM-DD') FROM business_loan_repayments r WHERE r.loan_id = "business_loans"."id")`,
    })
    .from(businessLoans)
    .orderBy(asc(businessLoans.status), desc(businessLoans.receivedDate));

  return loans.map(({ loan, principalRepaid, interestPaid, lastPayment }) => {
    const principal = Number(loan.principal);
    const outstanding = round2(principal - principalRepaid);
    const rate = loan.interestRate != null ? Number(loan.interestRate) : null;
    return {
      ...loan,
      principal,
      interestRate: rate,
      monthlyInstallment: loan.monthlyInstallment != null ? Number(loan.monthlyInstallment) : null,
      principalRepaid: round2(principalRepaid),
      interestPaid: round2(interestPaid),
      outstanding,
      lastPayment,
      /** One month's interest on what's left, to pre-fill a repayment */
      suggestedInterest: rate ? round2((outstanding * rate) / 100 / 12) : 0,
    };
  });
}

export async function getLoanRepayments(loanId: number) {
  return db.select().from(businessLoanRepayments).where(eq(businessLoanRepayments.loanId, loanId)).orderBy(desc(businessLoanRepayments.paymentDate), desc(businessLoanRepayments.id));
}

async function nextLoanCode(date: string, executor: typeof db | any) {
  const prefix = `LOAN-${date.slice(0, 4)}-`;
  const [row] = await executor.select({ count: sql<number>`count(*)::int` }).from(businessLoans).where(sql`${businessLoans.loanCode} LIKE ${prefix + '%'}`);
  return `${prefix}${String((row?.count ?? 0) + 1).padStart(3, '0')}`;
}

/** Records a loan received into an account (money in, "Loan Received"). */
export async function receiveBusinessLoan(input: {
  lender: string; principal: number; receivedDate: string; financeAccountId: number;
  interestRate?: number | null; termMonths?: number | null; monthlyInstallment?: number | null; notes?: string | null; userId: number;
}) {
  if (input.principal <= 0) throw new OwnerLoanError('Amount must be positive');
  return db.transaction(async (tx) => {
    await assertPeriodOpen(input.receivedDate, 'financial');
    await ensureActiveFinanceAccount(input.financeAccountId, tx);
    const loanCode = await nextLoanCode(input.receivedDate, tx);
    const transaction = await createTreasuryTransactionRecord({
      transactionType: 'loan_received',
      transactionDate: input.receivedDate,
      referenceNumber: loanCode,
      counterpartyType: 'lender',
      counterpartyNameSnapshot: input.lender,
      sourceModule: 'treasury',
      narrative: `Loan from ${input.lender}`,
      createdBy: input.userId,
      entries: [{
        financeAccountId: input.financeAccountId, entryDirection: 'inflow', amount: input.principal, valueDate: input.receivedDate,
        notes: loanCode, tags: { categoryCode: 'loan_received', costCentreCode: 'ADMIN' },
      }],
      executor: tx,
    });
    const [loan] = await tx.insert(businessLoans).values({
      loanCode,
      lender: input.lender,
      principal: input.principal.toFixed(2),
      interestRate: input.interestRate != null ? input.interestRate.toFixed(3) : null,
      receivedDate: input.receivedDate,
      termMonths: input.termMonths ?? null,
      monthlyInstallment: input.monthlyInstallment != null ? input.monthlyInstallment.toFixed(2) : null,
      financeAccountId: input.financeAccountId,
      treasuryTransactionId: transaction.id,
      notes: input.notes || null,
      createdBy: input.userId,
    }).returning();
    return loan;
  });
}

/**
 * One repayment, split: principal reduces the loan ("Loan Principal Repayment", not an expense);
 * interest is a cost ("Loan Interest", shows in profit & loss).
 */
export async function repayBusinessLoan(input: { loanId: number; paymentDate: string; principalAmount: number; interestAmount: number; financeAccountId: number; reference?: string | null; userId: number }) {
  if (input.principalAmount < 0 || input.interestAmount < 0 || input.principalAmount + input.interestAmount <= 0) {
    throw new OwnerLoanError('Enter the principal and/or interest paid');
  }
  return db.transaction(async (tx) => {
    const [loan] = await tx.select().from(businessLoans).where(eq(businessLoans.id, input.loanId)).limit(1);
    if (!loan) throw new OwnerLoanError('Loan not found');
    if (loan.status !== 'active') throw new OwnerLoanError('This loan is already repaid');
    const [{ repaid }] = await tx
      .select({ repaid: sql<number>`COALESCE(SUM(${businessLoanRepayments.principalAmount}::numeric), 0)::float` })
      .from(businessLoanRepayments)
      .where(eq(businessLoanRepayments.loanId, loan.id));
    const outstanding = round2(Number(loan.principal) - repaid);
    if (input.principalAmount > outstanding + 0.001) {
      throw new OwnerLoanError(`Only Rs ${outstanding.toLocaleString('en-US')} principal is left on this loan`);
    }
    await assertPeriodOpen(input.paymentDate, 'financial');
    await ensureActiveFinanceAccount(input.financeAccountId, tx);

    const base = { financeAccountId: input.financeAccountId, entryDirection: 'outflow' as const, valueDate: input.paymentDate };
    const entries = [];
    if (input.principalAmount > 0) entries.push({ ...base, amount: input.principalAmount, notes: 'Principal', tags: { categoryCode: 'loan_repayment', costCentreCode: 'ADMIN' } });
    if (input.interestAmount > 0) entries.push({ ...base, amount: input.interestAmount, notes: 'Interest', tags: { categoryCode: 'loan_interest', costCentreCode: 'ADMIN' } });

    const transaction = await createTreasuryTransactionRecord({
      transactionType: 'loan_repayment',
      transactionDate: input.paymentDate,
      referenceNumber: input.reference || loan.loanCode,
      counterpartyType: 'lender',
      counterpartyNameSnapshot: loan.lender,
      sourceModule: 'treasury',
      narrative: `Repayment of ${loan.loanCode} to ${loan.lender}`,
      createdBy: input.userId,
      entries,
      executor: tx,
    });
    const [repayment] = await tx.insert(businessLoanRepayments).values({
      loanId: loan.id,
      paymentDate: input.paymentDate,
      principalAmount: input.principalAmount.toFixed(2),
      interestAmount: input.interestAmount.toFixed(2),
      financeAccountId: input.financeAccountId,
      treasuryTransactionId: transaction.id,
      reference: input.reference || null,
      createdBy: input.userId,
    }).returning();
    if (round2(outstanding - input.principalAmount) <= 0) {
      await tx.update(businessLoans).set({ status: 'repaid', updatedAt: new Date() }).where(and(eq(businessLoans.id, loan.id)));
    }
    return repayment;
  });
}
