CREATE TABLE IF NOT EXISTS "inventory_item_types" (
  "id" serial PRIMARY KEY NOT NULL,
  "type_code" varchar(50) NOT NULL,
  "type_name" varchar(100) NOT NULL,
  "category" varchar(50) NOT NULL,
  "default_unit" varchar(20) NOT NULL,
  "allows_batch_allocation" boolean DEFAULT false NOT NULL,
  "is_feed" boolean DEFAULT false NOT NULL,
  "status" varchar(50) DEFAULT 'active' NOT NULL,
  "description" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "inventory_item_types_type_code_unique" UNIQUE("type_code"),
  CONSTRAINT "inventory_item_types_type_name_unique" UNIQUE("type_name")
);

INSERT INTO "inventory_item_types" (
  "type_code",
  "type_name",
  "category",
  "default_unit",
  "allows_batch_allocation",
  "is_feed",
  "status",
  "description"
)
VALUES
  ('feed', 'Feed', 'feed', 'kg', false, true, 'active', 'Feed ingredients and manufactured feed stock'),
  ('medicine', 'Medicine', 'health', 'unit', true, false, 'active', 'Medicines and treatments consumed by farm batches'),
  ('vaccine', 'Vaccine', 'health', 'dose', true, false, 'active', 'Vaccines or immunization stock'),
  ('consumable', 'Consumable', 'operations', 'unit', true, false, 'active', 'General consumables that can be consumed by a batch'),
  ('equipment', 'Equipment', 'assets', 'unit', false, false, 'active', 'Tracked inventory not directly consumed by a batch')
ON CONFLICT ("type_code") DO NOTHING;

ALTER TABLE "feed_inventory"
  ADD COLUMN IF NOT EXISTS "item_type_id" integer,
  ADD COLUMN IF NOT EXISTS "item_code" varchar(50),
  ADD COLUMN IF NOT EXISTS "description" text;

UPDATE "feed_inventory"
SET "item_type_id" = (
  SELECT "id" FROM "inventory_item_types" WHERE "type_code" = 'feed'
)
WHERE "item_type_id" IS NULL;

ALTER TABLE "feed_inventory"
  ALTER COLUMN "item_type_id" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'feed_inventory_item_type_id_inventory_item_types_id_fk'
  ) THEN
    ALTER TABLE "feed_inventory"
      ADD CONSTRAINT "feed_inventory_item_type_id_inventory_item_types_id_fk"
      FOREIGN KEY ("item_type_id") REFERENCES "public"."inventory_item_types"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_inventory_item_types_code" ON "inventory_item_types" ("type_code");
CREATE INDEX IF NOT EXISTS "idx_inventory_item_types_category" ON "inventory_item_types" ("category");
CREATE INDEX IF NOT EXISTS "idx_inventory_item_types_feed" ON "inventory_item_types" ("is_feed");
CREATE INDEX IF NOT EXISTS "idx_feed_inventory_item_type" ON "feed_inventory" ("item_type_id");
CREATE INDEX IF NOT EXISTS "idx_feed_inventory_item_code" ON "feed_inventory" ("item_code");

CREATE TABLE IF NOT EXISTS "batch_inventory_consumptions" (
  "id" serial PRIMARY KEY NOT NULL,
  "batch_id" integer NOT NULL,
  "inventory_item_id" integer NOT NULL,
  "inventory_lot_id" integer,
  "purchase_order_item_id" integer,
  "quantity" numeric(10, 2) NOT NULL,
  "unit" varchar(20) NOT NULL,
  "unit_cost" numeric(10, 2) NOT NULL,
  "line_cost" numeric(12, 2) NOT NULL,
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
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'batch_inventory_consumptions_batch_id_batches_id_fk'
  ) THEN
    ALTER TABLE "batch_inventory_consumptions"
      ADD CONSTRAINT "batch_inventory_consumptions_batch_id_batches_id_fk"
      FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'batch_inventory_consumptions_inventory_item_id_feed_inventory_id_fk'
  ) THEN
    ALTER TABLE "batch_inventory_consumptions"
      ADD CONSTRAINT "batch_inventory_consumptions_inventory_item_id_feed_inventory_id_fk"
      FOREIGN KEY ("inventory_item_id") REFERENCES "public"."feed_inventory"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'batch_inventory_consumptions_inventory_lot_id_inventory_lots_id_fk'
  ) THEN
    ALTER TABLE "batch_inventory_consumptions"
      ADD CONSTRAINT "batch_inventory_consumptions_inventory_lot_id_inventory_lots_id_fk"
      FOREIGN KEY ("inventory_lot_id") REFERENCES "public"."inventory_lots"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'batch_inventory_consumptions_purchase_order_item_id_purchase_order_items_id_fk'
  ) THEN
    ALTER TABLE "batch_inventory_consumptions"
      ADD CONSTRAINT "batch_inventory_consumptions_purchase_order_item_id_purchase_order_items_id_fk"
      FOREIGN KEY ("purchase_order_item_id") REFERENCES "public"."purchase_order_items"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'batch_inventory_consumptions_created_by_users_id_fk'
  ) THEN
    ALTER TABLE "batch_inventory_consumptions"
      ADD CONSTRAINT "batch_inventory_consumptions_created_by_users_id_fk"
      FOREIGN KEY ("created_by") REFERENCES "public"."users"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_batch_inventory_consumptions_batch" ON "batch_inventory_consumptions" ("batch_id");
CREATE INDEX IF NOT EXISTS "idx_batch_inventory_consumptions_item" ON "batch_inventory_consumptions" ("inventory_item_id");
CREATE INDEX IF NOT EXISTS "idx_batch_inventory_consumptions_lot" ON "batch_inventory_consumptions" ("inventory_lot_id");
