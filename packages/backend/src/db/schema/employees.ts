import {
  pgTable,
  serial,
  varchar,
  integer,
  decimal,
  boolean,
  date,
  text,
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

export const employeeCompensation = pgTable(
  'employee_compensation',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id')
      .references(() => employees.id, { onDelete: 'cascade' })
      .unique()
      .notNull(),
    payType: varchar('pay_type', { length: 20 }).notNull(),
    baseRate: decimal('base_rate', { precision: 12, scale: 2 }).notNull(),
    overtimeRate: decimal('overtime_rate', { precision: 10, scale: 2 }).default('0').notNull(),
    effectiveFrom: date('effective_from').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_employee_compensation_employee_id').on(table.employeeId),
    index('idx_employee_compensation_pay_type').on(table.payType),
  ],
);

export const employeeCompensationRevisions = pgTable(
  'employee_compensation_revisions',
  {
    id: serial('id').primaryKey(),
    employeeId: integer('employee_id')
      .references(() => employees.id, { onDelete: 'cascade' })
      .notNull(),
    payType: varchar('pay_type', { length: 20 }).notNull(),
    baseRate: decimal('base_rate', { precision: 12, scale: 2 }).notNull(),
    overtimeRate: decimal('overtime_rate', { precision: 10, scale: 2 }).default('0').notNull(),
    effectiveFrom: date('effective_from').notNull(),
    effectiveTo: date('effective_to'),
    standardHoursPerDay: decimal('standard_hours_per_day', { precision: 4, scale: 2 }).default('8.00').notNull(),
    notes: text('notes'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_employee_comp_revisions_employee_id').on(table.employeeId),
    index('idx_employee_comp_revisions_effective_from').on(table.effectiveFrom),
    index('idx_employee_comp_revisions_effective_to').on(table.effectiveTo),
    index('idx_employee_comp_revisions_active').on(table.isActive),
  ],
);

export const employeeCompensationComponents = pgTable(
  'employee_compensation_components',
  {
    id: serial('id').primaryKey(),
    revisionId: integer('revision_id')
      .references(() => employeeCompensationRevisions.id, { onDelete: 'cascade' })
      .notNull(),
    componentType: varchar('component_type', { length: 20 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    calculationType: varchar('calculation_type', { length: 20 }).notNull(),
    value: decimal('value', { precision: 12, scale: 2 }).notNull(),
    isTaxable: boolean('is_taxable').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_employee_comp_components_revision_id').on(table.revisionId),
    index('idx_employee_comp_components_type').on(table.componentType),
    index('idx_employee_comp_components_active').on(table.isActive),
  ],
);
