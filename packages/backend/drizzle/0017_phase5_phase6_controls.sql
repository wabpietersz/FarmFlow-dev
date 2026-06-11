ALTER TABLE "supplier_contracts"
ADD COLUMN IF NOT EXISTS "approval_notes" text;

ALTER TABLE "supplier_invoices"
ADD COLUMN IF NOT EXISTS "approved_by" integer,
ADD COLUMN IF NOT EXISTS "approved_at" timestamp,
ADD COLUMN IF NOT EXISTS "approval_notes" text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'supplier_invoices_approved_by_users_id_fk'
  ) THEN
    ALTER TABLE "supplier_invoices"
      ADD CONSTRAINT "supplier_invoices_approved_by_users_id_fk"
      FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "period_locks" (
  "id" serial PRIMARY KEY NOT NULL,
  "lock_code" varchar(50) NOT NULL,
  "period_start" varchar(10) NOT NULL,
  "period_end" varchar(10) NOT NULL,
  "scope" varchar(50) DEFAULT 'all' NOT NULL,
  "status" varchar(50) DEFAULT 'active' NOT NULL,
  "notes" text,
  "created_by" integer NOT NULL,
  "released_by" integer,
  "released_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "period_locks_lock_code_unique" UNIQUE("lock_code")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'period_locks_created_by_users_id_fk'
  ) THEN
    ALTER TABLE "period_locks"
      ADD CONSTRAINT "period_locks_created_by_users_id_fk"
      FOREIGN KEY ("created_by") REFERENCES "public"."users"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'period_locks_released_by_users_id_fk'
  ) THEN
    ALTER TABLE "period_locks"
      ADD CONSTRAINT "period_locks_released_by_users_id_fk"
      FOREIGN KEY ("released_by") REFERENCES "public"."users"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_period_locks_period" ON "period_locks" ("period_start", "period_end");
CREATE INDEX IF NOT EXISTS "idx_period_locks_scope" ON "period_locks" ("scope");
CREATE INDEX IF NOT EXISTS "idx_period_locks_status" ON "period_locks" ("status");

CREATE TABLE IF NOT EXISTS "chick_placements" (
  "id" serial PRIMARY KEY NOT NULL,
  "batch_id" integer NOT NULL,
  "supplier_id" integer,
  "contract_id" integer,
  "placement_date" date NOT NULL,
  "invoice_reference" varchar(100),
  "delivered_quantity" integer NOT NULL,
  "mortality_on_arrival" integer DEFAULT 0 NOT NULL,
  "accepted_quantity" integer NOT NULL,
  "unit_cost" decimal(12,2) NOT NULL,
  "batch_opening_cost" decimal(14,2) NOT NULL,
  "notes" text,
  "created_by" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chick_placements_batch_id_batches_id_fk'
  ) THEN
    ALTER TABLE "chick_placements"
      ADD CONSTRAINT "chick_placements_batch_id_batches_id_fk"
      FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chick_placements_supplier_id_suppliers_id_fk'
  ) THEN
    ALTER TABLE "chick_placements"
      ADD CONSTRAINT "chick_placements_supplier_id_suppliers_id_fk"
      FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chick_placements_contract_id_supplier_contracts_id_fk'
  ) THEN
    ALTER TABLE "chick_placements"
      ADD CONSTRAINT "chick_placements_contract_id_supplier_contracts_id_fk"
      FOREIGN KEY ("contract_id") REFERENCES "public"."supplier_contracts"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chick_placements_created_by_users_id_fk'
  ) THEN
    ALTER TABLE "chick_placements"
      ADD CONSTRAINT "chick_placements_created_by_users_id_fk"
      FOREIGN KEY ("created_by") REFERENCES "public"."users"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_chick_placements_batch" ON "chick_placements" ("batch_id");
CREATE INDEX IF NOT EXISTS "idx_chick_placements_supplier" ON "chick_placements" ("supplier_id");
CREATE INDEX IF NOT EXISTS "idx_chick_placements_contract" ON "chick_placements" ("contract_id");
CREATE INDEX IF NOT EXISTS "idx_chick_placements_date" ON "chick_placements" ("placement_date");

CREATE TABLE IF NOT EXISTS "site_inventory_consumptions" (
  "id" serial PRIMARY KEY NOT NULL,
  "site_id" integer NOT NULL,
  "inventory_item_id" integer NOT NULL,
  "inventory_lot_id" integer,
  "purchase_order_item_id" integer,
  "quantity" decimal(10,2) NOT NULL,
  "unit" varchar(20) NOT NULL,
  "unit_cost" decimal(10,2) NOT NULL,
  "line_cost" decimal(12,2) NOT NULL,
  "consumption_date" date NOT NULL,
  "reference_type" varchar(50),
  "reference_id" integer,
  "notes" text,
  "created_by" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'site_inventory_consumptions_site_id_sites_id_fk'
  ) THEN
    ALTER TABLE "site_inventory_consumptions"
      ADD CONSTRAINT "site_inventory_consumptions_site_id_sites_id_fk"
      FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'site_inventory_consumptions_inventory_item_id_feed_inventory_id_fk'
  ) THEN
    ALTER TABLE "site_inventory_consumptions"
      ADD CONSTRAINT "site_inventory_consumptions_inventory_item_id_feed_inventory_id_fk"
      FOREIGN KEY ("inventory_item_id") REFERENCES "public"."feed_inventory"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'site_inventory_consumptions_inventory_lot_id_inventory_lots_id_fk'
  ) THEN
    ALTER TABLE "site_inventory_consumptions"
      ADD CONSTRAINT "site_inventory_consumptions_inventory_lot_id_inventory_lots_id_fk"
      FOREIGN KEY ("inventory_lot_id") REFERENCES "public"."inventory_lots"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'site_inventory_consumptions_purchase_order_item_id_purchase_order_items_id_fk'
  ) THEN
    ALTER TABLE "site_inventory_consumptions"
      ADD CONSTRAINT "site_inventory_consumptions_purchase_order_item_id_purchase_order_items_id_fk"
      FOREIGN KEY ("purchase_order_item_id") REFERENCES "public"."purchase_order_items"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'site_inventory_consumptions_created_by_users_id_fk'
  ) THEN
    ALTER TABLE "site_inventory_consumptions"
      ADD CONSTRAINT "site_inventory_consumptions_created_by_users_id_fk"
      FOREIGN KEY ("created_by") REFERENCES "public"."users"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_site_inventory_consumptions_site" ON "site_inventory_consumptions" ("site_id");
CREATE INDEX IF NOT EXISTS "idx_site_inventory_consumptions_item" ON "site_inventory_consumptions" ("inventory_item_id");
CREATE INDEX IF NOT EXISTS "idx_site_inventory_consumptions_lot" ON "site_inventory_consumptions" ("inventory_lot_id");
CREATE INDEX IF NOT EXISTS "idx_site_inventory_consumptions_date" ON "site_inventory_consumptions" ("consumption_date");

CREATE TABLE IF NOT EXISTS "service_work_orders" (
  "id" serial PRIMARY KEY NOT NULL,
  "work_order_code" varchar(50) NOT NULL,
  "service_type" varchar(50) NOT NULL,
  "title" varchar(200) NOT NULL,
  "supplier_id" integer,
  "contract_id" integer,
  "allocation_type" varchar(50) DEFAULT 'shared_overhead' NOT NULL,
  "site_id" integer,
  "batch_id" integer,
  "service_date" date NOT NULL,
  "invoice_reference" varchar(100),
  "quantity" decimal(10,2),
  "unit" varchar(20),
  "unit_rate" decimal(12,2),
  "total_amount" decimal(14,2) NOT NULL,
  "status" varchar(50) DEFAULT 'pending_approval' NOT NULL,
  "approval_notes" text,
  "approved_by" integer,
  "approved_at" timestamp,
  "finance_account_id" integer,
  "payment_method" varchar(50),
  "reference_number" varchar(100),
  "cheque_leaf_id" integer,
  "cheque_number" varchar(50),
  "supplier_payment_id" integer,
  "treasury_transaction_id" integer,
  "treasury_reversal_transaction_id" integer,
  "requested_by" integer NOT NULL,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "service_work_orders_work_order_code_unique" UNIQUE("work_order_code")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_work_orders_supplier_id_suppliers_id_fk'
  ) THEN
    ALTER TABLE "service_work_orders"
      ADD CONSTRAINT "service_work_orders_supplier_id_suppliers_id_fk"
      FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_work_orders_contract_id_supplier_contracts_id_fk'
  ) THEN
    ALTER TABLE "service_work_orders"
      ADD CONSTRAINT "service_work_orders_contract_id_supplier_contracts_id_fk"
      FOREIGN KEY ("contract_id") REFERENCES "public"."supplier_contracts"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_work_orders_site_id_sites_id_fk'
  ) THEN
    ALTER TABLE "service_work_orders"
      ADD CONSTRAINT "service_work_orders_site_id_sites_id_fk"
      FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_work_orders_batch_id_batches_id_fk'
  ) THEN
    ALTER TABLE "service_work_orders"
      ADD CONSTRAINT "service_work_orders_batch_id_batches_id_fk"
      FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_work_orders_approved_by_users_id_fk'
  ) THEN
    ALTER TABLE "service_work_orders"
      ADD CONSTRAINT "service_work_orders_approved_by_users_id_fk"
      FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_work_orders_finance_account_id_finance_accounts_id_fk'
  ) THEN
    ALTER TABLE "service_work_orders"
      ADD CONSTRAINT "service_work_orders_finance_account_id_finance_accounts_id_fk"
      FOREIGN KEY ("finance_account_id") REFERENCES "public"."finance_accounts"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_work_orders_cheque_leaf_id_cheque_leaves_id_fk'
  ) THEN
    ALTER TABLE "service_work_orders"
      ADD CONSTRAINT "service_work_orders_cheque_leaf_id_cheque_leaves_id_fk"
      FOREIGN KEY ("cheque_leaf_id") REFERENCES "public"."cheque_leaves"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_work_orders_supplier_payment_id_supplier_payments_id_fk'
  ) THEN
    ALTER TABLE "service_work_orders"
      ADD CONSTRAINT "service_work_orders_supplier_payment_id_supplier_payments_id_fk"
      FOREIGN KEY ("supplier_payment_id") REFERENCES "public"."supplier_payments"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_work_orders_treasury_transaction_id_treasury_transactions_id_fk'
  ) THEN
    ALTER TABLE "service_work_orders"
      ADD CONSTRAINT "service_work_orders_treasury_transaction_id_treasury_transactions_id_fk"
      FOREIGN KEY ("treasury_transaction_id") REFERENCES "public"."treasury_transactions"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_work_orders_treasury_reversal_transaction_id_treasury_transactions_id_fk'
  ) THEN
    ALTER TABLE "service_work_orders"
      ADD CONSTRAINT "service_work_orders_treasury_reversal_transaction_id_treasury_transactions_id_fk"
      FOREIGN KEY ("treasury_reversal_transaction_id") REFERENCES "public"."treasury_transactions"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_work_orders_requested_by_users_id_fk'
  ) THEN
    ALTER TABLE "service_work_orders"
      ADD CONSTRAINT "service_work_orders_requested_by_users_id_fk"
      FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_service_work_orders_type" ON "service_work_orders" ("service_type");
CREATE INDEX IF NOT EXISTS "idx_service_work_orders_status" ON "service_work_orders" ("status");
CREATE INDEX IF NOT EXISTS "idx_service_work_orders_supplier" ON "service_work_orders" ("supplier_id");
CREATE INDEX IF NOT EXISTS "idx_service_work_orders_contract" ON "service_work_orders" ("contract_id");
CREATE INDEX IF NOT EXISTS "idx_service_work_orders_site" ON "service_work_orders" ("site_id");
CREATE INDEX IF NOT EXISTS "idx_service_work_orders_batch" ON "service_work_orders" ("batch_id");
CREATE INDEX IF NOT EXISTS "idx_service_work_orders_date" ON "service_work_orders" ("service_date");

ALTER TABLE "vaccinations"
ADD COLUMN IF NOT EXISTS "inventory_item_id" integer,
ADD COLUMN IF NOT EXISTS "quantity_used" decimal(10,2),
ADD COLUMN IF NOT EXISTS "unit" varchar(20),
ADD COLUMN IF NOT EXISTS "inventory_cost" decimal(12,2);

CREATE INDEX IF NOT EXISTS "idx_vaccinations_inventory_item" ON "vaccinations" ("inventory_item_id");
