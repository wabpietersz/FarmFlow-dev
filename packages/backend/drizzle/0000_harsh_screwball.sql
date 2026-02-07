CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"firebase_uid" varchar(128) NOT NULL,
	"email" varchar(255) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"user_role" varchar(50) NOT NULL,
	"site_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_firebase_uid_unique" UNIQUE("firebase_uid"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "cages" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" integer NOT NULL,
	"cage_number" varchar(50) NOT NULL,
	"capacity" integer NOT NULL,
	"status" varchar(50) DEFAULT 'empty' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_cages_site_cage" UNIQUE("site_id","cage_number")
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_name" varchar(100) NOT NULL,
	"location" varchar(255) NOT NULL,
	"capacity" integer NOT NULL,
	"status" varchar(50) DEFAULT 'active',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sites_site_name_unique" UNIQUE("site_name")
);
--> statement-breakpoint
CREATE TABLE "bank_details" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"account_holder_name" varchar(100) NOT NULL,
	"bank_name" varchar(100) NOT NULL,
	"branch_code" varchar(20),
	"account_number" varchar(50) NOT NULL,
	"ifsc_code" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bank_details_employee_id_unique" UNIQUE("employee_id")
);
--> statement-breakpoint
CREATE TABLE "emergency_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"contact_name" varchar(100) NOT NULL,
	"relationship" varchar(50) NOT NULL,
	"phone_number" varchar(20) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"designation" varchar(100) NOT NULL,
	"site_id" integer NOT NULL,
	"employment_type" varchar(50) NOT NULL,
	"join_date" date NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"phone" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "employees_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50),
	"entity_id" integer,
	"changes" jsonb,
	"ip_address" varchar(50),
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" integer NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_url" varchar(512) NOT NULL,
	"file_type" varchar(50) NOT NULL,
	"file_size" integer NOT NULL,
	"uploaded_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_code" varchar(50) NOT NULL,
	"site_id" integer NOT NULL,
	"cage_id" integer NOT NULL,
	"chicks_placed" integer NOT NULL,
	"placement_date" date NOT NULL,
	"expected_delivery_date" date,
	"actual_delivery_date" date,
	"status" varchar(50) DEFAULT 'placement' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "batches_batch_code_unique" UNIQUE("batch_code")
);
--> statement-breakpoint
CREATE TABLE "daily_record_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"daily_record_id" integer NOT NULL,
	"photo_url" varchar(512) NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_id" integer NOT NULL,
	"record_date" date NOT NULL,
	"current_age" integer NOT NULL,
	"bird_count" integer NOT NULL,
	"mortality_count" integer DEFAULT 0 NOT NULL,
	"mortality_cause" varchar(100),
	"water_consumption" numeric(8, 2),
	"feed_consumption" numeric(8, 2) NOT NULL,
	"average_weight" numeric(8, 2),
	"temperature" numeric(5, 2),
	"humidity" integer,
	"ammonia_level" numeric(5, 2),
	"recorded_by" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_daily_records_batch_date" UNIQUE("batch_id","record_date")
);
--> statement-breakpoint
CREATE TABLE "vaccinations" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_id" integer NOT NULL,
	"vaccine_type" varchar(100) NOT NULL,
	"vaccination_date" date NOT NULL,
	"notes" text,
	"recorded_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_inventory" (
	"id" serial PRIMARY KEY NOT NULL,
	"ingredient_name" varchar(100) NOT NULL,
	"supplier_id" integer,
	"quantity" numeric(10, 2) NOT NULL,
	"unit" varchar(20) NOT NULL,
	"cost_per_unit" numeric(10, 2) NOT NULL,
	"reorder_level" numeric(10, 2),
	"last_restock_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_recipe_ingredients" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" integer NOT NULL,
	"supplier_id" integer,
	"ingredient_name" varchar(100) NOT NULL,
	"proportion" numeric(5, 2) NOT NULL,
	"unit" varchar(20) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_recipes" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_name" varchar(100) NOT NULL,
	"feed_type" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'active',
	"cost" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "feed_recipes_recipe_name_unique" UNIQUE("recipe_name")
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_name" varchar(100) NOT NULL,
	"contact_person" varchar(100),
	"phone_number" varchar(20),
	"email" varchar(100),
	"address" text,
	"status" varchar(50) DEFAULT 'active',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "suppliers_supplier_name_unique" UNIQUE("supplier_name")
);
--> statement-breakpoint
CREATE TABLE "buyers" (
	"id" serial PRIMARY KEY NOT NULL,
	"buyer_name" varchar(100) NOT NULL,
	"contact_person" varchar(100),
	"phone_number" varchar(20),
	"email" varchar(100),
	"address" text,
	"credit_terms" integer DEFAULT 0,
	"status" varchar(50) DEFAULT 'active',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "buyers_buyer_name_unique" UNIQUE("buyer_name")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_id" integer NOT NULL,
	"payment_amount" numeric(12, 2) NOT NULL,
	"payment_date" date NOT NULL,
	"payment_method" varchar(50) NOT NULL,
	"cheque_number" varchar(50),
	"cheque_date" date,
	"bank_name" varchar(100),
	"payment_status" varchar(50) DEFAULT 'completed' NOT NULL,
	"notes" text,
	"recorded_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_code" varchar(50) NOT NULL,
	"batch_id" integer NOT NULL,
	"buyer_id" integer NOT NULL,
	"sale_date" date NOT NULL,
	"total_birds" integer NOT NULL,
	"price_per_bird" numeric(10, 2) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sales_sale_code_unique" UNIQUE("sale_code")
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"attendance_date" date NOT NULL,
	"status" varchar(50) NOT NULL,
	"shift_id" integer,
	"notes" text,
	"recorded_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_attendance_employee_date" UNIQUE("employee_id","attendance_date")
);
--> statement-breakpoint
CREATE TABLE "leave_balances" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"leave_type" varchar(50) NOT NULL,
	"year" integer NOT NULL,
	"total_days" integer NOT NULL,
	"used_days" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_leave_balance_employee_type_year" UNIQUE("employee_id","leave_type","year")
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" serial PRIMARY KEY NOT NULL,
	"shift_name" varchar(100) NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"status" varchar(50) DEFAULT 'active',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shifts_shift_name_unique" UNIQUE("shift_name")
);
--> statement-breakpoint
CREATE TABLE "payroll" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"pay_period" date NOT NULL,
	"base_salary" numeric(12, 2) NOT NULL,
	"working_days" integer NOT NULL,
	"attended_days" integer NOT NULL,
	"overtime_hours" numeric(8, 2) DEFAULT '0',
	"overtime_rate" numeric(10, 2),
	"gross_salary" numeric(12, 2) NOT NULL,
	"net_salary" numeric(12, 2) NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"approved_by" integer,
	"paid_date" date,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_allowances" (
	"id" serial PRIMARY KEY NOT NULL,
	"payroll_id" integer NOT NULL,
	"allowance_type" varchar(100) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"remarks" text
);
--> statement-breakpoint
CREATE TABLE "payroll_deductions" (
	"id" serial PRIMARY KEY NOT NULL,
	"payroll_id" integer NOT NULL,
	"deduction_type" varchar(100) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"remarks" text
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"notification_type" varchar(50) NOT NULL,
	"entity_type" varchar(50),
	"entity_id" integer,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "system_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"config_key" varchar(100) NOT NULL,
	"config_value" jsonb NOT NULL,
	"description" text,
	"updated_by" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_config_config_key_unique" UNIQUE("config_key")
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cages" ADD CONSTRAINT "cages_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_details" ADD CONSTRAINT "bank_details_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_cage_id_cages_id_fk" FOREIGN KEY ("cage_id") REFERENCES "public"."cages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_record_photos" ADD CONSTRAINT "daily_record_photos_daily_record_id_daily_records_id_fk" FOREIGN KEY ("daily_record_id") REFERENCES "public"."daily_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_records" ADD CONSTRAINT "daily_records_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_records" ADD CONSTRAINT "daily_records_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_inventory" ADD CONSTRAINT "feed_inventory_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_recipe_ingredients" ADD CONSTRAINT "feed_recipe_ingredients_recipe_id_feed_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."feed_recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_recipe_ingredients" ADD CONSTRAINT "feed_recipe_ingredients_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_buyer_id_buyers_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."buyers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll" ADD CONSTRAINT "payroll_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll" ADD CONSTRAINT "payroll_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_allowances" ADD CONSTRAINT "payroll_allowances_payroll_id_payroll_id_fk" FOREIGN KEY ("payroll_id") REFERENCES "public"."payroll"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_deductions" ADD CONSTRAINT "payroll_deductions_payroll_id_payroll_id_fk" FOREIGN KEY ("payroll_id") REFERENCES "public"."payroll"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_config" ADD CONSTRAINT "system_config_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_users_firebase_uid" ON "users" USING btree ("firebase_uid");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_user_role" ON "users" USING btree ("user_role");--> statement-breakpoint
CREATE INDEX "idx_cages_site_id" ON "cages" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "idx_cages_status" ON "cages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_employees_site_id" ON "employees" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "idx_employees_designation" ON "employees" USING btree ("designation");--> statement-breakpoint
CREATE INDEX "idx_employees_status" ON "employees" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user_id" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_timestamp" ON "audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_documents_entity" ON "documents" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_batches_site_id" ON "batches" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "idx_batches_status" ON "batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_batches_cage_id" ON "batches" USING btree ("cage_id");--> statement-breakpoint
CREATE INDEX "idx_daily_records_batch_id" ON "daily_records" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_daily_records_record_date" ON "daily_records" USING btree ("record_date");--> statement-breakpoint
CREATE INDEX "idx_vaccinations_batch_id" ON "vaccinations" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_feed_inventory_ingredient" ON "feed_inventory" USING btree ("ingredient_name");--> statement-breakpoint
CREATE INDEX "idx_payments_sale_id" ON "payments" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "idx_payments_payment_status" ON "payments" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "idx_sales_batch_id" ON "sales" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_sales_buyer_id" ON "sales" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "idx_sales_sale_date" ON "sales" USING btree ("sale_date");--> statement-breakpoint
CREATE INDEX "idx_attendance_employee_id" ON "attendance" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_attendance_date" ON "attendance" USING btree ("attendance_date");--> statement-breakpoint
CREATE INDEX "idx_leave_balances_employee_id" ON "leave_balances" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_employee_id" ON "payroll" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_pay_period" ON "payroll" USING btree ("pay_period");--> statement-breakpoint
CREATE INDEX "idx_payroll_status" ON "payroll" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_id" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_is_read" ON "notifications" USING btree ("is_read");