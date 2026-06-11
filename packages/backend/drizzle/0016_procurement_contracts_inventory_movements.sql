ALTER TABLE "purchase_orders"
ADD COLUMN IF NOT EXISTS "contract_id" integer;

CREATE TABLE IF NOT EXISTS "supplier_contracts" (
  "id" serial PRIMARY KEY NOT NULL,
  "contract_code" varchar(50) NOT NULL,
  "supplier_id" integer NOT NULL,
  "contract_type" varchar(50) DEFAULT 'supplier' NOT NULL,
  "contract_title" varchar(200) NOT NULL,
  "description" text,
  "status" varchar(50) DEFAULT 'draft' NOT NULL,
  "valid_from" date NOT NULL,
  "valid_to" date,
  "currency_code" varchar(10) DEFAULT 'LKR' NOT NULL,
  "payment_terms_days" integer DEFAULT 0 NOT NULL,
  "commercial_terms" text,
  "rate_table" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "attachment_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "alert_days_before_expiry" integer DEFAULT 30 NOT NULL,
  "created_by" integer NOT NULL,
  "approved_by" integer,
  "approved_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "supplier_contracts_contract_code_unique" UNIQUE("contract_code")
);

CREATE TABLE IF NOT EXISTS "supplier_contract_terms" (
  "id" serial PRIMARY KEY NOT NULL,
  "contract_id" integer NOT NULL,
  "term_type" varchar(50) NOT NULL,
  "term_key" varchar(100) NOT NULL,
  "term_value" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "supplier_invoices" (
  "id" serial PRIMARY KEY NOT NULL,
  "invoice_code" varchar(50) NOT NULL,
  "supplier_id" integer NOT NULL,
  "purchase_order_id" integer,
  "contract_id" integer,
  "invoice_reference" varchar(100) NOT NULL,
  "invoice_date" date NOT NULL,
  "due_date" date NOT NULL,
  "invoice_amount" decimal(12,2) NOT NULL,
  "currency_code" varchar(10) DEFAULT 'LKR' NOT NULL,
  "status" varchar(50) DEFAULT 'recorded' NOT NULL,
  "notes" text,
  "created_by" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "supplier_invoices_invoice_code_unique" UNIQUE("invoice_code")
);

CREATE TABLE IF NOT EXISTS "supplier_payment_allocations" (
  "id" serial PRIMARY KEY NOT NULL,
  "supplier_payment_id" integer NOT NULL,
  "supplier_invoice_id" integer NOT NULL,
  "allocated_amount" decimal(12,2) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "inventory_movements" (
  "id" serial PRIMARY KEY NOT NULL,
  "movement_type" varchar(50) NOT NULL,
  "movement_date" date NOT NULL,
  "source_module" varchar(50) NOT NULL,
  "source_entity_type" varchar(50) NOT NULL,
  "source_entity_id" integer NOT NULL,
  "source_code_snapshot" varchar(100),
  "inventory_item_id" integer,
  "inventory_lot_id" integer,
  "purchase_order_id" integer,
  "purchase_order_item_id" integer,
  "production_batch_id" integer,
  "production_material_id" integer,
  "feed_distribution_id" integer,
  "batch_id" integer,
  "quantity" decimal(12,2) NOT NULL,
  "unit" varchar(20) NOT NULL,
  "unit_cost" decimal(12,2),
  "line_cost" decimal(14,2),
  "balance_after_quantity" decimal(12,2),
  "balance_scope" varchar(50) NOT NULL,
  "notes" text,
  "created_by" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "purchase_orders"
  ADD CONSTRAINT "purchase_orders_contract_id_supplier_contracts_id_fk"
  FOREIGN KEY ("contract_id") REFERENCES "public"."supplier_contracts"("id")
  ON DELETE no action ON UPDATE no action;

ALTER TABLE "supplier_contracts"
  ADD CONSTRAINT "supplier_contracts_supplier_id_suppliers_id_fk"
  FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id")
  ON DELETE no action ON UPDATE no action;
ALTER TABLE "supplier_contracts"
  ADD CONSTRAINT "supplier_contracts_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "public"."users"("id")
  ON DELETE no action ON UPDATE no action;
ALTER TABLE "supplier_contracts"
  ADD CONSTRAINT "supplier_contracts_approved_by_users_id_fk"
  FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id")
  ON DELETE no action ON UPDATE no action;

ALTER TABLE "supplier_contract_terms"
  ADD CONSTRAINT "supplier_contract_terms_contract_id_supplier_contracts_id_fk"
  FOREIGN KEY ("contract_id") REFERENCES "public"."supplier_contracts"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "supplier_invoices"
  ADD CONSTRAINT "supplier_invoices_supplier_id_suppliers_id_fk"
  FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id")
  ON DELETE no action ON UPDATE no action;
ALTER TABLE "supplier_invoices"
  ADD CONSTRAINT "supplier_invoices_purchase_order_id_purchase_orders_id_fk"
  FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id")
  ON DELETE no action ON UPDATE no action;
ALTER TABLE "supplier_invoices"
  ADD CONSTRAINT "supplier_invoices_contract_id_supplier_contracts_id_fk"
  FOREIGN KEY ("contract_id") REFERENCES "public"."supplier_contracts"("id")
  ON DELETE no action ON UPDATE no action;
ALTER TABLE "supplier_invoices"
  ADD CONSTRAINT "supplier_invoices_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "public"."users"("id")
  ON DELETE no action ON UPDATE no action;

ALTER TABLE "supplier_payment_allocations"
  ADD CONSTRAINT "supplier_payment_allocations_supplier_payment_id_supplier_payments_id_fk"
  FOREIGN KEY ("supplier_payment_id") REFERENCES "public"."supplier_payments"("id")
  ON DELETE cascade ON UPDATE no action;
ALTER TABLE "supplier_payment_allocations"
  ADD CONSTRAINT "supplier_payment_allocations_supplier_invoice_id_supplier_invoices_id_fk"
  FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_inventory_item_id_feed_inventory_id_fk"
  FOREIGN KEY ("inventory_item_id") REFERENCES "public"."feed_inventory"("id")
  ON DELETE no action ON UPDATE no action;
ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_inventory_lot_id_inventory_lots_id_fk"
  FOREIGN KEY ("inventory_lot_id") REFERENCES "public"."inventory_lots"("id")
  ON DELETE no action ON UPDATE no action;
ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_purchase_order_id_purchase_orders_id_fk"
  FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id")
  ON DELETE no action ON UPDATE no action;
ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_purchase_order_item_id_purchase_order_items_id_fk"
  FOREIGN KEY ("purchase_order_item_id") REFERENCES "public"."purchase_order_items"("id")
  ON DELETE no action ON UPDATE no action;
ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_production_batch_id_feed_production_batches_id_fk"
  FOREIGN KEY ("production_batch_id") REFERENCES "public"."feed_production_batches"("id")
  ON DELETE no action ON UPDATE no action;
ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_production_material_id_feed_production_materials_id_fk"
  FOREIGN KEY ("production_material_id") REFERENCES "public"."feed_production_materials"("id")
  ON DELETE no action ON UPDATE no action;
ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_feed_distribution_id_feed_distributions_id_fk"
  FOREIGN KEY ("feed_distribution_id") REFERENCES "public"."feed_distributions"("id")
  ON DELETE no action ON UPDATE no action;
ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_batch_id_batches_id_fk"
  FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id")
  ON DELETE no action ON UPDATE no action;
ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "public"."users"("id")
  ON DELETE no action ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "idx_supplier_contracts_supplier" ON "supplier_contracts" ("supplier_id");
CREATE INDEX IF NOT EXISTS "idx_supplier_contracts_status" ON "supplier_contracts" ("status");
CREATE INDEX IF NOT EXISTS "idx_supplier_contracts_validity" ON "supplier_contracts" ("valid_from", "valid_to");
CREATE INDEX IF NOT EXISTS "idx_supplier_contract_terms_contract" ON "supplier_contract_terms" ("contract_id");
CREATE INDEX IF NOT EXISTS "idx_supplier_contract_terms_type" ON "supplier_contract_terms" ("term_type");
CREATE INDEX IF NOT EXISTS "idx_supplier_invoices_supplier" ON "supplier_invoices" ("supplier_id");
CREATE INDEX IF NOT EXISTS "idx_supplier_invoices_po" ON "supplier_invoices" ("purchase_order_id");
CREATE INDEX IF NOT EXISTS "idx_supplier_invoices_contract" ON "supplier_invoices" ("contract_id");
CREATE INDEX IF NOT EXISTS "idx_supplier_invoices_due_date" ON "supplier_invoices" ("due_date");
CREATE INDEX IF NOT EXISTS "idx_supplier_invoices_status" ON "supplier_invoices" ("status");
CREATE INDEX IF NOT EXISTS "idx_supplier_payment_allocations_payment" ON "supplier_payment_allocations" ("supplier_payment_id");
CREATE INDEX IF NOT EXISTS "idx_supplier_payment_allocations_invoice" ON "supplier_payment_allocations" ("supplier_invoice_id");
CREATE INDEX IF NOT EXISTS "idx_inventory_movements_date" ON "inventory_movements" ("movement_date");
CREATE INDEX IF NOT EXISTS "idx_inventory_movements_type" ON "inventory_movements" ("movement_type");
CREATE INDEX IF NOT EXISTS "idx_inventory_movements_item" ON "inventory_movements" ("inventory_item_id");
CREATE INDEX IF NOT EXISTS "idx_inventory_movements_lot" ON "inventory_movements" ("inventory_lot_id");
CREATE INDEX IF NOT EXISTS "idx_inventory_movements_batch" ON "inventory_movements" ("batch_id");
CREATE INDEX IF NOT EXISTS "idx_inventory_movements_source" ON "inventory_movements" ("source_module", "source_entity_type", "source_entity_id");
