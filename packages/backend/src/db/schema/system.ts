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
