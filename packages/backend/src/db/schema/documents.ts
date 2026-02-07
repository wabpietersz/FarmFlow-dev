import { pgTable, serial, varchar, integer, timestamp, index, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users';

export const documents = pgTable(
  'documents',
  {
    id: serial('id').primaryKey(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: integer('entity_id').notNull(),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    fileUrl: varchar('file_url', { length: 512 }).notNull(),
    fileType: varchar('file_type', { length: 50 }).notNull(),
    fileSize: integer('file_size').notNull(),
    uploadedBy: integer('uploaded_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_documents_entity').on(table.entityType, table.entityId)],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id),
    action: varchar('action', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 50 }),
    entityId: integer('entity_id'),
    changes: jsonb('changes'),
    ipAddress: varchar('ip_address', { length: 50 }),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
  },
  (table) => [
    index('idx_audit_logs_user_id').on(table.userId),
    index('idx_audit_logs_timestamp').on(table.timestamp),
  ],
);
