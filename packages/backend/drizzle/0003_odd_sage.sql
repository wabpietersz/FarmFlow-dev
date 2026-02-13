CREATE TABLE "feed_distributions" (
	"id" serial PRIMARY KEY NOT NULL,
	"production_batch_id" integer,
	"farm_batch_id" integer NOT NULL,
	"feed_type" varchar(50) NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"unit" varchar(20) DEFAULT 'kg' NOT NULL,
	"distribution_date" date NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_production_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"production_code" varchar(50) NOT NULL,
	"recipe_id" integer NOT NULL,
	"planned_quantity" numeric(10, 2) NOT NULL,
	"actual_quantity" numeric(10, 2),
	"unit" varchar(20) DEFAULT 'kg' NOT NULL,
	"status" varchar(50) DEFAULT 'planned' NOT NULL,
	"production_date" date NOT NULL,
	"production_cost" numeric(12, 2),
	"notes" text,
	"scheduled_date" date,
	"waste_quantity" numeric(10, 2),
	"waste_reason" text,
	"qc_passed_at" timestamp,
	"qc_passed_by" integer,
	"qc_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "feed_production_batches_production_code_unique" UNIQUE("production_code")
);
--> statement-breakpoint
CREATE TABLE "feed_production_materials" (
	"id" serial PRIMARY KEY NOT NULL,
	"production_batch_id" integer NOT NULL,
	"inventory_item_id" integer NOT NULL,
	"planned_quantity" numeric(10, 2) NOT NULL,
	"actual_quantity" numeric(10, 2),
	"unit" varchar(20) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"inventory_item_id" integer NOT NULL,
	"alert_type" varchar(50) DEFAULT 'low_stock' NOT NULL,
	"current_quantity" numeric(10, 2) NOT NULL,
	"reorder_level" numeric(10, 2) NOT NULL,
	"suggested_order_quantity" numeric(10, 2) NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"acknowledged_by" integer,
	"acknowledged_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_audit_trail" (
	"id" serial PRIMARY KEY NOT NULL,
	"inventory_item_id" integer NOT NULL,
	"change_type" varchar(50) NOT NULL,
	"previous_quantity" numeric(10, 2) NOT NULL,
	"change_quantity" numeric(10, 2) NOT NULL,
	"new_quantity" numeric(10, 2) NOT NULL,
	"reference_id" integer,
	"reference_type" varchar(50),
	"performed_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_type" varchar(50) NOT NULL,
	"schedule_name" varchar(100) NOT NULL,
	"cron_expression" varchar(50) NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"recipient_emails" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp,
	"next_run_at" timestamp,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feed_recipes" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "feed_recipes" ADD COLUMN "parent_recipe_id" integer;--> statement-breakpoint
ALTER TABLE "feed_recipes" ADD COLUMN "target_protein" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "feed_recipes" ADD COLUMN "target_energy" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "feed_recipes" ADD COLUMN "target_fiber" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "feed_recipes" ADD COLUMN "target_calcium" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "feed_distributions" ADD CONSTRAINT "feed_distributions_production_batch_id_feed_production_batches_id_fk" FOREIGN KEY ("production_batch_id") REFERENCES "public"."feed_production_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_distributions" ADD CONSTRAINT "feed_distributions_farm_batch_id_batches_id_fk" FOREIGN KEY ("farm_batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_production_batches" ADD CONSTRAINT "feed_production_batches_recipe_id_feed_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."feed_recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_production_batches" ADD CONSTRAINT "feed_production_batches_qc_passed_by_users_id_fk" FOREIGN KEY ("qc_passed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_production_materials" ADD CONSTRAINT "feed_production_materials_production_batch_id_feed_production_batches_id_fk" FOREIGN KEY ("production_batch_id") REFERENCES "public"."feed_production_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_production_materials" ADD CONSTRAINT "feed_production_materials_inventory_item_id_feed_inventory_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."feed_inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_alerts" ADD CONSTRAINT "inventory_alerts_inventory_item_id_feed_inventory_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."feed_inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_alerts" ADD CONSTRAINT "inventory_alerts_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_audit_trail" ADD CONSTRAINT "inventory_audit_trail_inventory_item_id_feed_inventory_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."feed_inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_audit_trail" ADD CONSTRAINT "inventory_audit_trail_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_feed_dist_farm_batch" ON "feed_distributions" USING btree ("farm_batch_id");--> statement-breakpoint
CREATE INDEX "idx_feed_dist_date" ON "feed_distributions" USING btree ("distribution_date");--> statement-breakpoint
CREATE INDEX "idx_feed_prod_status" ON "feed_production_batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_feed_prod_date" ON "feed_production_batches" USING btree ("production_date");--> statement-breakpoint
CREATE INDEX "idx_feed_prod_recipe" ON "feed_production_batches" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "idx_inv_alerts_item" ON "inventory_alerts" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "idx_inv_alerts_status" ON "inventory_alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_inv_audit_item" ON "inventory_audit_trail" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "idx_inv_audit_date" ON "inventory_audit_trail" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_report_sched_type" ON "report_schedules" USING btree ("report_type");--> statement-breakpoint
CREATE INDEX "idx_report_sched_active" ON "report_schedules" USING btree ("is_active");