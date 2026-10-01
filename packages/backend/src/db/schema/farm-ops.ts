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
  unique,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { sites, cages } from './sites';
import { batches, vaccinations } from './batches';
import { feedInventory } from './feed';

// ─── Health programmes: vaccination & medication plans by day of age ─────────

export const healthScheduleTemplates = pgTable('health_schedule_templates', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 150 }).unique().notNull(),
  description: text('description'),
  isDefault: boolean('is_default').default(false).notNull(),
  status: varchar('status', { length: 20 }).default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const healthScheduleItems = pgTable(
  'health_schedule_items',
  {
    id: serial('id').primaryKey(),
    templateId: integer('template_id')
      .references(() => healthScheduleTemplates.id, { onDelete: 'cascade' })
      .notNull(),
    dayOfAge: integer('day_of_age').notNull(),
    taskType: varchar('task_type', { length: 20 }).notNull(),
    name: varchar('name', { length: 150 }).notNull(),
    method: varchar('method', { length: 30 }),
    inventoryItemId: integer('inventory_item_id').references(() => feedInventory.id),
    /** Stock needed per 1,000 birds, in the inventory item's unit */
    dosePer1000Birds: decimal('dose_per_1000_birds', { precision: 10, scale: 3 }),
    notes: text('notes'),
  },
  (table) => [index('idx_health_schedule_items_template').on(table.templateId, table.dayOfAge)],
);

export const batchHealthTasks = pgTable(
  'batch_health_tasks',
  {
    id: serial('id').primaryKey(),
    batchId: integer('batch_id')
      .references(() => batches.id, { onDelete: 'cascade' })
      .notNull(),
    templateItemId: integer('template_item_id').references(() => healthScheduleItems.id, { onDelete: 'set null' }),
    dueDate: date('due_date').notNull(),
    dayOfAge: integer('day_of_age').notNull(),
    taskType: varchar('task_type', { length: 20 }).notNull(),
    name: varchar('name', { length: 150 }).notNull(),
    method: varchar('method', { length: 30 }),
    inventoryItemId: integer('inventory_item_id').references(() => feedInventory.id),
    plannedQuantity: decimal('planned_quantity', { precision: 10, scale: 3 }),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    completedDate: date('completed_date'),
    completedBy: integer('completed_by').references(() => users.id),
    vaccinationId: integer('vaccination_id').references(() => vaccinations.id),
    skipReason: text('skip_reason'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_batch_health_tasks_batch_due').on(table.batchId, table.dueDate),
    index('idx_batch_health_tasks_status_due').on(table.status, table.dueDate),
  ],
);

// ─── Vet visits ──────────────────────────────────────────────────────────────

export const vetVisits = pgTable(
  'vet_visits',
  {
    id: serial('id').primaryKey(),
    siteId: integer('site_id')
      .references(() => sites.id)
      .notNull(),
    batchId: integer('batch_id').references(() => batches.id),
    visitDate: date('visit_date').notNull(),
    vetName: varchar('vet_name', { length: 150 }).notNull(),
    reason: varchar('reason', { length: 200 }),
    findings: text('findings'),
    diagnosis: text('diagnosis'),
    treatment: text('treatment'),
    feeAmount: decimal('fee_amount', { precision: 12, scale: 2 }),
    followUpDate: date('follow_up_date'),
    recordedBy: integer('recorded_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_vet_visits_batch').on(table.batchId),
    index('idx_vet_visits_site_date').on(table.siteId, table.visitDate),
  ],
);

// ─── Growth standards: target weight, feed and mortality by day of age ───────

export const growthStandards = pgTable('growth_standards', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 150 }).unique().notNull(),
  breed: varchar('breed', { length: 100 }),
  notes: text('notes'),
  isDefault: boolean('is_default').default(false).notNull(),
  status: varchar('status', { length: 20 }).default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const growthStandardPoints = pgTable(
  'growth_standard_points',
  {
    id: serial('id').primaryKey(),
    standardId: integer('standard_id')
      .references(() => growthStandards.id, { onDelete: 'cascade' })
      .notNull(),
    dayOfAge: integer('day_of_age').notNull(),
    targetWeightG: integer('target_weight_g').notNull(),
    /** Cumulative feed eaten per bird by this day, grams */
    targetCumFeedG: integer('target_cum_feed_g'),
    /** Cumulative mortality by this day, % */
    targetCumMortalityPct: decimal('target_cum_mortality_pct', { precision: 5, scale: 2 }),
  },
  (table) => [unique('uq_growth_standard_day').on(table.standardId, table.dayOfAge)],
);

// ─── House turnaround between batches ────────────────────────────────────────

export const houseTurnarounds = pgTable(
  'house_turnarounds',
  {
    id: serial('id').primaryKey(),
    cageId: integer('cage_id')
      .references(() => cages.id)
      .notNull(),
    previousBatchId: integer('previous_batch_id').references(() => batches.id),
    startedDate: date('started_date').notNull(),
    litterRemovedDate: date('litter_removed_date'),
    cleanedDate: date('cleaned_date'),
    disinfectedDate: date('disinfected_date'),
    newLitterDate: date('new_litter_date'),
    readyDate: date('ready_date'),
    status: varchar('status', { length: 20 }).default('in_progress').notNull(),
    notes: text('notes'),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('idx_house_turnarounds_cage').on(table.cageId, table.status),
    index('idx_house_turnarounds_previous_batch_id').on(table.previousBatchId),
  ],
);
