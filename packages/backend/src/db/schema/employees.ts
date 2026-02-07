import {
  pgTable,
  serial,
  varchar,
  integer,
  date,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { sites } from './sites';

export const employees = pgTable(
  'employees',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .unique()
      .references(() => users.id, { onDelete: 'set null' }),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    designation: varchar('designation', { length: 100 }).notNull(),
    siteId: integer('site_id')
      .references(() => sites.id)
      .notNull(),
    employmentType: varchar('employment_type', { length: 50 }).notNull(),
    joinDate: date('join_date').notNull(),
    status: varchar('status', { length: 50 }).default('active').notNull(),
    phone: varchar('phone', { length: 20 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_employees_site_id').on(table.siteId),
    index('idx_employees_designation').on(table.designation),
    index('idx_employees_status').on(table.status),
  ],
);

export const emergencyContacts = pgTable('emergency_contacts', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id')
    .references(() => employees.id, { onDelete: 'cascade' })
    .notNull(),
  contactName: varchar('contact_name', { length: 100 }).notNull(),
  relationship: varchar('relationship', { length: 50 }).notNull(),
  phoneNumber: varchar('phone_number', { length: 20 }).notNull(),
});

export const bankDetails = pgTable('bank_details', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id')
    .references(() => employees.id, { onDelete: 'cascade' })
    .unique()
    .notNull(),
  accountHolderName: varchar('account_holder_name', { length: 100 }).notNull(),
  bankName: varchar('bank_name', { length: 100 }).notNull(),
  branchCode: varchar('branch_code', { length: 20 }),
  accountNumber: varchar('account_number', { length: 50 }).notNull(),
  ifscCode: varchar('ifsc_code', { length: 20 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
