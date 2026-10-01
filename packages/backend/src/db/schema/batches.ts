import {
  pgTable,
  serial,
  varchar,
  integer,
  date,
  timestamp,
  text,
  decimal,
  index,
  unique,
  jsonb,
} from 'drizzle-orm/pg-core';
import { sites, cages } from './sites';
import { users } from './users';

export const batches = pgTable(
  'batches',
  {
    id: serial('id').primaryKey(),
    batchCode: varchar('batch_code', { length: 50 }).unique().notNull(),
    siteId: integer('site_id')
      .references(() => sites.id)
      .notNull(),
    cageId: integer('cage_id')
      .references(() => cages.id)
      .notNull(),
    chicksPlaced: integer('chicks_placed').notNull(),
    placementDate: date('placement_date').notNull(),
    expectedDeliveryDate: date('expected_delivery_date'),
    actualDeliveryDate: date('actual_delivery_date'),
    status: varchar('status', { length: 50 }).default('placement').notNull(),
    /** Target curve this batch is measured against (FK to growth_standards; kept loose to avoid a circular import) */
    growthStandardId: integer('growth_standard_id'),
    /** Health programme its tasks were generated from */
    healthTemplateId: integer('health_template_id'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_batches_site_id').on(table.siteId),
    index('idx_batches_status').on(table.status),
    index('idx_batches_cage_id').on(table.cageId),
  ],
);

export const dailyRecords = pgTable(
  'daily_records',
  {
    id: serial('id').primaryKey(),
    batchId: integer('batch_id')
      .references(() => batches.id)
      .notNull(),
    recordDate: date('record_date').notNull(),
    currentAge: integer('current_age').notNull(),
    birdCount: integer('bird_count').notNull(),
    mortalityCount: integer('mortality_count').default(0).notNull(),
    mortalityCause: varchar('mortality_cause', { length: 100 }),
    waterConsumption: decimal('water_consumption', { precision: 8, scale: 2 }),
    feedConsumption: decimal('feed_consumption', { precision: 8, scale: 2 }).notNull(),
    averageWeight: decimal('average_weight', { precision: 8, scale: 2 }),
    temperature: decimal('temperature', { precision: 5, scale: 2 }),
    humidity: integer('humidity'),
    ammoniaLevel: decimal('ammonia_level', { precision: 5, scale: 2 }),
    recordedBy: integer('recorded_by').references(() => users.id),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_daily_records_batch_id').on(table.batchId),
    index('idx_daily_records_record_date').on(table.recordDate),
    unique('uq_daily_records_batch_date').on(table.batchId, table.recordDate),
  ],
);

export const dailyRecordPhotos = pgTable('daily_record_photos', {
  id: serial('id').primaryKey(),
  dailyRecordId: integer('daily_record_id')
    .references(() => dailyRecords.id, { onDelete: 'cascade' })
    .notNull(),
  photoUrl: varchar('photo_url', { length: 512 }).notNull(),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
});

export const vaccinations = pgTable(
  'vaccinations',
  {
    id: serial('id').primaryKey(),
    batchId: integer('batch_id')
      .references(() => batches.id)
      .notNull(),
    vaccineType: varchar('vaccine_type', { length: 100 }).notNull(),
    vaccinationDate: date('vaccination_date').notNull(),
    inventoryItemId: integer('inventory_item_id'),
    quantityUsed: decimal('quantity_used', { precision: 10, scale: 2 }),
    unit: varchar('unit', { length: 20 }),
    inventoryCost: decimal('inventory_cost', { precision: 12, scale: 2 }),
    notes: text('notes'),
    recordedBy: integer('recorded_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_vaccinations_batch_id').on(table.batchId),
    index('idx_vaccinations_inventory_item').on(table.inventoryItemId),
  ],
);

// Frozen result of a closed batch: costs, revenue and KPIs as they stood on the day it was closed.
export const batchCloseSnapshots = pgTable('batch_close_snapshots', {
  id: serial('id').primaryKey(),
  batchId: integer('batch_id')
    .references(() => batches.id)
    .unique()
    .notNull(),
  closedAt: timestamp('closed_at').defaultNow().notNull(),
  closedBy: integer('closed_by').references(() => users.id),
  revenue: decimal('revenue', { precision: 14, scale: 2 }).notNull(),
  totalCost: decimal('total_cost', { precision: 14, scale: 2 }).notNull(),
  profit: decimal('profit', { precision: 14, scale: 2 }).notNull(),
  costs: jsonb('costs').notNull(),
  kpis: jsonb('kpis').notNull(),
  notes: text('notes'),
});
