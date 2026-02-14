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
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { batches } from './batches';
import { users } from './users';

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
  version: integer('version').default(1).notNull(),
  parentRecipeId: integer('parent_recipe_id'),
  targetProtein: decimal('target_protein', { precision: 5, scale: 2 }),
  targetEnergy: decimal('target_energy', { precision: 8, scale: 2 }),
  targetFiber: decimal('target_fiber', { precision: 5, scale: 2 }),
  targetCalcium: decimal('target_calcium', { precision: 5, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const feedRecipeIngredients = pgTable('feed_recipe_ingredients', {
  id: serial('id').primaryKey(),
  recipeId: integer('recipe_id')
    .references(() => feedRecipes.id, { onDelete: 'cascade' })
    .notNull(),
  inventoryItemId: integer('inventory_item_id').references(() => feedInventory.id),
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

// --- Feed Production ---

export const feedProductionBatches = pgTable(
  'feed_production_batches',
  {
    id: serial('id').primaryKey(),
    productionCode: varchar('production_code', { length: 50 }).unique().notNull(),
    recipeId: integer('recipe_id')
      .references(() => feedRecipes.id)
      .notNull(),
    plannedQuantity: decimal('planned_quantity', { precision: 10, scale: 2 }).notNull(),
    actualQuantity: decimal('actual_quantity', { precision: 10, scale: 2 }),
    unit: varchar('unit', { length: 20 }).default('kg').notNull(),
    status: varchar('status', { length: 50 }).default('planned').notNull(),
    productionDate: date('production_date').notNull(),
    productionCost: decimal('production_cost', { precision: 12, scale: 2 }),
    notes: text('notes'),
    scheduledDate: date('scheduled_date'),
    wasteQuantity: decimal('waste_quantity', { precision: 10, scale: 2 }),
    wasteReason: text('waste_reason'),
    qcPassedAt: timestamp('qc_passed_at'),
    qcPassedBy: integer('qc_passed_by').references(() => users.id),
    qcNotes: text('qc_notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_feed_prod_status').on(table.status),
    index('idx_feed_prod_date').on(table.productionDate),
    index('idx_feed_prod_recipe').on(table.recipeId),
  ],
);

export const feedProductionMaterials = pgTable('feed_production_materials', {
  id: serial('id').primaryKey(),
  productionBatchId: integer('production_batch_id')
    .references(() => feedProductionBatches.id, { onDelete: 'cascade' })
    .notNull(),
  inventoryItemId: integer('inventory_item_id')
    .references(() => feedInventory.id)
    .notNull(),
  plannedQuantity: decimal('planned_quantity', { precision: 10, scale: 2 }).notNull(),
  actualQuantity: decimal('actual_quantity', { precision: 10, scale: 2 }),
  actualCost: decimal('actual_cost', { precision: 12, scale: 2 }),
  weightedCostPerUnit: decimal('weighted_cost_per_unit', { precision: 10, scale: 2 }),
  unit: varchar('unit', { length: 20 }).notNull(),
});

// --- Feed Distribution ---

export const feedDistributions = pgTable(
  'feed_distributions',
  {
    id: serial('id').primaryKey(),
    productionBatchId: integer('production_batch_id').references(
      () => feedProductionBatches.id,
    ),
    farmBatchId: integer('farm_batch_id')
      .references(() => batches.id)
      .notNull(),
    feedType: varchar('feed_type', { length: 50 }).notNull(),
    quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull(),
    unit: varchar('unit', { length: 20 }).default('kg').notNull(),
    distributionDate: date('distribution_date').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_feed_dist_farm_batch').on(table.farmBatchId),
    index('idx_feed_dist_date').on(table.distributionDate),
  ],
);

// --- Inventory Audit Trail ---

export const inventoryAuditTrail = pgTable(
  'inventory_audit_trail',
  {
    id: serial('id').primaryKey(),
    inventoryItemId: integer('inventory_item_id')
      .references(() => feedInventory.id)
      .notNull(),
    changeType: varchar('change_type', { length: 50 }).notNull(), // restock, production_deduction, adjustment, distribution
    previousQuantity: decimal('previous_quantity', { precision: 10, scale: 2 }).notNull(),
    changeQuantity: decimal('change_quantity', { precision: 10, scale: 2 }).notNull(),
    newQuantity: decimal('new_quantity', { precision: 10, scale: 2 }).notNull(),
    referenceId: integer('reference_id'),
    referenceType: varchar('reference_type', { length: 50 }),
    notes: text('notes'),
    lotId: integer('lot_id'),
    costAtTime: decimal('cost_at_time', { precision: 10, scale: 2 }),
    performedBy: integer('performed_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_inv_audit_item').on(table.inventoryItemId),
    index('idx_inv_audit_date').on(table.createdAt),
  ],
);

// --- Inventory Alerts ---

export const inventoryAlerts = pgTable(
  'inventory_alerts',
  {
    id: serial('id').primaryKey(),
    inventoryItemId: integer('inventory_item_id')
      .references(() => feedInventory.id)
      .notNull(),
    alertType: varchar('alert_type', { length: 50 }).default('low_stock').notNull(),
    currentQuantity: decimal('current_quantity', { precision: 10, scale: 2 }).notNull(),
    reorderLevel: decimal('reorder_level', { precision: 10, scale: 2 }).notNull(),
    suggestedOrderQuantity: decimal('suggested_order_quantity', { precision: 10, scale: 2 }).notNull(),
    status: varchar('status', { length: 50 }).default('active').notNull(),
    acknowledgedBy: integer('acknowledged_by').references(() => users.id),
    acknowledgedAt: timestamp('acknowledged_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_inv_alerts_item').on(table.inventoryItemId),
    index('idx_inv_alerts_status').on(table.status),
  ],
);

// --- Purchase Orders ---

export const purchaseOrders = pgTable(
  'purchase_orders',
  {
    id: serial('id').primaryKey(),
    orderCode: varchar('order_code', { length: 50 }).unique().notNull(),
    supplierId: integer('supplier_id')
      .references(() => suppliers.id)
      .notNull(),
    orderDate: date('order_date').notNull(),
    expectedDeliveryDate: date('expected_delivery_date'),
    actualDeliveryDate: date('actual_delivery_date'),
    status: varchar('status', { length: 50 }).default('draft').notNull(),
    totalCost: decimal('total_cost', { precision: 12, scale: 2 }).default('0').notNull(),
    notes: text('notes'),
    createdBy: integer('created_by')
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_po_status').on(table.status),
    index('idx_po_supplier').on(table.supplierId),
    index('idx_po_order_date').on(table.orderDate),
  ],
);

export const purchaseOrderItems = pgTable(
  'purchase_order_items',
  {
    id: serial('id').primaryKey(),
    purchaseOrderId: integer('purchase_order_id')
      .references(() => purchaseOrders.id, { onDelete: 'cascade' })
      .notNull(),
    inventoryItemId: integer('inventory_item_id')
      .references(() => feedInventory.id)
      .notNull(),
    orderedQuantity: decimal('ordered_quantity', { precision: 10, scale: 2 }).notNull(),
    unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
    receivedQuantity: decimal('received_quantity', { precision: 10, scale: 2 }).default('0').notNull(),
    unit: varchar('unit', { length: 20 }).notNull(),
    notes: text('notes'),
  },
  (table) => [
    index('idx_poi_order').on(table.purchaseOrderId),
    index('idx_poi_inventory').on(table.inventoryItemId),
  ],
);

// --- Inventory Lots (FIFO Cost Tracking) ---

export const inventoryLots = pgTable(
  'inventory_lots',
  {
    id: serial('id').primaryKey(),
    inventoryItemId: integer('inventory_item_id')
      .references(() => feedInventory.id)
      .notNull(),
    purchaseOrderItemId: integer('purchase_order_item_id').references(() => purchaseOrderItems.id),
    lotCode: varchar('lot_code', { length: 50 }).unique().notNull(),
    receivedQuantity: decimal('received_quantity', { precision: 10, scale: 2 }).notNull(),
    remainingQuantity: decimal('remaining_quantity', { precision: 10, scale: 2 }).notNull(),
    costPerUnit: decimal('cost_per_unit', { precision: 10, scale: 2 }).notNull(),
    receivedDate: date('received_date').notNull(),
    expiryDate: date('expiry_date'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_lots_inventory_item').on(table.inventoryItemId),
    index('idx_lots_remaining').on(table.remainingQuantity),
    index('idx_lots_received_date').on(table.receivedDate),
  ],
);

// --- Production Material Lots (FIFO Consumption Tracking) ---

export const productionMaterialLots = pgTable(
  'production_material_lots',
  {
    id: serial('id').primaryKey(),
    productionMaterialId: integer('production_material_id')
      .references(() => feedProductionMaterials.id, { onDelete: 'cascade' })
      .notNull(),
    inventoryLotId: integer('inventory_lot_id')
      .references(() => inventoryLots.id)
      .notNull(),
    quantityUsed: decimal('quantity_used', { precision: 10, scale: 2 }).notNull(),
    costPerUnit: decimal('cost_per_unit', { precision: 10, scale: 2 }).notNull(),
    lineCost: decimal('line_cost', { precision: 12, scale: 2 }).notNull(),
  },
  (table) => [
    index('idx_pml_material').on(table.productionMaterialId),
    index('idx_pml_lot').on(table.inventoryLotId),
  ],
);

// --- Report Schedules ---

export const reportSchedules = pgTable(
  'report_schedules',
  {
    id: serial('id').primaryKey(),
    reportType: varchar('report_type', { length: 50 }).notNull(),
    scheduleName: varchar('schedule_name', { length: 100 }).notNull(),
    cronExpression: varchar('cron_expression', { length: 50 }).notNull(),
    filters: jsonb('filters').default({}).notNull(),
    recipientEmails: jsonb('recipient_emails').default([]).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    lastRunAt: timestamp('last_run_at'),
    nextRunAt: timestamp('next_run_at'),
    createdBy: integer('created_by')
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_report_sched_type').on(table.reportType),
    index('idx_report_sched_active').on(table.isActive),
  ],
);
