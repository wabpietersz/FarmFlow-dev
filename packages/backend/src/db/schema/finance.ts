import {
  pgTable,
  serial,
  varchar,
  integer,
  boolean,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sites } from './sites';

// Where money is earned or spent: one per farm site, plus the feed mill and admin/head office.
export const costCentres = pgTable(
  'cost_centres',
  {
    id: serial('id').primaryKey(),
    code: varchar('code', { length: 50 }).unique().notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    centreType: varchar('centre_type', { length: 20 }).notNull(),
    siteId: integer('site_id').references(() => sites.id).unique(),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_cost_centres_type').on(table.centreType),
    index('idx_cost_centres_status').on(table.status),
  ],
);

// What the money was for. `code` is a stable key used by postings and, later, GL account mapping.
export const financeCategories = pgTable(
  'finance_categories',
  {
    id: serial('id').primaryKey(),
    code: varchar('code', { length: 50 }).unique().notNull(),
    name: varchar('name', { length: 100 }).unique().notNull(),
    categoryType: varchar('category_type', { length: 20 }).notNull(),
    reportGroup: varchar('report_group', { length: 100 }).notNull(),
    description: text('description'),
    isSystem: boolean('is_system').default(false).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_finance_categories_type').on(table.categoryType),
    index('idx_finance_categories_status').on(table.status),
  ],
);
