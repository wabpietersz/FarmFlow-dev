CREATE TABLE "batch_health_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_id" integer NOT NULL,
	"template_item_id" integer,
	"due_date" date NOT NULL,
	"day_of_age" integer NOT NULL,
	"task_type" varchar(20) NOT NULL,
	"name" varchar(150) NOT NULL,
	"method" varchar(30),
	"inventory_item_id" integer,
	"planned_quantity" numeric(10, 3),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"completed_date" date,
	"completed_by" integer,
	"vaccination_id" integer,
	"skip_reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "growth_standard_points" (
	"id" serial PRIMARY KEY NOT NULL,
	"standard_id" integer NOT NULL,
	"day_of_age" integer NOT NULL,
	"target_weight_g" integer NOT NULL,
	"target_cum_feed_g" integer,
	"target_cum_mortality_pct" numeric(5, 2),
	CONSTRAINT "uq_growth_standard_day" UNIQUE("standard_id","day_of_age")
);
--> statement-breakpoint
CREATE TABLE "growth_standards" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(150) NOT NULL,
	"breed" varchar(100),
	"notes" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "growth_standards_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "health_schedule_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer NOT NULL,
	"day_of_age" integer NOT NULL,
	"task_type" varchar(20) NOT NULL,
	"name" varchar(150) NOT NULL,
	"method" varchar(30),
	"inventory_item_id" integer,
	"dose_per_1000_birds" numeric(10, 3),
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "health_schedule_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "health_schedule_templates_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "house_turnarounds" (
	"id" serial PRIMARY KEY NOT NULL,
	"cage_id" integer NOT NULL,
	"previous_batch_id" integer,
	"started_date" date NOT NULL,
	"litter_removed_date" date,
	"cleaned_date" date,
	"disinfected_date" date,
	"new_litter_date" date,
	"ready_date" date,
	"status" varchar(20) DEFAULT 'in_progress' NOT NULL,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vet_visits" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" integer NOT NULL,
	"batch_id" integer,
	"visit_date" date NOT NULL,
	"vet_name" varchar(150) NOT NULL,
	"reason" varchar(200),
	"findings" text,
	"diagnosis" text,
	"treatment" text,
	"fee_amount" numeric(12, 2),
	"follow_up_date" date,
	"recorded_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "growth_standard_id" integer;--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "health_template_id" integer;--> statement-breakpoint
ALTER TABLE "batch_health_tasks" ADD CONSTRAINT "batch_health_tasks_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_health_tasks" ADD CONSTRAINT "batch_health_tasks_template_item_id_health_schedule_items_id_fk" FOREIGN KEY ("template_item_id") REFERENCES "public"."health_schedule_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_health_tasks" ADD CONSTRAINT "batch_health_tasks_inventory_item_id_feed_inventory_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."feed_inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_health_tasks" ADD CONSTRAINT "batch_health_tasks_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_health_tasks" ADD CONSTRAINT "batch_health_tasks_vaccination_id_vaccinations_id_fk" FOREIGN KEY ("vaccination_id") REFERENCES "public"."vaccinations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_standard_points" ADD CONSTRAINT "growth_standard_points_standard_id_growth_standards_id_fk" FOREIGN KEY ("standard_id") REFERENCES "public"."growth_standards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_schedule_items" ADD CONSTRAINT "health_schedule_items_template_id_health_schedule_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."health_schedule_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_schedule_items" ADD CONSTRAINT "health_schedule_items_inventory_item_id_feed_inventory_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."feed_inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "house_turnarounds" ADD CONSTRAINT "house_turnarounds_cage_id_cages_id_fk" FOREIGN KEY ("cage_id") REFERENCES "public"."cages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "house_turnarounds" ADD CONSTRAINT "house_turnarounds_previous_batch_id_batches_id_fk" FOREIGN KEY ("previous_batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "house_turnarounds" ADD CONSTRAINT "house_turnarounds_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vet_visits" ADD CONSTRAINT "vet_visits_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vet_visits" ADD CONSTRAINT "vet_visits_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vet_visits" ADD CONSTRAINT "vet_visits_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_batch_health_tasks_batch_due" ON "batch_health_tasks" USING btree ("batch_id","due_date");--> statement-breakpoint
CREATE INDEX "idx_batch_health_tasks_status_due" ON "batch_health_tasks" USING btree ("status","due_date");--> statement-breakpoint
CREATE INDEX "idx_health_schedule_items_template" ON "health_schedule_items" USING btree ("template_id","day_of_age");--> statement-breakpoint
CREATE INDEX "idx_house_turnarounds_cage" ON "house_turnarounds" USING btree ("cage_id","status");--> statement-breakpoint
CREATE INDEX "idx_vet_visits_batch" ON "vet_visits" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_vet_visits_site_date" ON "vet_visits" USING btree ("site_id","visit_date");--> statement-breakpoint
-- Vet fees get their own money category
INSERT INTO "finance_categories" ("code","name","category_type","report_group","is_system","sort_order")
  VALUES ('vet_services','Vet Services','expense','Health',true,135)
  ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
-- Starter health programme. Vaccination programmes differ by region and hatchery: the farm's vet should confirm or edit it.
INSERT INTO "health_schedule_templates" ("name","description","is_default")
  VALUES ('Example broiler programme (confirm with your vet)', 'A common broiler starting point. Edit the days, vaccines and doses to match your vet''s programme before relying on it.', true);
--> statement-breakpoint
INSERT INTO "health_schedule_items" ("template_id","day_of_age","task_type","name","method","notes")
SELECT t."id", v.day, v.kind, v.name, v.method, v.notes
FROM "health_schedule_templates" t,
(VALUES
  (1, 'medication', 'Vitamins & electrolytes (arrival)', 'drinking_water', 'Days 1–3 to reduce arrival stress'),
  (7, 'vaccination', 'Newcastle disease + Infectious bronchitis (ND + IB)', 'eye_drop', NULL),
  (14, 'vaccination', 'Gumboro (IBD)', 'drinking_water', NULL),
  (21, 'vaccination', 'Newcastle disease booster (ND LaSota)', 'drinking_water', NULL),
  (24, 'vaccination', 'Gumboro booster (IBD)', 'drinking_water', 'Only if your vet advises a booster')
) AS v(day, kind, name, method, notes)
WHERE t."name" = 'Example broiler programme (confirm with your vet)';
--> statement-breakpoint
-- Starter growth curve: approximate modern broiler targets. Replace with your breed supplier's performance objectives.
INSERT INTO "growth_standards" ("name","breed","notes","is_default")
  VALUES ('Example broiler curve (replace with your breed guide)', 'Broiler (mixed sex)', 'Approximate targets for comparison only. Enter the figures from your chick supplier''s breed guide for accurate tracking.', true);
--> statement-breakpoint
INSERT INTO "growth_standard_points" ("standard_id","day_of_age","target_weight_g","target_cum_feed_g","target_cum_mortality_pct")
SELECT g."id", p.day, p.weight, p.feed, p.mort
FROM "growth_standards" g,
(VALUES
  (0, 42, 0, 0.0),
  (7, 190, 160, 1.0),
  (14, 480, 580, 1.5),
  (21, 950, 1300, 2.0),
  (28, 1550, 2350, 2.5),
  (35, 2200, 3650, 3.0),
  (42, 2850, 5100, 3.5)
) AS p(day, weight, feed, mort)
WHERE g."name" = 'Example broiler curve (replace with your breed guide)';
