import {
  pgTable,
  serial,
  varchar,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sites } from './sites';

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    firebaseUid: varchar('firebase_uid', { length: 128 }).unique().notNull(),
    email: varchar('email', { length: 255 }).unique().notNull(),
    firstName: varchar('first_name', { length: 120 }).notNull().default(''),
    lastName: varchar('last_name', { length: 120 }).notNull().default(''),
    /** Always "first last"; kept so names show everywhere without joins changing */
    fullName: varchar('full_name', { length: 255 }).notNull(),
    userRole: varchar('user_role', { length: 50 }).notNull(),
    siteId: integer('site_id').references(() => sites.id),
    isActive: boolean('is_active').default(true).notNull(),
    lastLogin: timestamp('last_login'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_users_firebase_uid').on(table.firebaseUid),
    index('idx_users_email').on(table.email),
    index('idx_users_user_role').on(table.userRole),
    index('idx_users_site_id').on(table.siteId),
  ],
);
