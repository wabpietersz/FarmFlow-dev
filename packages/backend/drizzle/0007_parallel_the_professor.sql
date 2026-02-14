CREATE TABLE "employee_compensation" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"pay_type" varchar(20) NOT NULL,
	"base_rate" numeric(12, 2) NOT NULL,
	"overtime_rate" numeric(10, 2) DEFAULT '0' NOT NULL,
	"effective_from" date NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "employee_compensation_employee_id_unique" UNIQUE("employee_id")
);
--> statement-breakpoint
CREATE TABLE "compensation_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"category" varchar(20) NOT NULL,
	"default_amount" numeric(12, 2),
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employee_compensation" ADD CONSTRAINT "employee_compensation_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_employee_compensation_employee_id" ON "employee_compensation" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_employee_compensation_pay_type" ON "employee_compensation" USING btree ("pay_type");--> statement-breakpoint
CREATE INDEX "idx_compensation_templates_category" ON "compensation_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_compensation_templates_active" ON "compensation_templates" USING btree ("is_active");