CREATE TABLE "purchase_order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_order_id" integer NOT NULL,
	"inventory_item_id" integer NOT NULL,
	"ordered_quantity" numeric(10, 2) NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"received_quantity" numeric(10, 2) DEFAULT '0' NOT NULL,
	"unit" varchar(20) NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_code" varchar(50) NOT NULL,
	"supplier_id" integer NOT NULL,
	"order_date" date NOT NULL,
	"expected_delivery_date" date,
	"actual_delivery_date" date,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"total_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_order_code_unique" UNIQUE("order_code")
);
--> statement-breakpoint
ALTER TABLE "feed_recipe_ingredients" ADD COLUMN "inventory_item_id" integer;--> statement-breakpoint
ALTER TABLE "inventory_audit_trail" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_inventory_item_id_feed_inventory_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."feed_inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_poi_order" ON "purchase_order_items" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "idx_poi_inventory" ON "purchase_order_items" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "idx_po_status" ON "purchase_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_po_supplier" ON "purchase_orders" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_po_order_date" ON "purchase_orders" USING btree ("order_date");--> statement-breakpoint
ALTER TABLE "feed_recipe_ingredients" ADD CONSTRAINT "feed_recipe_ingredients_inventory_item_id_feed_inventory_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."feed_inventory"("id") ON DELETE no action ON UPDATE no action;