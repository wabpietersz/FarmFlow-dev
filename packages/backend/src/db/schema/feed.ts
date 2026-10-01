import { sql } from 'drizzle-orm';
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
import { sites } from './sites';
import { chequeLeaves, financeAccounts, treasuryTransactions } from './treasury';
import { costCentres, financeCategories } from './finance';

export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  supplierName: varchar('supplier_name', { length: 100 }).unique().notNull(),
  contactPerson: varchar('contact_person', { length: 100 }),
  phoneNumber: varchar('phone_number', { length: 20 }),
  email: varchar('email', { length: 100 }),
  address: text('address'),
  defaultCategoryId: integer('default_category_id').references(() => financeCategories.id),
  status: varchar('status', { length: 50 }).default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const inventoryItemTypes = pgTable(
  'inventory_item_types',
  {
    id: serial('id').primaryKey(),
    typeCode: varchar('type_code', { length: 50 }).unique().notNull(),
    typeName: varchar('type_name', { length: 100 }).unique().notNull(),
    category: varchar('category', { length: 50 }).notNull(),
    defaultUnit: varchar('default_unit', { length: 20 }).notNull(),
    allowsBatchAllocation: boolean('allows_batch_allocation').default(false).notNull(),
    isFeed: boolean('is_feed').default(false).notNull(),
    financeCategoryId: integer('finance_category_id').references(() => financeCategories.id),
    status: varchar('status', { length: 50 }).default('active').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_inventory_item_types_code').on(table.typeCode),
    index('idx_inventory_item_types_category').on(table.category),
    index('idx_inventory_item_types_feed').on(table.isFeed),
  ],
);

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
    itemTypeId: integer('item_type_id')
      .references(() => inventoryItemTypes.id)
      .notNull(),
    itemCode: varchar('item_code', { length: 50 }),
    ingredientName: varchar('ingredient_name', { length: 100 }).notNull(),
    description: text('description'),
    supplierId: integer('supplier_id').references(() => suppliers.id),
    quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull(),
    unit: varchar('unit', { length: 20 }).notNull(),
    costPerUnit: decimal('cost_per_unit', { precision: 10, scale: 2 }).notNull(),
    reorderLevel: decimal('reorder_level', { precision: 10, scale: 2 }),
    lastRestockDate: date('last_restock_date'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_feed_inventory_ingredient').on(table.ingredientName),
    index('idx_feed_inventory_item_type').on(table.itemTypeId),
    index('idx_feed_inventory_item_code').on(table.itemCode),
  ],
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
    contractId: integer('contract_id').references(() => supplierContracts.id),
    costCentreId: integer('cost_centre_id').references(() => costCentres.id),
    /** Store the goods are delivered into */
    deliveryLocationId: integer('delivery_location_id').references(() => stockLocations.id),
    requisitionId: integer('requisition_id'),
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

export const supplierContracts = pgTable(
  'supplier_contracts',
  {
    id: serial('id').primaryKey(),
    contractCode: varchar('contract_code', { length: 50 }).unique().notNull(),
    supplierId: integer('supplier_id').references(() => suppliers.id).notNull(),
    contractType: varchar('contract_type', { length: 50 }).default('supplier').notNull(),
    contractTitle: varchar('contract_title', { length: 200 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 50 }).default('draft').notNull(),
    validFrom: date('valid_from').notNull(),
    validTo: date('valid_to'),
    currencyCode: varchar('currency_code', { length: 10 }).default('LKR').notNull(),
    paymentTermsDays: integer('payment_terms_days').default(0).notNull(),
    commercialTerms: text('commercial_terms'),
    rateTable: jsonb('rate_table').default({}).notNull(),
    attachmentUrls: jsonb('attachment_urls').default([]).notNull(),
    alertDaysBeforeExpiry: integer('alert_days_before_expiry').default(30).notNull(),
    createdBy: integer('created_by').references(() => users.id).notNull(),
    approvedBy: integer('approved_by').references(() => users.id),
    approvedAt: timestamp('approved_at'),
    approvalNotes: text('approval_notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_supplier_contracts_supplier').on(table.supplierId),
    index('idx_supplier_contracts_status').on(table.status),
    index('idx_supplier_contracts_validity').on(table.validFrom, table.validTo),
  ],
);

export const supplierContractTerms = pgTable(
  'supplier_contract_terms',
  {
    id: serial('id').primaryKey(),
    contractId: integer('contract_id')
      .references(() => supplierContracts.id, { onDelete: 'cascade' })
      .notNull(),
    termType: varchar('term_type', { length: 50 }).notNull(),
    termKey: varchar('term_key', { length: 100 }).notNull(),
    termValue: text('term_value').notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_supplier_contract_terms_contract').on(table.contractId),
    index('idx_supplier_contract_terms_type').on(table.termType),
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

export const supplierInvoices = pgTable(
  'supplier_invoices',
  {
    id: serial('id').primaryKey(),
    invoiceCode: varchar('invoice_code', { length: 50 }).unique().notNull(),
    supplierId: integer('supplier_id')
      .references(() => suppliers.id)
      .notNull(),
    purchaseOrderId: integer('purchase_order_id').references(() => purchaseOrders.id),
    contractId: integer('contract_id').references(() => supplierContracts.id),
    invoiceReference: varchar('invoice_reference', { length: 100 }).notNull(),
    invoiceDate: date('invoice_date').notNull(),
    dueDate: date('due_date').notNull(),
    invoiceAmount: decimal('invoice_amount', { precision: 12, scale: 2 }).notNull(),
    currencyCode: varchar('currency_code', { length: 10 }).default('LKR').notNull(),
    /** Invoice vs goods received on its PO: matched | over_billed | under_billed | no_po */
    matchStatus: varchar('match_status', { length: 20 }),
    receivedValue: decimal('received_value', { precision: 12, scale: 2 }),
    matchVariance: decimal('match_variance', { precision: 12, scale: 2 }),
    overrideNote: text('override_note'),
    status: varchar('status', { length: 50 }).default('recorded').notNull(),
    approvedBy: integer('approved_by').references(() => users.id),
    approvedAt: timestamp('approved_at'),
    approvalNotes: text('approval_notes'),
    notes: text('notes'),
    createdBy: integer('created_by').references(() => users.id).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_supplier_invoices_supplier').on(table.supplierId),
    index('idx_supplier_invoices_po').on(table.purchaseOrderId),
    index('idx_supplier_invoices_contract').on(table.contractId),
    index('idx_supplier_invoices_due_date').on(table.dueDate),
    index('idx_supplier_invoices_status').on(table.status),
  ],
);

export const supplierPayments = pgTable(
  'supplier_payments',
  {
    id: serial('id').primaryKey(),
    paymentCode: varchar('payment_code', { length: 50 }).unique().notNull(),
    supplierId: integer('supplier_id')
      .references(() => suppliers.id)
      .notNull(),
    purchaseOrderId: integer('purchase_order_id').references(() => purchaseOrders.id),
    paymentDate: date('payment_date').notNull(),
    financeAccountId: integer('finance_account_id')
      .references(() => financeAccounts.id)
      .notNull(),
    paymentMethod: varchar('payment_method', { length: 50 }).notNull(),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    paymentStatus: varchar('payment_status', { length: 50 }).default('completed').notNull(),
    referenceNumber: varchar('reference_number', { length: 100 }),
    chequeLeafId: integer('cheque_leaf_id').references(() => chequeLeaves.id),
    chequeNumber: varchar('cheque_number', { length: 50 }),
    chequeDate: date('cheque_date'),
    bankName: varchar('bank_name', { length: 100 }),
    treasuryTransactionId: integer('treasury_transaction_id').references(() => treasuryTransactions.id),
    treasuryReversalTransactionId: integer('treasury_reversal_transaction_id').references(() => treasuryTransactions.id),
    notes: text('notes'),
    recordedBy: integer('recorded_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_supplier_payments_supplier').on(table.supplierId),
    index('idx_supplier_payments_po').on(table.purchaseOrderId),
    index('idx_supplier_payments_status').on(table.paymentStatus),
    index('idx_supplier_payments_date').on(table.paymentDate),
  ],
);

export const supplierPaymentAllocations = pgTable(
  'supplier_payment_allocations',
  {
    id: serial('id').primaryKey(),
    supplierPaymentId: integer('supplier_payment_id')
      .references(() => supplierPayments.id, { onDelete: 'cascade' })
      .notNull(),
    supplierInvoiceId: integer('supplier_invoice_id')
      .references(() => supplierInvoices.id, { onDelete: 'cascade' })
      .notNull(),
    allocatedAmount: decimal('allocated_amount', { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_supplier_payment_allocations_payment').on(table.supplierPaymentId),
    index('idx_supplier_payment_allocations_invoice').on(table.supplierInvoiceId),
  ],
);

export const chickPlacements = pgTable(
  'chick_placements',
  {
    id: serial('id').primaryKey(),
    batchId: integer('batch_id')
      .references(() => batches.id, { onDelete: 'cascade' })
      .notNull(),
    supplierId: integer('supplier_id').references(() => suppliers.id),
    contractId: integer('contract_id').references(() => supplierContracts.id),
    placementDate: date('placement_date').notNull(),
    invoiceReference: varchar('invoice_reference', { length: 100 }),
    deliveredQuantity: integer('delivered_quantity').notNull(),
    mortalityOnArrival: integer('mortality_on_arrival').default(0).notNull(),
    acceptedQuantity: integer('accepted_quantity').notNull(),
    unitCost: decimal('unit_cost', { precision: 12, scale: 2 }).notNull(),
    batchOpeningCost: decimal('batch_opening_cost', { precision: 14, scale: 2 }).notNull(),
    notes: text('notes'),
    createdBy: integer('created_by').references(() => users.id).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_chick_placements_batch').on(table.batchId),
    index('idx_chick_placements_supplier').on(table.supplierId),
    index('idx_chick_placements_contract').on(table.contractId),
    index('idx_chick_placements_date').on(table.placementDate),
  ],
);

export const siteInventoryConsumptions = pgTable(
  'site_inventory_consumptions',
  {
    id: serial('id').primaryKey(),
    siteId: integer('site_id')
      .references(() => sites.id, { onDelete: 'cascade' })
      .notNull(),
    inventoryItemId: integer('inventory_item_id')
      .references(() => feedInventory.id)
      .notNull(),
    inventoryLotId: integer('inventory_lot_id').references(() => inventoryLots.id),
    purchaseOrderItemId: integer('purchase_order_item_id').references(() => purchaseOrderItems.id),
    quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull(),
    unit: varchar('unit', { length: 20 }).notNull(),
    unitCost: decimal('unit_cost', { precision: 10, scale: 2 }).notNull(),
    lineCost: decimal('line_cost', { precision: 12, scale: 2 }).notNull(),
    consumptionDate: date('consumption_date').notNull(),
    referenceType: varchar('reference_type', { length: 50 }),
    referenceId: integer('reference_id'),
    notes: text('notes'),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_site_inventory_consumptions_site').on(table.siteId),
    index('idx_site_inventory_consumptions_item').on(table.inventoryItemId),
    index('idx_site_inventory_consumptions_lot').on(table.inventoryLotId),
    index('idx_site_inventory_consumptions_date').on(table.consumptionDate),
  ],
);

export const serviceWorkOrders = pgTable(
  'service_work_orders',
  {
    id: serial('id').primaryKey(),
    workOrderCode: varchar('work_order_code', { length: 50 }).unique().notNull(),
    serviceType: varchar('service_type', { length: 50 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    supplierId: integer('supplier_id').references(() => suppliers.id),
    contractId: integer('contract_id').references(() => supplierContracts.id),
    allocationType: varchar('allocation_type', { length: 50 }).default('shared_overhead').notNull(),
    categoryId: integer('category_id').references(() => financeCategories.id),
    costCentreId: integer('cost_centre_id').references(() => costCentres.id),
    siteId: integer('site_id').references(() => sites.id),
    batchId: integer('batch_id').references(() => batches.id),
    serviceDate: date('service_date').notNull(),
    invoiceReference: varchar('invoice_reference', { length: 100 }),
    quantity: decimal('quantity', { precision: 10, scale: 2 }),
    unit: varchar('unit', { length: 20 }),
    unitRate: decimal('unit_rate', { precision: 12, scale: 2 }),
    totalAmount: decimal('total_amount', { precision: 14, scale: 2 }).notNull(),
    status: varchar('status', { length: 50 }).default('pending_approval').notNull(),
    approvalNotes: text('approval_notes'),
    approvedBy: integer('approved_by').references(() => users.id),
    approvedAt: timestamp('approved_at'),
    financeAccountId: integer('finance_account_id').references(() => financeAccounts.id),
    paymentMethod: varchar('payment_method', { length: 50 }),
    referenceNumber: varchar('reference_number', { length: 100 }),
    chequeLeafId: integer('cheque_leaf_id').references(() => chequeLeaves.id),
    chequeNumber: varchar('cheque_number', { length: 50 }),
    supplierPaymentId: integer('supplier_payment_id').references(() => supplierPayments.id),
    treasuryTransactionId: integer('treasury_transaction_id').references(() => treasuryTransactions.id),
    treasuryReversalTransactionId: integer('treasury_reversal_transaction_id').references(() => treasuryTransactions.id),
    requestedBy: integer('requested_by').references(() => users.id).notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_service_work_orders_type').on(table.serviceType),
    index('idx_service_work_orders_status').on(table.status),
    index('idx_service_work_orders_supplier').on(table.supplierId),
    index('idx_service_work_orders_contract').on(table.contractId),
    index('idx_service_work_orders_site').on(table.siteId),
    index('idx_service_work_orders_batch').on(table.batchId),
    index('idx_service_work_orders_date').on(table.serviceDate),
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
    /** Where this lot is kept. Defaults (in the database) to the Main store so every stock path sets it. */
    locationId: integer('location_id')
      .references(() => stockLocations.id)
      .default(sql`default_stock_location()`)
      .notNull(),
    /** Set when this lot was split off another by a transfer between stores */
    parentLotId: integer('parent_lot_id'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_lots_inventory_item').on(table.inventoryItemId),
    index('idx_lots_location').on(table.locationId, table.inventoryItemId),
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

export const batchInventoryConsumptions = pgTable(
  'batch_inventory_consumptions',
  {
    id: serial('id').primaryKey(),
    batchId: integer('batch_id')
      .references(() => batches.id, { onDelete: 'cascade' })
      .notNull(),
    inventoryItemId: integer('inventory_item_id')
      .references(() => feedInventory.id)
      .notNull(),
    inventoryLotId: integer('inventory_lot_id').references(() => inventoryLots.id),
    purchaseOrderItemId: integer('purchase_order_item_id').references(() => purchaseOrderItems.id),
    quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull(),
    unit: varchar('unit', { length: 20 }).notNull(),
    unitCost: decimal('unit_cost', { precision: 10, scale: 2 }).notNull(),
    lineCost: decimal('line_cost', { precision: 12, scale: 2 }).notNull(),
    consumptionDate: date('consumption_date').notNull(),
    referenceType: varchar('reference_type', { length: 50 }),
    referenceId: integer('reference_id'),
    notes: text('notes'),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_batch_inventory_consumptions_batch').on(table.batchId),
    index('idx_batch_inventory_consumptions_item').on(table.inventoryItemId),
    index('idx_batch_inventory_consumptions_lot').on(table.inventoryLotId),
  ],
);

export const inventoryMovements = pgTable(
  'inventory_movements',
  {
    id: serial('id').primaryKey(),
    movementType: varchar('movement_type', { length: 50 }).notNull(),
    movementDate: date('movement_date').notNull(),
    sourceModule: varchar('source_module', { length: 50 }).notNull(),
    sourceEntityType: varchar('source_entity_type', { length: 50 }).notNull(),
    sourceEntityId: integer('source_entity_id').notNull(),
    sourceCodeSnapshot: varchar('source_code_snapshot', { length: 100 }),
    inventoryItemId: integer('inventory_item_id').references(() => feedInventory.id),
    inventoryLotId: integer('inventory_lot_id').references(() => inventoryLots.id),
    purchaseOrderId: integer('purchase_order_id').references(() => purchaseOrders.id),
    purchaseOrderItemId: integer('purchase_order_item_id').references(() => purchaseOrderItems.id),
    productionBatchId: integer('production_batch_id').references(() => feedProductionBatches.id),
    productionMaterialId: integer('production_material_id').references(() => feedProductionMaterials.id),
    feedDistributionId: integer('feed_distribution_id').references(() => feedDistributions.id),
    batchId: integer('batch_id').references(() => batches.id),
    quantity: decimal('quantity', { precision: 12, scale: 2 }).notNull(),
    unit: varchar('unit', { length: 20 }).notNull(),
    unitCost: decimal('unit_cost', { precision: 12, scale: 2 }),
    lineCost: decimal('line_cost', { precision: 14, scale: 2 }),
    balanceAfterQuantity: decimal('balance_after_quantity', { precision: 12, scale: 2 }),
    balanceScope: varchar('balance_scope', { length: 50 }).notNull(),
    notes: text('notes'),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_inventory_movements_date').on(table.movementDate),
    index('idx_inventory_movements_type').on(table.movementType),
    index('idx_inventory_movements_item').on(table.inventoryItemId),
    index('idx_inventory_movements_lot').on(table.inventoryLotId),
    index('idx_inventory_movements_batch').on(table.batchId),
    index('idx_inventory_movements_source').on(table.sourceModule, table.sourceEntityType, table.sourceEntityId),
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

// ─── Stores, transfers and requisitions ──────────────────────────────────────

export const stockLocations = pgTable(
  'stock_locations',
  {
    id: serial('id').primaryKey(),
    code: varchar('code', { length: 50 }).unique().notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    locationType: varchar('location_type', { length: 20 }).notNull(),
    siteId: integer('site_id').references(() => sites.id),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('idx_stock_locations_site').on(table.siteId)],
);

export const stockTransfers = pgTable(
  'stock_transfers',
  {
    id: serial('id').primaryKey(),
    transferCode: varchar('transfer_code', { length: 50 }).unique().notNull(),
    fromLocationId: integer('from_location_id').references(() => stockLocations.id).notNull(),
    toLocationId: integer('to_location_id').references(() => stockLocations.id).notNull(),
    transferDate: date('transfer_date').notNull(),
    notes: text('notes'),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_stock_transfers_date').on(table.transferDate)],
);

export const stockTransferLines = pgTable(
  'stock_transfer_lines',
  {
    id: serial('id').primaryKey(),
    transferId: integer('transfer_id').references(() => stockTransfers.id, { onDelete: 'cascade' }).notNull(),
    inventoryItemId: integer('inventory_item_id').references(() => feedInventory.id).notNull(),
    sourceLotId: integer('source_lot_id').references(() => inventoryLots.id).notNull(),
    destinationLotId: integer('destination_lot_id').references(() => inventoryLots.id).notNull(),
    quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull(),
  },
  (table) => [index('idx_stock_transfer_lines_transfer').on(table.transferId)],
);

export const purchaseRequisitions = pgTable(
  'purchase_requisitions',
  {
    id: serial('id').primaryKey(),
    requisitionCode: varchar('requisition_code', { length: 50 }).unique().notNull(),
    requestedBy: integer('requested_by').references(() => users.id).notNull(),
    costCentreId: integer('cost_centre_id').references(() => costCentres.id).notNull(),
    deliveryLocationId: integer('delivery_location_id').references(() => stockLocations.id),
    neededBy: date('needed_by'),
    status: varchar('status', { length: 20 }).default('submitted').notNull(),
    notes: text('notes'),
    reviewedBy: integer('reviewed_by').references(() => users.id),
    reviewedAt: timestamp('reviewed_at'),
    reviewNotes: text('review_notes'),
    purchaseOrderId: integer('purchase_order_id').references(() => purchaseOrders.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('idx_purchase_requisitions_status').on(table.status)],
);

export const purchaseRequisitionItems = pgTable(
  'purchase_requisition_items',
  {
    id: serial('id').primaryKey(),
    requisitionId: integer('requisition_id').references(() => purchaseRequisitions.id, { onDelete: 'cascade' }).notNull(),
    inventoryItemId: integer('inventory_item_id').references(() => feedInventory.id).notNull(),
    quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull(),
    notes: text('notes'),
  },
  (table) => [index('idx_purchase_requisition_items_req').on(table.requisitionId)],
);
