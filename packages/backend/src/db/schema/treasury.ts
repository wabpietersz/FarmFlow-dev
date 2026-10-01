import {
  pgTable,
  serial,
  varchar,
  integer,
  decimal,
  date,
  text,
  timestamp,
  boolean,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { sites } from './sites';
import { batches } from './batches';
import { costCentres, financeCategories } from './finance';

export const financeAccounts = pgTable(
  'finance_accounts',
  {
    id: serial('id').primaryKey(),
    accountCode: varchar('account_code', { length: 50 }).unique().notNull(),
    accountName: varchar('account_name', { length: 100 }).notNull(),
    accountType: varchar('account_type', { length: 50 }).notNull(),
    bankName: varchar('bank_name', { length: 100 }),
    branchName: varchar('branch_name', { length: 100 }),
    accountNumberMasked: varchar('account_number_masked', { length: 50 }),
    currencyCode: varchar('currency_code', { length: 10 }).default('LKR').notNull(),
    allowsCheque: boolean('allows_cheque').default(false).notNull(),
    openingBalance: decimal('opening_balance', { precision: 12, scale: 2 }).default('0').notNull(),
    openingBalanceDate: date('opening_balance_date'),
    status: varchar('status', { length: 50 }).default('active').notNull(),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_finance_accounts_type').on(table.accountType),
    index('idx_finance_accounts_status').on(table.status),
  ],
);

export const treasuryTransactions = pgTable(
  'treasury_transactions',
  {
    id: serial('id').primaryKey(),
    transactionCode: varchar('transaction_code', { length: 50 }).unique().notNull(),
    transactionType: varchar('transaction_type', { length: 50 }).notNull(),
    transactionDate: date('transaction_date').notNull(),
    status: varchar('status', { length: 50 }).default('posted').notNull(),
    referenceNumber: varchar('reference_number', { length: 100 }),
    counterpartyType: varchar('counterparty_type', { length: 50 }),
    counterpartyId: integer('counterparty_id'),
    counterpartyNameSnapshot: varchar('counterparty_name_snapshot', { length: 200 }),
    sourceModule: varchar('source_module', { length: 50 }),
    narrative: text('narrative'),
    createdBy: integer('created_by').references(() => users.id),
    approvedBy: integer('approved_by').references(() => users.id),
    postedBy: integer('posted_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_treasury_transactions_date').on(table.transactionDate),
    index('idx_treasury_transactions_type').on(table.transactionType),
    index('idx_treasury_transactions_status').on(table.status),
  ],
);

export const treasuryTransactionEntries = pgTable(
  'treasury_transaction_entries',
  {
    id: serial('id').primaryKey(),
    treasuryTransactionId: integer('treasury_transaction_id')
      .references(() => treasuryTransactions.id, { onDelete: 'cascade' })
      .notNull(),
    financeAccountId: integer('finance_account_id')
      .references(() => financeAccounts.id)
      .notNull(),
    entryDirection: varchar('entry_direction', { length: 20 }).notNull(),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    categoryId: integer('category_id')
      .references(() => financeCategories.id)
      .notNull(),
    costCentreId: integer('cost_centre_id').references(() => costCentres.id),
    batchId: integer('batch_id').references(() => batches.id),
    valueDate: date('value_date').notNull(),
    clearedAt: date('cleared_at'),
    reconciliationId: integer('reconciliation_id').references(() => financeReconciliations.id),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_treasury_entries_transaction').on(table.treasuryTransactionId),
    index('idx_treasury_entries_account').on(table.financeAccountId),
    index('idx_treasury_entries_value_date').on(table.valueDate),
    index('idx_treasury_entries_cleared_at').on(table.clearedAt),
    index('idx_treasury_entries_reconciliation').on(table.reconciliationId),
    index('idx_treasury_entries_category').on(table.categoryId),
    index('idx_treasury_entries_cost_centre').on(table.costCentreId),
    index('idx_treasury_entries_batch').on(table.batchId),
  ],
);

export const financeReconciliations = pgTable(
  'finance_reconciliations',
  {
    id: serial('id').primaryKey(),
    financeAccountId: integer('finance_account_id')
      .references(() => financeAccounts.id)
      .notNull(),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    statementDate: date('statement_date').notNull(),
    bookBalance: decimal('book_balance', { precision: 12, scale: 2 }).notNull(),
    clearedBalance: decimal('cleared_balance', { precision: 12, scale: 2 }).notNull(),
    statementBalance: decimal('statement_balance', { precision: 12, scale: 2 }).notNull(),
    varianceAmount: decimal('variance_amount', { precision: 12, scale: 2 }).default('0').notNull(),
    status: varchar('status', { length: 50 }).default('closed').notNull(),
    notes: text('notes'),
    createdBy: integer('created_by').references(() => users.id).notNull(),
    closedBy: integer('closed_by').references(() => users.id),
    closedAt: timestamp('closed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_finance_reconciliations_account').on(table.financeAccountId),
    index('idx_finance_reconciliations_period').on(table.periodStart, table.periodEnd),
    index('idx_finance_reconciliations_statement_date').on(table.statementDate),
    index('idx_finance_reconciliations_status').on(table.status),
  ],
);

export const treasuryTransactionLinks = pgTable(
  'treasury_transaction_links',
  {
    id: serial('id').primaryKey(),
    treasuryTransactionId: integer('treasury_transaction_id')
      .references(() => treasuryTransactions.id, { onDelete: 'cascade' })
      .notNull(),
    sourceModule: varchar('source_module', { length: 50 }).notNull(),
    sourceEntityType: varchar('source_entity_type', { length: 50 }).notNull(),
    sourceEntityId: integer('source_entity_id').notNull(),
    sourceCodeSnapshot: varchar('source_code_snapshot', { length: 100 }),
    allocatedAmount: decimal('allocated_amount', { precision: 12, scale: 2 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_treasury_links_transaction').on(table.treasuryTransactionId),
    index('idx_treasury_links_source').on(table.sourceModule, table.sourceEntityType, table.sourceEntityId),
  ],
);

export const chequeBooks = pgTable(
  'cheque_books',
  {
    id: serial('id').primaryKey(),
    financeAccountId: integer('finance_account_id')
      .references(() => financeAccounts.id)
      .notNull(),
    bookCode: varchar('book_code', { length: 50 }).unique().notNull(),
    startNumber: integer('start_number').notNull(),
    endNumber: integer('end_number').notNull(),
    issuedDate: date('issued_date').notNull(),
    status: varchar('status', { length: 50 }).default('active').notNull(),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_cheque_books_account').on(table.financeAccountId),
    index('idx_cheque_books_status').on(table.status),
  ],
);

export const chequeLeaves = pgTable(
  'cheque_leaves',
  {
    id: serial('id').primaryKey(),
    chequeBookId: integer('cheque_book_id')
      .references(() => chequeBooks.id, { onDelete: 'cascade' })
      .notNull(),
    financeAccountId: integer('finance_account_id')
      .references(() => financeAccounts.id)
      .notNull(),
    chequeNumber: varchar('cheque_number', { length: 50 }).unique().notNull(),
    status: varchar('status', { length: 50 }).default('available').notNull(),
    issueDate: date('issue_date'),
    clearDate: date('clear_date'),
    amount: decimal('amount', { precision: 12, scale: 2 }),
    payeeName: varchar('payee_name', { length: 200 }),
    treasuryTransactionId: integer('treasury_transaction_id').references(() => treasuryTransactions.id),
    sourceModule: varchar('source_module', { length: 50 }),
    sourceEntityType: varchar('source_entity_type', { length: 50 }),
    sourceEntityId: integer('source_entity_id'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_cheque_leaves_book').on(table.chequeBookId),
    index('idx_cheque_leaves_account').on(table.financeAccountId),
    index('idx_cheque_leaves_status').on(table.status),
    index('idx_cheque_leaves_source').on(table.sourceModule, table.sourceEntityType, table.sourceEntityId),
  ],
);

export const pettyCashAllocations = pgTable(
  'petty_cash_allocations',
  {
    id: serial('id').primaryKey(),
    allocationCode: varchar('allocation_code', { length: 50 }).unique().notNull(),
    sourceFinanceAccountId: integer('source_finance_account_id')
      .references(() => financeAccounts.id)
      .notNull(),
    pettyCashAccountId: integer('petty_cash_account_id')
      .references(() => financeAccounts.id)
      .notNull(),
    allocatedToUserId: integer('allocated_to_user_id')
      .references(() => users.id)
      .notNull(),
    siteId: integer('site_id').references(() => sites.id),
    purpose: text('purpose').notNull(),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    allocationDate: date('allocation_date').notNull(),
    status: varchar('status', { length: 50 }).default('allocated').notNull(),
    treasuryTransactionId: integer('treasury_transaction_id')
      .references(() => treasuryTransactions.id)
      .notNull(),
    reviewedBy: integer('reviewed_by').references(() => users.id),
    reviewedAt: timestamp('reviewed_at'),
    reviewNotes: text('review_notes'),
    createdBy: integer('created_by').references(() => users.id).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_petty_cash_allocations_code').on(table.allocationCode),
    index('idx_petty_cash_allocations_account').on(table.pettyCashAccountId),
    index('idx_petty_cash_allocations_user').on(table.allocatedToUserId),
    index('idx_petty_cash_allocations_status').on(table.status),
  ],
);

export const pettyCashExpenses = pgTable(
  'petty_cash_expenses',
  {
    id: serial('id').primaryKey(),
    allocationId: integer('allocation_id')
      .references(() => pettyCashAllocations.id, { onDelete: 'cascade' })
      .notNull(),
    expenseDate: date('expense_date').notNull(),
    expenseCategory: varchar('expense_category', { length: 100 }).notNull(),
    categoryId: integer('category_id').references(() => financeCategories.id),
    costCentreId: integer('cost_centre_id').references(() => costCentres.id),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    justification: text('justification').notNull(),
    status: varchar('status', { length: 50 }).default('submitted').notNull(),
    treasuryTransactionId: integer('treasury_transaction_id')
      .references(() => treasuryTransactions.id),
    reviewedBy: integer('reviewed_by').references(() => users.id),
    reviewedAt: timestamp('reviewed_at'),
    reviewNotes: text('review_notes'),
    createdBy: integer('created_by').references(() => users.id).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_petty_cash_expenses_allocation').on(table.allocationId),
    index('idx_petty_cash_expenses_status').on(table.status),
    index('idx_petty_cash_expenses_date').on(table.expenseDate),
    index('idx_petty_cash_expenses_cost_centre_id').on(table.costCentreId),
  ],
);

export const operationalExpenses = pgTable(
  'operational_expenses',
  {
    id: serial('id').primaryKey(),
    expenseCode: varchar('expense_code', { length: 50 }).unique().notNull(),
    expenseDate: date('expense_date').notNull(),
    expenseCategory: varchar('expense_category', { length: 100 }).notNull(),
    categoryId: integer('category_id').references(() => financeCategories.id),
    costCentreId: integer('cost_centre_id').references(() => costCentres.id),
    counterpartyName: varchar('counterparty_name', { length: 200 }),
    allocationType: varchar('allocation_type', { length: 50 }).default('shared_overhead').notNull(),
    siteId: integer('site_id').references(() => sites.id),
    batchId: integer('batch_id').references(() => batches.id),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    status: varchar('status', { length: 50 }).default('pending_approval').notNull(),
    approvalNotes: text('approval_notes'),
    approvedBy: integer('approved_by').references(() => users.id),
    approvedAt: timestamp('approved_at'),
    financeAccountId: integer('finance_account_id').references(() => financeAccounts.id),
    paymentMethod: varchar('payment_method', { length: 50 }),
    referenceNumber: varchar('reference_number', { length: 100 }),
    chequeLeafId: integer('cheque_leaf_id').references(() => chequeLeaves.id),
    chequeNumber: varchar('cheque_number', { length: 50 }),
    chequeDate: date('cheque_date'),
    bankName: varchar('bank_name', { length: 100 }),
    treasuryTransactionId: integer('treasury_transaction_id').references(() => treasuryTransactions.id),
    treasuryReversalTransactionId: integer('treasury_reversal_transaction_id').references(() => treasuryTransactions.id),
    requestedBy: integer('requested_by').references(() => users.id).notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_operational_expenses_date').on(table.expenseDate),
    index('idx_operational_expenses_category').on(table.expenseCategory),
    index('idx_operational_expenses_status').on(table.status),
    index('idx_operational_expenses_site').on(table.siteId),
    index('idx_operational_expenses_batch').on(table.batchId),
    index('idx_operational_expenses_account').on(table.financeAccountId),
    index('idx_operational_expenses_treasury_transaction_id').on(table.treasuryTransactionId),
    index('idx_operational_expenses_cost_centre_id').on(table.costCentreId),
  ],
);

/** Loans the business has taken (bank, leasing, family). Money in when received; repayments split principal/interest. */
export const businessLoans = pgTable(
  'business_loans',
  {
    id: serial('id').primaryKey(),
    loanCode: varchar('loan_code', { length: 50 }).unique().notNull(),
    lender: varchar('lender', { length: 150 }).notNull(),
    principal: decimal('principal', { precision: 14, scale: 2 }).notNull(),
    /** Annual rate in %, for reference and suggested interest */
    interestRate: decimal('interest_rate', { precision: 6, scale: 3 }),
    receivedDate: date('received_date').notNull(),
    termMonths: integer('term_months'),
    monthlyInstallment: decimal('monthly_installment', { precision: 14, scale: 2 }),
    financeAccountId: integer('finance_account_id').references(() => financeAccounts.id).notNull(),
    treasuryTransactionId: integer('treasury_transaction_id').references(() => treasuryTransactions.id),
    /** active | repaid */
    status: varchar('status', { length: 20 }).default('active').notNull(),
    notes: text('notes'),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
);

export const businessLoanRepayments = pgTable(
  'business_loan_repayments',
  {
    id: serial('id').primaryKey(),
    loanId: integer('loan_id').references(() => businessLoans.id).notNull(),
    paymentDate: date('payment_date').notNull(),
    principalAmount: decimal('principal_amount', { precision: 14, scale: 2 }).notNull(),
    interestAmount: decimal('interest_amount', { precision: 14, scale: 2 }).default('0').notNull(),
    financeAccountId: integer('finance_account_id').references(() => financeAccounts.id).notNull(),
    treasuryTransactionId: integer('treasury_transaction_id').references(() => treasuryTransactions.id),
    reference: varchar('reference', { length: 100 }),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_business_loan_repayments_loan').on(table.loanId)],
);
