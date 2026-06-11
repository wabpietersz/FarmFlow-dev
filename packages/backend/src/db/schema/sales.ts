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
import { financeAccounts, treasuryTransactions } from './treasury';

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

export const saleLorries = pgTable(
  'sale_lorries',
  {
    id: serial('id').primaryKey(),
    saleId: integer('sale_id')
      .references(() => sales.id)
      .notNull(),
    lineSequence: integer('line_sequence').notNull(),
    lorryNumber: varchar('lorry_number', { length: 100 }).notNull(),
    birdsCount: integer('birds_count').notNull(),
    previousWeight: decimal('previous_weight', { precision: 10, scale: 2 }).notNull(),
    loadedWeight: decimal('loaded_weight', { precision: 10, scale: 2 }).notNull(),
    netWeight: decimal('net_weight', { precision: 10, scale: 2 }).notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_sale_lorries_sale_id').on(table.saleId),
  ],
);

export const buyerReceipts = pgTable(
  'buyer_receipts',
  {
    id: serial('id').primaryKey(),
    receiptCode: varchar('receipt_code', { length: 50 }).unique().notNull(),
    buyerId: integer('buyer_id')
      .references(() => buyers.id)
      .notNull(),
    receiptDate: date('receipt_date').notNull(),
    notes: text('notes'),
    recordedBy: integer('recorded_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_buyer_receipts_buyer_id').on(table.buyerId),
    index('idx_buyer_receipts_receipt_date').on(table.receiptDate),
  ],
);

export const buyerReceiptLines = pgTable(
  'buyer_receipt_lines',
  {
    id: serial('id').primaryKey(),
    receiptId: integer('receipt_id')
      .references(() => buyerReceipts.id)
      .notNull(),
    lineSequence: integer('line_sequence').notNull(),
    paymentAmount: decimal('payment_amount', { precision: 12, scale: 2 }).notNull(),
    paymentMethod: varchar('payment_method', { length: 50 }).notNull(),
    referenceNumber: varchar('reference_number', { length: 100 }),
    chequeNumber: varchar('cheque_number', { length: 50 }),
    chequeDate: date('cheque_date'),
    bankName: varchar('bank_name', { length: 100 }),
    paymentStatus: varchar('payment_status', { length: 50 }).default('completed').notNull(),
    financeAccountId: integer('finance_account_id').references(() => financeAccounts.id),
    treasuryTransactionId: integer('treasury_transaction_id').references(() => treasuryTransactions.id),
    treasuryReversalTransactionId: integer('treasury_reversal_transaction_id').references(() => treasuryTransactions.id),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_buyer_receipt_lines_receipt_id').on(table.receiptId),
    index('idx_buyer_receipt_lines_payment_status').on(table.paymentStatus),
  ],
);

export const buyerReceiptAllocations = pgTable(
  'buyer_receipt_allocations',
  {
    id: serial('id').primaryKey(),
    receiptLineId: integer('receipt_line_id')
      .references(() => buyerReceiptLines.id)
      .notNull(),
    saleId: integer('sale_id')
      .references(() => sales.id)
      .notNull(),
    allocatedAmount: decimal('allocated_amount', { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_buyer_receipt_allocations_line_id').on(table.receiptLineId),
    index('idx_buyer_receipt_allocations_sale_id').on(table.saleId),
  ],
);
