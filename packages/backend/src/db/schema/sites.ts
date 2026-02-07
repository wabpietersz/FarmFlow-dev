import { pgTable, serial, varchar, integer, timestamp, index, unique } from 'drizzle-orm/pg-core';

export const sites = pgTable('sites', {
  id: serial('id').primaryKey(),
  siteName: varchar('site_name', { length: 100 }).unique().notNull(),
  location: varchar('location', { length: 255 }).notNull(),
  capacity: integer('capacity').notNull(),
  status: varchar('status', { length: 50 }).default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const cages = pgTable(
  'cages',
  {
    id: serial('id').primaryKey(),
    siteId: integer('site_id')
      .references(() => sites.id)
      .notNull(),
    cageNumber: varchar('cage_number', { length: 50 }).notNull(),
    capacity: integer('capacity').notNull(),
    status: varchar('status', { length: 50 }).default('empty').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_cages_site_id').on(table.siteId),
    index('idx_cages_status').on(table.status),
    unique('uq_cages_site_cage').on(table.siteId, table.cageNumber),
  ],
);
