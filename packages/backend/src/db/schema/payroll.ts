import {
  pgTable,
  serial,
  varchar,
  integer,
  boolean,
  decimal,
  date,
  text,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { employees, employeeCompensationRevisions } from './employees';
import { users } from './users';
import { chequeLeaves, financeAccounts, treasuryTransactions } from './treasury';

export const payroll = pgTable(
  'payroll',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id')
      .references(() => employees.id)
      .notNull(),
    payPeriod: date('pay_period').notNull(),
    baseSalary: decimal('base_salary', { precision: 12, scale: 2 }).notNull(),
    workingDays: integer('working_days').notNull(),
    attendedDays: decimal('attended_days', { precision: 6, scale: 1 }).notNull(),
    overtimeHours: decimal('overtime_hours', { precision: 8, scale: 2 }).default('0'),
    overtimeRate: decimal('overtime_rate', { precision: 10, scale: 2 }),
    grossSalary: decimal('gross_salary', { precision: 12, scale: 2 }).notNull(),
    /** Earnings EPF/ETF are worked out on (basic + allowances that count for EPF) */
    epfBase: decimal('epf_base', { precision: 12, scale: 2 }).default('0').notNull(),
    /** Employee EPF, deducted from pay */
    epfEmployee: decimal('epf_employee', { precision: 12, scale: 2 }).default('0').notNull(),
    /** Employer EPF and ETF: a cost to the business, paid with the monthly return */
    epfEmployer: decimal('epf_employer', { precision: 12, scale: 2 }).default('0').notNull(),
    etfEmployer: decimal('etf_employer', { precision: 12, scale: 2 }).default('0').notNull(),
    /** Manual deductions (not EPF, not loans) */
    otherDeductions: decimal('other_deductions', { precision: 12, scale: 2 }).default('0').notNull(),
    loanRecovery: decimal('loan_recovery', { precision: 12, scale: 2 }).default('0').notNull(),
    /** Rates used, so old payslips don't change if rates do */
    statutoryRates: jsonb('statutory_rates'),
    netSalary: decimal('net_salary', { precision: 12, scale: 2 }).notNull(),
    status: varchar('status', { length: 50 }).default('draft').notNull(),
    approvedBy: integer('approved_by').references(() => users.id),
    paidDate: date('paid_date'),
    financeAccountId: integer('finance_account_id').references(() => financeAccounts.id),
    paymentMethod: varchar('payment_method', { length: 50 }),
    chequeLeafId: integer('cheque_leaf_id').references(() => chequeLeaves.id),
    treasuryTransactionId: integer('treasury_transaction_id').references(() => treasuryTransactions.id),
    compensationRevisionId: integer('compensation_revision_id')
      .references(() => employeeCompensationRevisions.id),
    compensationSnapshot: jsonb('compensation_snapshot'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_payroll_employee_id').on(table.employeeId),
    index('idx_payroll_pay_period').on(table.payPeriod),
    index('idx_payroll_status').on(table.status),
    index('idx_payroll_compensation_revision_id').on(table.compensationRevisionId),
  ],
);

export const payrollDeductions = pgTable('payroll_deductions', {
  id: serial('id').primaryKey(),
  payrollId: integer('payroll_id')
    .references(() => payroll.id, { onDelete: 'cascade' })
    .notNull(),
  deductionType: varchar('deduction_type', { length: 100 }).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  remarks: text('remarks'),
});

export const payrollAllowances = pgTable('payroll_allowances', {
  id: serial('id').primaryKey(),
  payrollId: integer('payroll_id')
    .references(() => payroll.id, { onDelete: 'cascade' })
    .notNull(),
  allowanceType: varchar('allowance_type', { length: 100 }).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  countsForEpf: boolean('counts_for_epf').default(false).notNull(),
  remarks: text('remarks'),
});

export const compensationTemplates = pgTable(
  'compensation_templates',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    category: varchar('category', { length: 20 }).notNull(),
    defaultAmount: decimal('default_amount', { precision: 12, scale: 2 }),
    description: text('description'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_compensation_templates_category').on(table.category),
    index('idx_compensation_templates_active').on(table.isActive),
  ],
);

/** Salary advances and staff loans, paid out from Money and recovered through payroll. */
export const staffLoans = pgTable(
  'staff_loans',
  {
    id: serial('id').primaryKey(),
    loanCode: varchar('loan_code', { length: 50 }).unique().notNull(),
    employeeId: integer('employee_id').references(() => employees.id).notNull(),
    /** advance (usually recovered next month) | loan (instalments) */
    loanType: varchar('loan_type', { length: 20 }).notNull(),
    principal: decimal('principal', { precision: 12, scale: 2 }).notNull(),
    installmentAmount: decimal('installment_amount', { precision: 12, scale: 2 }).notNull(),
    issuedDate: date('issued_date').notNull(),
    /** First pay period (YYYY-MM-01) recovered from */
    firstRecoveryPeriod: date('first_recovery_period').notNull(),
    /** active | settled | written_off */
    status: varchar('status', { length: 20 }).default('active').notNull(),
    financeAccountId: integer('finance_account_id').references(() => financeAccounts.id),
    paymentMethod: varchar('payment_method', { length: 20 }),
    treasuryTransactionId: integer('treasury_transaction_id').references(() => treasuryTransactions.id),
    notes: text('notes'),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_staff_loans_employee').on(table.employeeId),
    index('idx_staff_loans_status').on(table.status),
  ],
);

/** A recovery is either taken in a payroll (payrollId) or paid back in cash/bank (treasuryTransactionId). */
export const staffLoanRecoveries = pgTable(
  'staff_loan_recoveries',
  {
    id: serial('id').primaryKey(),
    loanId: integer('loan_id').references(() => staffLoans.id).notNull(),
    payrollId: integer('payroll_id').references(() => payroll.id, { onDelete: 'cascade' }),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    recoveryDate: date('recovery_date').notNull(),
    treasuryTransactionId: integer('treasury_transaction_id').references(() => treasuryTransactions.id),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_staff_loan_recoveries_loan').on(table.loanId),
    index('idx_staff_loan_recoveries_payroll').on(table.payrollId),
  ],
);

/** Monthly EPF/ETF payment for a pay period. */
export const statutoryRemittances = pgTable(
  'statutory_remittances',
  {
    id: serial('id').primaryKey(),
    payPeriod: date('pay_period').unique().notNull(),
    epfEmployee: decimal('epf_employee', { precision: 12, scale: 2 }).notNull(),
    epfEmployer: decimal('epf_employer', { precision: 12, scale: 2 }).notNull(),
    etfEmployer: decimal('etf_employer', { precision: 12, scale: 2 }).notNull(),
    employeeCount: integer('employee_count').notNull(),
    paidDate: date('paid_date').notNull(),
    financeAccountId: integer('finance_account_id').references(() => financeAccounts.id).notNull(),
    epfReference: varchar('epf_reference', { length: 100 }),
    etfReference: varchar('etf_reference', { length: 100 }),
    treasuryTransactionId: integer('treasury_transaction_id').references(() => treasuryTransactions.id),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
);
