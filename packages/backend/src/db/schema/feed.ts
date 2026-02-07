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

export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  supplierName: varchar('supplier_name', { length: 100 }).unique().notNull(),
  contactPerson: varchar('contact_person', { length: 100 }),
  phoneNumber: varchar('phone_number', { length: 20 }),
  email: varchar('email', { length: 100 }),
  address: text('address'),
  status: varchar('status', { length: 50 }).default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const feedRecipes = pgTable('feed_recipes', {
  id: serial('id').primaryKey(),
  recipeName: varchar('recipe_name', { length: 100 }).unique().notNull(),
  feedType: varchar('feed_type', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).default('active'),
  cost: decimal('cost', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const feedRecipeIngredients = pgTable('feed_recipe_ingredients', {
  id: serial('id').primaryKey(),
  recipeId: integer('recipe_id')
    .references(() => feedRecipes.id, { onDelete: 'cascade' })
    .notNull(),
  supplierId: integer('supplier_id').references(() => suppliers.id),
  ingredientName: varchar('ingredient_name', { length: 100 }).notNull(),
  proportion: decimal('proportion', { precision: 5, scale: 2 }).notNull(),
  unit: varchar('unit', { length: 20 }).notNull(),
});

export const feedInventory = pgTable(
  'feed_inventory',
  {
    id: serial('id').primaryKey(),
    ingredientName: varchar('ingredient_name', { length: 100 }).notNull(),
    supplierId: integer('supplier_id').references(() => suppliers.id),
    quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull(),
    unit: varchar('unit', { length: 20 }).notNull(),
    costPerUnit: decimal('cost_per_unit', { precision: 10, scale: 2 }).notNull(),
    reorderLevel: decimal('reorder_level', { precision: 10, scale: 2 }),
    lastRestockDate: date('last_restock_date'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('idx_feed_inventory_ingredient').on(table.ingredientName)],
);
