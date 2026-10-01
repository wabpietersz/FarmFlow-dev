import {
  pgTable,
  serial,
  varchar,
  integer,
  boolean,
  decimal,
  text,
  timestamp,
  jsonb,
  index,
  unique,
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
    title: varchar('title', { length: 200 }),
    message: text('message').notNull(),
    /** Where clicking takes you */
    link: varchar('link', { length: 300 }),
    /** info | warning | danger */
    tone: varchar('tone', { length: 20 }).default('info').notNull(),
    /** One notification per user per thing (e.g. "health-task:42") */
    dedupeKey: varchar('dedupe_key', { length: 120 }),
    isRead: boolean('is_read').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    readAt: timestamp('read_at'),
  },
  (table) => [
    index('idx_notifications_user_id').on(table.userId),
    index('idx_notifications_is_read').on(table.isRead),
    unique('uq_notifications_user_dedupe').on(table.userId, table.dedupeKey),
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

// What each role may do in each module: none, user (day-to-day) or admin (full control).
export const roleModuleAccess = pgTable(
  'role_module_access',
  {
    id: serial('id').primaryKey(),
    role: varchar('role', { length: 50 }).notNull(),
    moduleKey: varchar('module_key', { length: 50 }).notNull(),
    level: varchar('level', { length: 10 }).notNull(),
    updatedBy: integer('updated_by').references(() => users.id),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [unique('uq_role_module').on(table.role, table.moduleKey)],
);

/** Something waiting for a manager's yes/no because it is over an approval limit. */
export const approvalRequests = pgTable(
  'approval_requests',
  {
    id: serial('id').primaryKey(),
    /** purchase_order | money_out */
    entityType: varchar('entity_type', { length: 40 }).notNull(),
    entityId: integer('entity_id').notNull(),
    amount: decimal('amount', { precision: 14, scale: 2 }).notNull(),
    summary: text('summary').notNull(),
    /** pending | approved | rejected */
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    requestedBy: integer('requested_by').references(() => users.id).notNull(),
    decidedBy: integer('decided_by').references(() => users.id),
    decidedAt: timestamp('decided_at'),
    decisionNote: text('decision_note'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_approval_requests_status').on(table.status), index('idx_approval_requests_entity').on(table.entityType, table.entityId)],
);
