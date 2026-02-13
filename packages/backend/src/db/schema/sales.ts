import {
  pgTable,
  serial,
  varchar,
  integer,
  decimal,
  date,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { batches } from './batches';
import { users } from './users';

export const buyers = pgTable('buyers', {
  id: serial('id').primaryKey(),
  buyerName: varchar('buyer_name', { length: 100 }).unique().notNull(),
  contactPerson: varchar('contact_person', { length: 100 }),
  phoneNumber: varchar('phone_number', { length: 20 }),
  email: varchar('email', { length: 100 }),
  address: text('address'),
  creditTerms: integer('credit_terms').default(0),
  status: varchar('status', { length: 50 }).default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const sales = pgTable(
  'sales',
  {
    id: serial('id').primaryKey(),
    saleCode: varchar('sale_code', { length: 50 }).unique().notNull(),
    batchId: integer('batch_id')
      .references(() => batches.id)
      .notNull(),
    buyerId: integer('buyer_id')
      .references(() => buyers.id)
      .notNull(),
    saleDate: date('sale_date').notNull(),
    totalBirds: integer('total_birds').notNull(),
    totalWeight: decimal('total_weight', { precision: 10, scale: 2 }).notNull(),
    pricePerKg: decimal('price_per_kg', { precision: 10, scale: 2 }).notNull(),
    totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
    status: varchar('status', { length: 50 }).default('pending').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_sales_batch_id').on(table.batchId),
    index('idx_sales_buyer_id').on(table.buyerId),
    index('idx_sales_sale_date').on(table.saleDate),
  ],
);

export const payments = pgTable(
  'payments',
  {
    id: serial('id').primaryKey(),
    saleId: integer('sale_id')
      .references(() => sales.id)
      .notNull(),
    paymentAmount: decimal('payment_amount', { precision: 12, scale: 2 }).notNull(),
    paymentDate: date('payment_date').notNull(),
    paymentMethod: varchar('payment_method', { length: 50 }).notNull(),
    chequeNumber: varchar('cheque_number', { length: 50 }),
    chequeDate: date('cheque_date'),
    bankName: varchar('bank_name', { length: 100 }),
    paymentStatus: varchar('payment_status', { length: 50 }).default('completed').notNull(),
    notes: text('notes'),
    recordedBy: integer('recorded_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_payments_sale_id').on(table.saleId),
    index('idx_payments_payment_status').on(table.paymentStatus),
  ],
);
