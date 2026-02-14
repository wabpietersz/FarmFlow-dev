import {
  pgTable,
  serial,
  varchar,
  integer,
  decimal,
  date,
  time,
  text,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { employees } from './employees';
import { users } from './users';

export const shifts = pgTable('shifts', {
  id: serial('id').primaryKey(),
  shiftName: varchar('shift_name', { length: 100 }).unique().notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  status: varchar('status', { length: 50 }).default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const attendance = pgTable(
  'attendance',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id')
      .references(() => employees.id)
      .notNull(),
    attendanceDate: date('attendance_date').notNull(),
    status: varchar('status', { length: 50 }).notNull(),
    leaveType: varchar('leave_type', { length: 50 }),
    shiftId: integer('shift_id').references(() => shifts.id),
    notes: text('notes'),
    recordedBy: integer('recorded_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_attendance_employee_id').on(table.employeeId),
    index('idx_attendance_date').on(table.attendanceDate),
    unique('uq_attendance_employee_date').on(table.employeeId, table.attendanceDate),
  ],
);

export const leaveBalances = pgTable(
  'leave_balances',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id')
      .references(() => employees.id)
      .notNull(),
    leaveType: varchar('leave_type', { length: 50 }).notNull(),
    year: integer('year').notNull(),
    totalDays: decimal('total_days', { precision: 6, scale: 1 }).notNull(),
    usedDays: decimal('used_days', { precision: 6, scale: 1 }).default('0').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_leave_balances_employee_id').on(table.employeeId),
    unique('uq_leave_balance_employee_type_year').on(table.employeeId, table.leaveType, table.year),
  ],
);
