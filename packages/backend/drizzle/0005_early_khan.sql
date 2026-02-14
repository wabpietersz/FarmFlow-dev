CREATE TABLE "inventory_lots" (
	"id" serial PRIMARY KEY NOT NULL,
	"inventory_item_id" integer NOT NULL,
	"purchase_order_item_id" integer,
	"lot_code" varchar(50) NOT NULL,
	"received_quantity" numeric(10, 2) NOT NULL,
	"remaining_quantity" numeric(10, 2) NOT NULL,
	"cost_per_unit" numeric(10, 2) NOT NULL,
	"received_date" date NOT NULL,
	"expiry_date" date,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_lots_lot_code_unique" UNIQUE("lot_code")
);
--> statement-breakpoint
CREATE TABLE "production_material_lots" (
	"id" serial PRIMARY KEY NOT NULL,
	"production_material_id" integer NOT NULL,
	"inventory_lot_id" integer NOT NULL,
	"quantity_used" numeric(10, 2) NOT NULL,
	"cost_per_unit" numeric(10, 2) NOT NULL,
	"line_cost" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feed_production_materials" ADD COLUMN "actual_cost" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "feed_production_materials" ADD COLUMN "weighted_cost_per_unit" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "inventory_audit_trail" ADD COLUMN "lot_id" integer;--> statement-breakpoint
ALTER TABLE "inventory_audit_trail" ADD COLUMN "cost_at_time" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_inventory_item_id_feed_inventory_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."feed_inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_purchase_order_item_id_purchase_order_items_id_fk" FOREIGN KEY ("purchase_order_item_id") REFERENCES "public"."purchase_order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_material_lots" ADD CONSTRAINT "production_material_lots_production_material_id_feed_production_materials_id_fk" FOREIGN KEY ("production_material_id") REFERENCES "public"."feed_production_materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_material_lots" ADD CONSTRAINT "production_material_lots_inventory_lot_id_inventory_lots_id_fk" FOREIGN KEY ("inventory_lot_id") REFERENCES "public"."inventory_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_lots_inventory_item" ON "inventory_lots" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "idx_lots_remaining" ON "inventory_lots" USING btree ("remaining_quantity");--> statement-breakpoint
CREATE INDEX "idx_lots_received_date" ON "inventory_lots" USING btree ("received_date");--> statement-breakpoint
CREATE INDEX "idx_pml_material" ON "production_material_lots" USING btree ("production_material_id");--> statement-breakpoint
CREATE INDEX "idx_pml_lot" ON "production_material_lots" USING btree ("inventory_lot_id");