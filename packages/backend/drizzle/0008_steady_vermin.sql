CREATE TABLE "employee_compensation_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"pay_type" varchar(20) NOT NULL,
	"base_rate" numeric(12, 2) NOT NULL,
	"overtime_rate" numeric(10, 2) DEFAULT '0' NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"standard_hours_per_day" numeric(4, 2) DEFAULT '8.00' NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_compensation_components" (
	"id" serial PRIMARY KEY NOT NULL,
	"revision_id" integer NOT NULL,
	"component_type" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"calculation_type" varchar(20) NOT NULL,
	"value" numeric(12, 2) NOT NULL,
	"is_taxable" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employee_compensation_revisions" ADD CONSTRAINT "employee_compensation_revisions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_compensation_components" ADD CONSTRAINT "employee_compensation_components_revision_id_employee_compensation_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."employee_compensation_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_employee_comp_revisions_employee_effective_from_unique" ON "employee_compensation_revisions" USING btree ("employee_id", "effective_from");--> statement-breakpoint
CREATE INDEX "idx_employee_comp_revisions_employee_id" ON "employee_compensation_revisions" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_employee_comp_revisions_effective_from" ON "employee_compensation_revisions" USING btree ("effective_from");--> statement-breakpoint
CREATE INDEX "idx_employee_comp_revisions_effective_to" ON "employee_compensation_revisions" USING btree ("effective_to");--> statement-breakpoint
CREATE INDEX "idx_employee_comp_revisions_active" ON "employee_compensation_revisions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_employee_comp_components_revision_id" ON "employee_compensation_components" USING btree ("revision_id");--> statement-breakpoint
CREATE INDEX "idx_employee_comp_components_type" ON "employee_compensation_components" USING btree ("component_type");--> statement-breakpoint
CREATE INDEX "idx_employee_comp_components_active" ON "employee_compensation_components" USING btree ("is_active");--> statement-breakpoint
INSERT INTO "employee_compensation_revisions" (
	"employee_id",
	"pay_type",
	"base_rate",
	"overtime_rate",
	"effective_from",
	"effective_to",
	"standard_hours_per_day",
	"notes",
	"is_active",
	"created_at",
	"updated_at"
)
SELECT
	ec."employee_id",
	ec."pay_type",
	ec."base_rate",
	ec."overtime_rate",
	ec."effective_from",
	NULL,
	'8.00',
	ec."notes",
	true,
	ec."created_at",
	ec."updated_at"
FROM "employee_compensation" ec
ON CONFLICT ("employee_id", "effective_from") DO NOTHING;
