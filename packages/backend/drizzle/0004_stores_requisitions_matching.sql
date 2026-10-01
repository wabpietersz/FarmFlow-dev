CREATE TABLE "purchase_requisition_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"requisition_id" integer NOT NULL,
	"inventory_item_id" integer NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "purchase_requisitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"requisition_code" varchar(50) NOT NULL,
	"requested_by" integer NOT NULL,
	"cost_centre_id" integer NOT NULL,
	"delivery_location_id" integer,
	"needed_by" date,
	"status" varchar(20) DEFAULT 'submitted' NOT NULL,
	"notes" text,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"review_notes" text,
	"purchase_order_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_requisitions_requisition_code_unique" UNIQUE("requisition_code")
);
--> statement-breakpoint
CREATE TABLE "stock_locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"location_type" varchar(20) NOT NULL,
	"site_id" integer,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stock_locations_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "stock_transfer_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"transfer_id" integer NOT NULL,
	"inventory_item_id" integer NOT NULL,
	"source_lot_id" integer NOT NULL,
	"destination_lot_id" integer NOT NULL,
	"quantity" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"transfer_code" varchar(50) NOT NULL,
	"from_location_id" integer NOT NULL,
	"to_location_id" integer NOT NULL,
	"transfer_date" date NOT NULL,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stock_transfers_transfer_code_unique" UNIQUE("transfer_code")
);
--> statement-breakpoint
-- Stores: a Main store, the feed mill store, and one store per farm
INSERT INTO "stock_locations" ("code","name","location_type") VALUES
  ('MAIN','Main store','central'),
  ('MILL','Feed mill store','mill_store');
--> statement-breakpoint
INSERT INTO "stock_locations" ("code","name","location_type","site_id")
  SELECT 'FARM-' || s."id", s."site_name" || ' store', 'farm_store', s."id" FROM "sites" s;
--> statement-breakpoint
-- Any stock path that doesn't say where a lot goes puts it in the Main store.
CREATE OR REPLACE FUNCTION default_stock_location() RETURNS integer LANGUAGE sql STABLE AS $$
  SELECT "id" FROM "stock_locations" WHERE "code" = 'MAIN'
$$;
--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD COLUMN "location_id" integer DEFAULT default_stock_location() NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD COLUMN "parent_lot_id" integer;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "delivery_location_id" integer;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "requisition_id" integer;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD COLUMN "match_status" varchar(20);--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD COLUMN "received_value" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD COLUMN "match_variance" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD COLUMN "override_note" text;--> statement-breakpoint
ALTER TABLE "purchase_requisition_items" ADD CONSTRAINT "purchase_requisition_items_requisition_id_purchase_requisitions_id_fk" FOREIGN KEY ("requisition_id") REFERENCES "public"."purchase_requisitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requisition_items" ADD CONSTRAINT "purchase_requisition_items_inventory_item_id_feed_inventory_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."feed_inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_cost_centre_id_cost_centres_id_fk" FOREIGN KEY ("cost_centre_id") REFERENCES "public"."cost_centres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_delivery_location_id_stock_locations_id_fk" FOREIGN KEY ("delivery_location_id") REFERENCES "public"."stock_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_transfer_id_stock_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."stock_transfers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_inventory_item_id_feed_inventory_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."feed_inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_source_lot_id_inventory_lots_id_fk" FOREIGN KEY ("source_lot_id") REFERENCES "public"."inventory_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_destination_lot_id_inventory_lots_id_fk" FOREIGN KEY ("destination_lot_id") REFERENCES "public"."inventory_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_from_location_id_stock_locations_id_fk" FOREIGN KEY ("from_location_id") REFERENCES "public"."stock_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_to_location_id_stock_locations_id_fk" FOREIGN KEY ("to_location_id") REFERENCES "public"."stock_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_purchase_requisition_items_req" ON "purchase_requisition_items" USING btree ("requisition_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_requisitions_status" ON "purchase_requisitions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_stock_locations_site" ON "stock_locations" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "idx_stock_transfer_lines_transfer" ON "stock_transfer_lines" USING btree ("transfer_id");--> statement-breakpoint
CREATE INDEX "idx_stock_transfers_date" ON "stock_transfers" USING btree ("transfer_date");--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_location_id_stock_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."stock_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_delivery_location_id_stock_locations_id_fk" FOREIGN KEY ("delivery_location_id") REFERENCES "public"."stock_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_lots_location" ON "inventory_lots" USING btree ("location_id","inventory_item_id");--> statement-breakpoint
-- Feed raw materials already in stock are at the mill.
UPDATE "inventory_lots" l SET "location_id" = (SELECT "id" FROM "stock_locations" WHERE "code" = 'MILL')
  FROM "feed_inventory" fi JOIN "inventory_item_types" t ON t."id" = fi."item_type_id"
  WHERE fi."id" = l."inventory_item_id" AND t."is_feed" = true;
