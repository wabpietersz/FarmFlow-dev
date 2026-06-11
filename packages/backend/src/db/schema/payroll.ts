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
