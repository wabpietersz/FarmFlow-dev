import {
  pgTable,
  serial,
  varchar,
  integer,
  boolean,
  text,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const systemConfig = pgTable('system_config', {
  id: serial('id').primaryKey(),
  configKey: varchar('config_key', { length: 100 }).unique().notNull(),
  configValue: jsonb('config_value').notNull(),
  description: text('description'),
  updatedBy: integer('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id)
      .notNull(),
    notificationType: varchar('notification_type', { length: 50 }).notNull(),
    entityType: varchar('entity_type', { length: 50 }),
    entityId: integer('entity_id'),
    message: text('message').notNull(),
    isRead: boolean('is_read').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    readAt: timestamp('read_at'),
  },
  (table) => [
    index('idx_notifications_user_id').on(table.userId),
    index('idx_notifications_is_read').on(table.isRead),
  ],
);

export const periodLocks = pgTable(
  'period_locks',
  {
    id: serial('id').primaryKey(),
    lockCode: varchar('lock_code', { length: 50 }).unique().notNull(),
    periodStart: varchar('period_start', { length: 10 }).notNull(),
    periodEnd: varchar('period_end', { length: 10 }).notNull(),
    scope: varchar('scope', { length: 50 }).default('all').notNull(),
    status: varchar('status', { length: 50 }).default('active').notNull(),
    notes: text('notes'),
    createdBy: integer('created_by').references(() => users.id).notNull(),
    releasedBy: integer('released_by').references(() => users.id),
    releasedAt: timestamp('released_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_period_locks_period').on(table.periodStart, table.periodEnd),
    index('idx_period_locks_scope').on(table.scope),
    index('idx_period_locks_status').on(table.status),
  ],
);
