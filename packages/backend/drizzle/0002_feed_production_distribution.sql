-- Feed Production Batches
CREATE TABLE IF NOT EXISTS "feed_production_batches" (
  "id" serial PRIMARY KEY NOT NULL,
  "production_code" varchar(50) NOT NULL UNIQUE,
  "recipe_id" integer NOT NULL REFERENCES "feed_recipes"("id"),
  "planned_quantity" decimal(10,2) NOT NULL,
  "actual_quantity" decimal(10,2),
  "unit" varchar(20) NOT NULL DEFAULT 'kg',
  "status" varchar(50) NOT NULL DEFAULT 'planned',
  "production_date" date NOT NULL,
  "production_cost" decimal(12,2),
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_feed_prod_status" ON "feed_production_batches" ("status");
CREATE INDEX IF NOT EXISTS "idx_feed_prod_date" ON "feed_production_batches" ("production_date");
CREATE INDEX IF NOT EXISTS "idx_feed_prod_recipe" ON "feed_production_batches" ("recipe_id");

-- Feed Production Materials (raw materials consumed per production run)
CREATE TABLE IF NOT EXISTS "feed_production_materials" (
  "id" serial PRIMARY KEY NOT NULL,
  "production_batch_id" integer NOT NULL REFERENCES "feed_production_batches"("id") ON DELETE CASCADE,
  "inventory_item_id" integer NOT NULL REFERENCES "feed_inventory"("id"),
  "planned_quantity" decimal(10,2) NOT NULL,
  "actual_quantity" decimal(10,2),
  "unit" varchar(20) NOT NULL
);

-- Feed Distributions (feed allocated to farm batches)
CREATE TABLE IF NOT EXISTS "feed_distributions" (
  "id" serial PRIMARY KEY NOT NULL,
  "production_batch_id" integer REFERENCES "feed_production_batches"("id"),
  "farm_batch_id" integer NOT NULL REFERENCES "batches"("id"),
  "feed_type" varchar(50) NOT NULL,
  "quantity" decimal(10,2) NOT NULL,
  "unit" varchar(20) NOT NULL DEFAULT 'kg',
  "distribution_date" date NOT NULL,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_feed_dist_farm_batch" ON "feed_distributions" ("farm_batch_id");
CREATE INDEX IF NOT EXISTS "idx_feed_dist_date" ON "feed_distributions" ("distribution_date");
