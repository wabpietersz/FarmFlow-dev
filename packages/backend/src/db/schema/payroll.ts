import {
  pgTable,
  serial,
  varchar,
  integer,
  decimal,
  date,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { employees } from './employees';
import { users } from './users';

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
    attendedDays: integer('attended_days').notNull(),
    overtimeHours: decimal('overtime_hours', { precision: 8, scale: 2 }).default('0'),
    overtimeRate: decimal('overtime_rate', { precision: 10, scale: 2 }),
    grossSalary: decimal('gross_salary', { precision: 12, scale: 2 }).notNull(),
    netSalary: decimal('net_salary', { precision: 12, scale: 2 }).notNull(),
    status: varchar('status', { length: 50 }).default('draft').notNull(),
    approvedBy: integer('approved_by').references(() => users.id),
    paidDate: date('paid_date'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_payroll_employee_id').on(table.employeeId),
    index('idx_payroll_pay_period').on(table.payPeriod),
    index('idx_payroll_status').on(table.status),
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
