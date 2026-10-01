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
	"inventory_item_id" integer,
	"quantity_used" numeric(10, 2),
	"unit" varchar(20),
	"inventory_cost" numeric(12, 2),
	"notes" text,
	"recorded_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batch_inventory_consumptions" (
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
--> statement-breakpoint
CREATE TABLE "chick_placements" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_id" integer NOT NULL,
	"supplier_id" integer,
	"contract_id" integer,
	"placement_date" date NOT NULL,
	"invoice_reference" varchar(100),
	"delivered_quantity" integer NOT NULL,
	"mortality_on_arrival" integer DEFAULT 0 NOT NULL,
	"accepted_quantity" integer NOT NULL,
	"unit_cost" numeric(12, 2) NOT NULL,
	"batch_opening_cost" numeric(14, 2) NOT NULL,
	"notes" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "feed_inventory" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_type_id" integer NOT NULL,
	"item_code" varchar(50),
	"ingredient_name" varchar(100) NOT NULL,
	"description" text,
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
	"actual_cost" numeric(12, 2),
	"weighted_cost_per_unit" numeric(10, 2),
	"unit" varchar(20) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_recipe_ingredients" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipe_id" integer NOT NULL,
	"inventory_item_id" integer,
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
	"version" integer DEFAULT 1 NOT NULL,
	"parent_recipe_id" integer,
	"target_protein" numeric(5, 2),
	"target_energy" numeric(8, 2),
	"target_fiber" numeric(5, 2),
	"target_calcium" numeric(5, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "feed_recipes_recipe_name_unique" UNIQUE("recipe_name")
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
	"notes" text,
	"lot_id" integer,
	"cost_at_time" numeric(10, 2),
	"performed_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_item_types" (
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
--> statement-breakpoint
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
CREATE TABLE "inventory_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"movement_type" varchar(50) NOT NULL,
	"movement_date" date NOT NULL,
	"source_module" varchar(50) NOT NULL,
	"source_entity_type" varchar(50) NOT NULL,
	"source_entity_id" integer NOT NULL,
	"source_code_snapshot" varchar(100),
	"inventory_item_id" integer,
	"inventory_lot_id" integer,
	"purchase_order_id" integer,
	"purchase_order_item_id" integer,
	"production_batch_id" integer,
	"production_material_id" integer,
	"feed_distribution_id" integer,
	"batch_id" integer,
	"quantity" numeric(12, 2) NOT NULL,
	"unit" varchar(20) NOT NULL,
	"unit_cost" numeric(12, 2),
	"line_cost" numeric(14, 2),
	"balance_after_quantity" numeric(12, 2),
	"balance_scope" varchar(50) NOT NULL,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
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
	"contract_id" integer,
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
CREATE TABLE "service_work_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"work_order_code" varchar(50) NOT NULL,
	"service_type" varchar(50) NOT NULL,
	"title" varchar(200) NOT NULL,
	"supplier_id" integer,
	"contract_id" integer,
	"allocation_type" varchar(50) DEFAULT 'shared_overhead' NOT NULL,
	"site_id" integer,
	"batch_id" integer,
	"service_date" date NOT NULL,
	"invoice_reference" varchar(100),
	"quantity" numeric(10, 2),
	"unit" varchar(20),
	"unit_rate" numeric(12, 2),
	"total_amount" numeric(14, 2) NOT NULL,
	"status" varchar(50) DEFAULT 'pending_approval' NOT NULL,
	"approval_notes" text,
	"approved_by" integer,
	"approved_at" timestamp,
	"finance_account_id" integer,
	"payment_method" varchar(50),
	"reference_number" varchar(100),
	"cheque_leaf_id" integer,
	"cheque_number" varchar(50),
	"supplier_payment_id" integer,
	"treasury_transaction_id" integer,
	"treasury_reversal_transaction_id" integer,
	"requested_by" integer NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_work_orders_work_order_code_unique" UNIQUE("work_order_code")
);
--> statement-breakpoint
CREATE TABLE "site_inventory_consumptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_id" integer NOT NULL,
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
--> statement-breakpoint
CREATE TABLE "supplier_contract_terms" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_id" integer NOT NULL,
	"term_type" varchar(50) NOT NULL,
	"term_key" varchar(100) NOT NULL,
	"term_value" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_code" varchar(50) NOT NULL,
	"supplier_id" integer NOT NULL,
	"contract_type" varchar(50) DEFAULT 'supplier' NOT NULL,
	"contract_title" varchar(200) NOT NULL,
	"description" text,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"currency_code" varchar(10) DEFAULT 'LKR' NOT NULL,
	"payment_terms_days" integer DEFAULT 0 NOT NULL,
	"commercial_terms" text,
	"rate_table" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attachment_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"alert_days_before_expiry" integer DEFAULT 30 NOT NULL,
	"created_by" integer NOT NULL,
	"approved_by" integer,
	"approved_at" timestamp,
	"approval_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_contracts_contract_code_unique" UNIQUE("contract_code")
);
--> statement-breakpoint
CREATE TABLE "supplier_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_code" varchar(50) NOT NULL,
	"supplier_id" integer NOT NULL,
	"purchase_order_id" integer,
	"contract_id" integer,
	"invoice_reference" varchar(100) NOT NULL,
	"invoice_date" date NOT NULL,
	"due_date" date NOT NULL,
	"invoice_amount" numeric(12, 2) NOT NULL,
	"currency_code" varchar(10) DEFAULT 'LKR' NOT NULL,
	"status" varchar(50) DEFAULT 'recorded' NOT NULL,
	"approved_by" integer,
	"approved_at" timestamp,
	"approval_notes" text,
	"notes" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_invoices_invoice_code_unique" UNIQUE("invoice_code")
);
--> statement-breakpoint
CREATE TABLE "supplier_payment_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_payment_id" integer NOT NULL,
	"supplier_invoice_id" integer NOT NULL,
	"allocated_amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_code" varchar(50) NOT NULL,
	"supplier_id" integer NOT NULL,
	"purchase_order_id" integer,
	"payment_date" date NOT NULL,
	"finance_account_id" integer NOT NULL,
	"payment_method" varchar(50) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_status" varchar(50) DEFAULT 'completed' NOT NULL,
	"reference_number" varchar(100),
	"cheque_leaf_id" integer,
	"cheque_number" varchar(50),
	"cheque_date" date,
	"bank_name" varchar(100),
	"treasury_transaction_id" integer,
	"treasury_reversal_transaction_id" integer,
	"notes" text,
	"recorded_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_payments_payment_code_unique" UNIQUE("payment_code")
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
CREATE TABLE "buyer_receipt_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"receipt_line_id" integer NOT NULL,
	"sale_id" integer NOT NULL,
	"allocated_amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buyer_receipt_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"receipt_id" integer NOT NULL,
	"line_sequence" integer NOT NULL,
	"payment_amount" numeric(12, 2) NOT NULL,
	"payment_method" varchar(50) NOT NULL,
	"reference_number" varchar(100),
	"cheque_number" varchar(50),
	"cheque_date" date,
	"bank_name" varchar(100),
	"payment_status" varchar(50) DEFAULT 'completed' NOT NULL,
	"finance_account_id" integer,
	"treasury_transaction_id" integer,
	"treasury_reversal_transaction_id" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buyer_receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"receipt_code" varchar(50) NOT NULL,
	"buyer_id" integer NOT NULL,
	"receipt_date" date NOT NULL,
	"notes" text,
	"recorded_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "buyer_receipts_receipt_code_unique" UNIQUE("receipt_code")
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
CREATE TABLE "sale_lorries" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_id" integer NOT NULL,
	"line_sequence" integer NOT NULL,
	"lorry_number" varchar(100) NOT NULL,
	"birds_count" integer NOT NULL,
	"previous_weight" numeric(10, 2) NOT NULL,
	"loaded_weight" numeric(10, 2) NOT NULL,
	"net_weight" numeric(10, 2) NOT NULL,
	"notes" text,
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
	"total_weight" numeric(10, 2) NOT NULL,
	"price_per_kg" numeric(10, 2) NOT NULL,
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
	"leave_type" varchar(50),
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
	"total_days" numeric(6, 1) NOT NULL,
	"used_days" numeric(6, 1) DEFAULT '0' NOT NULL,
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
CREATE TABLE "payroll" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"pay_period" date NOT NULL,
	"base_salary" numeric(12, 2) NOT NULL,
	"working_days" integer NOT NULL,
	"attended_days" numeric(6, 1) NOT NULL,
	"overtime_hours" numeric(8, 2) DEFAULT '0',
	"overtime_rate" numeric(10, 2),
	"gross_salary" numeric(12, 2) NOT NULL,
	"net_salary" numeric(12, 2) NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"approved_by" integer,
	"paid_date" date,
	"finance_account_id" integer,
	"payment_method" varchar(50),
	"cheque_leaf_id" integer,
	"treasury_transaction_id" integer,
	"compensation_revision_id" integer,
	"compensation_snapshot" jsonb,
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
CREATE TABLE "period_locks" (
	"id" serial PRIMARY KEY NOT NULL,
	"lock_code" varchar(50) NOT NULL,
	"period_start" varchar(10) NOT NULL,
	"period_end" varchar(10) NOT NULL,
	"scope" varchar(50) DEFAULT 'all' NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_by" integer NOT NULL,
	"released_by" integer,
	"released_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "period_locks_lock_code_unique" UNIQUE("lock_code")
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
CREATE TABLE "cheque_books" (
	"id" serial PRIMARY KEY NOT NULL,
	"finance_account_id" integer NOT NULL,
	"book_code" varchar(50) NOT NULL,
	"start_number" integer NOT NULL,
	"end_number" integer NOT NULL,
	"issued_date" date NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cheque_books_book_code_unique" UNIQUE("book_code")
);
--> statement-breakpoint
CREATE TABLE "cheque_leaves" (
	"id" serial PRIMARY KEY NOT NULL,
	"cheque_book_id" integer NOT NULL,
	"finance_account_id" integer NOT NULL,
	"cheque_number" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'available' NOT NULL,
	"issue_date" date,
	"clear_date" date,
	"amount" numeric(12, 2),
	"payee_name" varchar(200),
	"treasury_transaction_id" integer,
	"source_module" varchar(50),
	"source_entity_type" varchar(50),
	"source_entity_id" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cheque_leaves_cheque_number_unique" UNIQUE("cheque_number")
);
--> statement-breakpoint
CREATE TABLE "finance_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_code" varchar(50) NOT NULL,
	"account_name" varchar(100) NOT NULL,
	"account_type" varchar(50) NOT NULL,
	"bank_name" varchar(100),
	"branch_name" varchar(100),
	"account_number_masked" varchar(50),
	"currency_code" varchar(10) DEFAULT 'LKR' NOT NULL,
	"allows_cheque" boolean DEFAULT false NOT NULL,
	"opening_balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"opening_balance_date" date,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "finance_accounts_account_code_unique" UNIQUE("account_code")
);
--> statement-breakpoint
CREATE TABLE "finance_reconciliations" (
	"id" serial PRIMARY KEY NOT NULL,
	"finance_account_id" integer NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"statement_date" date NOT NULL,
	"book_balance" numeric(12, 2) NOT NULL,
	"cleared_balance" numeric(12, 2) NOT NULL,
	"statement_balance" numeric(12, 2) NOT NULL,
	"variance_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" varchar(50) DEFAULT 'closed' NOT NULL,
	"notes" text,
	"created_by" integer NOT NULL,
	"closed_by" integer,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operational_expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"expense_code" varchar(50) NOT NULL,
	"expense_date" date NOT NULL,
	"expense_category" varchar(100) NOT NULL,
	"counterparty_name" varchar(200),
	"allocation_type" varchar(50) DEFAULT 'shared_overhead' NOT NULL,
	"site_id" integer,
	"batch_id" integer,
	"amount" numeric(12, 2) NOT NULL,
	"status" varchar(50) DEFAULT 'pending_approval' NOT NULL,
	"approval_notes" text,
	"approved_by" integer,
	"approved_at" timestamp,
	"finance_account_id" integer,
	"payment_method" varchar(50),
	"reference_number" varchar(100),
	"cheque_leaf_id" integer,
	"cheque_number" varchar(50),
	"cheque_date" date,
	"bank_name" varchar(100),
	"treasury_transaction_id" integer,
	"treasury_reversal_transaction_id" integer,
	"requested_by" integer NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "operational_expenses_expense_code_unique" UNIQUE("expense_code")
);
--> statement-breakpoint
CREATE TABLE "petty_cash_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"allocation_code" varchar(50) NOT NULL,
	"source_finance_account_id" integer NOT NULL,
	"petty_cash_account_id" integer NOT NULL,
	"allocated_to_user_id" integer NOT NULL,
	"site_id" integer,
	"purpose" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"allocation_date" date NOT NULL,
	"status" varchar(50) DEFAULT 'allocated' NOT NULL,
	"treasury_transaction_id" integer NOT NULL,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"review_notes" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "petty_cash_allocations_allocation_code_unique" UNIQUE("allocation_code")
);
--> statement-breakpoint
CREATE TABLE "petty_cash_expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"allocation_id" integer NOT NULL,
	"expense_date" date NOT NULL,
	"expense_category" varchar(100) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"justification" text NOT NULL,
	"status" varchar(50) DEFAULT 'submitted' NOT NULL,
	"treasury_transaction_id" integer,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"review_notes" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treasury_transaction_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"treasury_transaction_id" integer NOT NULL,
	"finance_account_id" integer NOT NULL,
	"entry_direction" varchar(20) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"value_date" date NOT NULL,
	"cleared_at" date,
	"reconciliation_id" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treasury_transaction_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"treasury_transaction_id" integer NOT NULL,
	"source_module" varchar(50) NOT NULL,
	"source_entity_type" varchar(50) NOT NULL,
	"source_entity_id" integer NOT NULL,
	"source_code_snapshot" varchar(100),
	"allocated_amount" numeric(12, 2),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treasury_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_code" varchar(50) NOT NULL,
	"transaction_type" varchar(50) NOT NULL,
	"transaction_date" date NOT NULL,
	"status" varchar(50) DEFAULT 'posted' NOT NULL,
	"reference_number" varchar(100),
	"counterparty_type" varchar(50),
	"counterparty_id" integer,
	"counterparty_name_snapshot" varchar(200),
	"source_module" varchar(50),
	"narrative" text,
	"created_by" integer,
	"approved_by" integer,
	"posted_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "treasury_transactions_transaction_code_unique" UNIQUE("transaction_code")
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cages" ADD CONSTRAINT "cages_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_details" ADD CONSTRAINT "bank_details_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_compensation" ADD CONSTRAINT "employee_compensation_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_compensation_components" ADD CONSTRAINT "employee_compensation_components_revision_id_employee_compensation_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."employee_compensation_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_compensation_revisions" ADD CONSTRAINT "employee_compensation_revisions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "batch_inventory_consumptions" ADD CONSTRAINT "batch_inventory_consumptions_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_inventory_consumptions" ADD CONSTRAINT "batch_inventory_consumptions_inventory_item_id_feed_inventory_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."feed_inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_inventory_consumptions" ADD CONSTRAINT "batch_inventory_consumptions_inventory_lot_id_inventory_lots_id_fk" FOREIGN KEY ("inventory_lot_id") REFERENCES "public"."inventory_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_inventory_consumptions" ADD CONSTRAINT "batch_inventory_consumptions_purchase_order_item_id_purchase_order_items_id_fk" FOREIGN KEY ("purchase_order_item_id") REFERENCES "public"."purchase_order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_inventory_consumptions" ADD CONSTRAINT "batch_inventory_consumptions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chick_placements" ADD CONSTRAINT "chick_placements_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chick_placements" ADD CONSTRAINT "chick_placements_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chick_placements" ADD CONSTRAINT "chick_placements_contract_id_supplier_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."supplier_contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chick_placements" ADD CONSTRAINT "chick_placements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_distributions" ADD CONSTRAINT "feed_distributions_production_batch_id_feed_production_batches_id_fk" FOREIGN KEY ("production_batch_id") REFERENCES "public"."feed_production_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_distributions" ADD CONSTRAINT "feed_distributions_farm_batch_id_batches_id_fk" FOREIGN KEY ("farm_batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_inventory" ADD CONSTRAINT "feed_inventory_item_type_id_inventory_item_types_id_fk" FOREIGN KEY ("item_type_id") REFERENCES "public"."inventory_item_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_inventory" ADD CONSTRAINT "feed_inventory_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_production_batches" ADD CONSTRAINT "feed_production_batches_recipe_id_feed_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."feed_recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_production_batches" ADD CONSTRAINT "feed_production_batches_qc_passed_by_users_id_fk" FOREIGN KEY ("qc_passed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_production_materials" ADD CONSTRAINT "feed_production_materials_production_batch_id_feed_production_batches_id_fk" FOREIGN KEY ("production_batch_id") REFERENCES "public"."feed_production_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_production_materials" ADD CONSTRAINT "feed_production_materials_inventory_item_id_feed_inventory_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."feed_inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_recipe_ingredients" ADD CONSTRAINT "feed_recipe_ingredients_recipe_id_feed_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."feed_recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_recipe_ingredients" ADD CONSTRAINT "feed_recipe_ingredients_inventory_item_id_feed_inventory_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."feed_inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_recipe_ingredients" ADD CONSTRAINT "feed_recipe_ingredients_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_alerts" ADD CONSTRAINT "inventory_alerts_inventory_item_id_feed_inventory_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."feed_inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_alerts" ADD CONSTRAINT "inventory_alerts_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_audit_trail" ADD CONSTRAINT "inventory_audit_trail_inventory_item_id_feed_inventory_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."feed_inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_audit_trail" ADD CONSTRAINT "inventory_audit_trail_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_inventory_item_id_feed_inventory_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."feed_inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_purchase_order_item_id_purchase_order_items_id_fk" FOREIGN KEY ("purchase_order_item_id") REFERENCES "public"."purchase_order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_inventory_item_id_feed_inventory_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."feed_inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_inventory_lot_id_inventory_lots_id_fk" FOREIGN KEY ("inventory_lot_id") REFERENCES "public"."inventory_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_purchase_order_item_id_purchase_order_items_id_fk" FOREIGN KEY ("purchase_order_item_id") REFERENCES "public"."purchase_order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_production_batch_id_feed_production_batches_id_fk" FOREIGN KEY ("production_batch_id") REFERENCES "public"."feed_production_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_production_material_id_feed_production_materials_id_fk" FOREIGN KEY ("production_material_id") REFERENCES "public"."feed_production_materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_feed_distribution_id_feed_distributions_id_fk" FOREIGN KEY ("feed_distribution_id") REFERENCES "public"."feed_distributions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_material_lots" ADD CONSTRAINT "production_material_lots_production_material_id_feed_production_materials_id_fk" FOREIGN KEY ("production_material_id") REFERENCES "public"."feed_production_materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_material_lots" ADD CONSTRAINT "production_material_lots_inventory_lot_id_inventory_lots_id_fk" FOREIGN KEY ("inventory_lot_id") REFERENCES "public"."inventory_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_inventory_item_id_feed_inventory_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."feed_inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_contract_id_supplier_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."supplier_contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_work_orders" ADD CONSTRAINT "service_work_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_work_orders" ADD CONSTRAINT "service_work_orders_contract_id_supplier_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."supplier_contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_work_orders" ADD CONSTRAINT "service_work_orders_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_work_orders" ADD CONSTRAINT "service_work_orders_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_work_orders" ADD CONSTRAINT "service_work_orders_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_work_orders" ADD CONSTRAINT "service_work_orders_finance_account_id_finance_accounts_id_fk" FOREIGN KEY ("finance_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_work_orders" ADD CONSTRAINT "service_work_orders_cheque_leaf_id_cheque_leaves_id_fk" FOREIGN KEY ("cheque_leaf_id") REFERENCES "public"."cheque_leaves"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_work_orders" ADD CONSTRAINT "service_work_orders_supplier_payment_id_supplier_payments_id_fk" FOREIGN KEY ("supplier_payment_id") REFERENCES "public"."supplier_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_work_orders" ADD CONSTRAINT "service_work_orders_treasury_transaction_id_treasury_transactions_id_fk" FOREIGN KEY ("treasury_transaction_id") REFERENCES "public"."treasury_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_work_orders" ADD CONSTRAINT "service_work_orders_treasury_reversal_transaction_id_treasury_transactions_id_fk" FOREIGN KEY ("treasury_reversal_transaction_id") REFERENCES "public"."treasury_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_work_orders" ADD CONSTRAINT "service_work_orders_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_inventory_consumptions" ADD CONSTRAINT "site_inventory_consumptions_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_inventory_consumptions" ADD CONSTRAINT "site_inventory_consumptions_inventory_item_id_feed_inventory_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."feed_inventory"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_inventory_consumptions" ADD CONSTRAINT "site_inventory_consumptions_inventory_lot_id_inventory_lots_id_fk" FOREIGN KEY ("inventory_lot_id") REFERENCES "public"."inventory_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_inventory_consumptions" ADD CONSTRAINT "site_inventory_consumptions_purchase_order_item_id_purchase_order_items_id_fk" FOREIGN KEY ("purchase_order_item_id") REFERENCES "public"."purchase_order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_inventory_consumptions" ADD CONSTRAINT "site_inventory_consumptions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_contract_terms" ADD CONSTRAINT "supplier_contract_terms_contract_id_supplier_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."supplier_contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_contracts" ADD CONSTRAINT "supplier_contracts_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_contracts" ADD CONSTRAINT "supplier_contracts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_contracts" ADD CONSTRAINT "supplier_contracts_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_contract_id_supplier_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."supplier_contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payment_allocations" ADD CONSTRAINT "supplier_payment_allocations_supplier_payment_id_supplier_payments_id_fk" FOREIGN KEY ("supplier_payment_id") REFERENCES "public"."supplier_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payment_allocations" ADD CONSTRAINT "supplier_payment_allocations_supplier_invoice_id_supplier_invoices_id_fk" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_finance_account_id_finance_accounts_id_fk" FOREIGN KEY ("finance_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_cheque_leaf_id_cheque_leaves_id_fk" FOREIGN KEY ("cheque_leaf_id") REFERENCES "public"."cheque_leaves"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_treasury_transaction_id_treasury_transactions_id_fk" FOREIGN KEY ("treasury_transaction_id") REFERENCES "public"."treasury_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_treasury_reversal_transaction_id_treasury_transactions_id_fk" FOREIGN KEY ("treasury_reversal_transaction_id") REFERENCES "public"."treasury_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_receipt_allocations" ADD CONSTRAINT "buyer_receipt_allocations_receipt_line_id_buyer_receipt_lines_id_fk" FOREIGN KEY ("receipt_line_id") REFERENCES "public"."buyer_receipt_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_receipt_allocations" ADD CONSTRAINT "buyer_receipt_allocations_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_receipt_lines" ADD CONSTRAINT "buyer_receipt_lines_receipt_id_buyer_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."buyer_receipts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_receipt_lines" ADD CONSTRAINT "buyer_receipt_lines_finance_account_id_finance_accounts_id_fk" FOREIGN KEY ("finance_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_receipt_lines" ADD CONSTRAINT "buyer_receipt_lines_treasury_transaction_id_treasury_transactions_id_fk" FOREIGN KEY ("treasury_transaction_id") REFERENCES "public"."treasury_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_receipt_lines" ADD CONSTRAINT "buyer_receipt_lines_treasury_reversal_transaction_id_treasury_transactions_id_fk" FOREIGN KEY ("treasury_reversal_transaction_id") REFERENCES "public"."treasury_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_receipts" ADD CONSTRAINT "buyer_receipts_buyer_id_buyers_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."buyers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_receipts" ADD CONSTRAINT "buyer_receipts_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_lorries" ADD CONSTRAINT "sale_lorries_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_buyer_id_buyers_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."buyers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll" ADD CONSTRAINT "payroll_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll" ADD CONSTRAINT "payroll_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll" ADD CONSTRAINT "payroll_finance_account_id_finance_accounts_id_fk" FOREIGN KEY ("finance_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll" ADD CONSTRAINT "payroll_cheque_leaf_id_cheque_leaves_id_fk" FOREIGN KEY ("cheque_leaf_id") REFERENCES "public"."cheque_leaves"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll" ADD CONSTRAINT "payroll_treasury_transaction_id_treasury_transactions_id_fk" FOREIGN KEY ("treasury_transaction_id") REFERENCES "public"."treasury_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll" ADD CONSTRAINT "payroll_compensation_revision_id_employee_compensation_revisions_id_fk" FOREIGN KEY ("compensation_revision_id") REFERENCES "public"."employee_compensation_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_allowances" ADD CONSTRAINT "payroll_allowances_payroll_id_payroll_id_fk" FOREIGN KEY ("payroll_id") REFERENCES "public"."payroll"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_deductions" ADD CONSTRAINT "payroll_deductions_payroll_id_payroll_id_fk" FOREIGN KEY ("payroll_id") REFERENCES "public"."payroll"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_locks" ADD CONSTRAINT "period_locks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_locks" ADD CONSTRAINT "period_locks_released_by_users_id_fk" FOREIGN KEY ("released_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_config" ADD CONSTRAINT "system_config_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheque_books" ADD CONSTRAINT "cheque_books_finance_account_id_finance_accounts_id_fk" FOREIGN KEY ("finance_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheque_books" ADD CONSTRAINT "cheque_books_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheque_leaves" ADD CONSTRAINT "cheque_leaves_cheque_book_id_cheque_books_id_fk" FOREIGN KEY ("cheque_book_id") REFERENCES "public"."cheque_books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheque_leaves" ADD CONSTRAINT "cheque_leaves_finance_account_id_finance_accounts_id_fk" FOREIGN KEY ("finance_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheque_leaves" ADD CONSTRAINT "cheque_leaves_treasury_transaction_id_treasury_transactions_id_fk" FOREIGN KEY ("treasury_transaction_id") REFERENCES "public"."treasury_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_accounts" ADD CONSTRAINT "finance_accounts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_reconciliations" ADD CONSTRAINT "finance_reconciliations_finance_account_id_finance_accounts_id_fk" FOREIGN KEY ("finance_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_reconciliations" ADD CONSTRAINT "finance_reconciliations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_reconciliations" ADD CONSTRAINT "finance_reconciliations_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_expenses" ADD CONSTRAINT "operational_expenses_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_expenses" ADD CONSTRAINT "operational_expenses_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_expenses" ADD CONSTRAINT "operational_expenses_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_expenses" ADD CONSTRAINT "operational_expenses_finance_account_id_finance_accounts_id_fk" FOREIGN KEY ("finance_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_expenses" ADD CONSTRAINT "operational_expenses_cheque_leaf_id_cheque_leaves_id_fk" FOREIGN KEY ("cheque_leaf_id") REFERENCES "public"."cheque_leaves"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_expenses" ADD CONSTRAINT "operational_expenses_treasury_transaction_id_treasury_transactions_id_fk" FOREIGN KEY ("treasury_transaction_id") REFERENCES "public"."treasury_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_expenses" ADD CONSTRAINT "operational_expenses_treasury_reversal_transaction_id_treasury_transactions_id_fk" FOREIGN KEY ("treasury_reversal_transaction_id") REFERENCES "public"."treasury_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_expenses" ADD CONSTRAINT "operational_expenses_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petty_cash_allocations" ADD CONSTRAINT "petty_cash_allocations_source_finance_account_id_finance_accounts_id_fk" FOREIGN KEY ("source_finance_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petty_cash_allocations" ADD CONSTRAINT "petty_cash_allocations_petty_cash_account_id_finance_accounts_id_fk" FOREIGN KEY ("petty_cash_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petty_cash_allocations" ADD CONSTRAINT "petty_cash_allocations_allocated_to_user_id_users_id_fk" FOREIGN KEY ("allocated_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petty_cash_allocations" ADD CONSTRAINT "petty_cash_allocations_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petty_cash_allocations" ADD CONSTRAINT "petty_cash_allocations_treasury_transaction_id_treasury_transactions_id_fk" FOREIGN KEY ("treasury_transaction_id") REFERENCES "public"."treasury_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petty_cash_allocations" ADD CONSTRAINT "petty_cash_allocations_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petty_cash_allocations" ADD CONSTRAINT "petty_cash_allocations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petty_cash_expenses" ADD CONSTRAINT "petty_cash_expenses_allocation_id_petty_cash_allocations_id_fk" FOREIGN KEY ("allocation_id") REFERENCES "public"."petty_cash_allocations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petty_cash_expenses" ADD CONSTRAINT "petty_cash_expenses_treasury_transaction_id_treasury_transactions_id_fk" FOREIGN KEY ("treasury_transaction_id") REFERENCES "public"."treasury_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petty_cash_expenses" ADD CONSTRAINT "petty_cash_expenses_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petty_cash_expenses" ADD CONSTRAINT "petty_cash_expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_transaction_entries" ADD CONSTRAINT "treasury_transaction_entries_treasury_transaction_id_treasury_transactions_id_fk" FOREIGN KEY ("treasury_transaction_id") REFERENCES "public"."treasury_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_transaction_entries" ADD CONSTRAINT "treasury_transaction_entries_finance_account_id_finance_accounts_id_fk" FOREIGN KEY ("finance_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_transaction_entries" ADD CONSTRAINT "treasury_transaction_entries_reconciliation_id_finance_reconciliations_id_fk" FOREIGN KEY ("reconciliation_id") REFERENCES "public"."finance_reconciliations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_transaction_links" ADD CONSTRAINT "treasury_transaction_links_treasury_transaction_id_treasury_transactions_id_fk" FOREIGN KEY ("treasury_transaction_id") REFERENCES "public"."treasury_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_transactions" ADD CONSTRAINT "treasury_transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_transactions" ADD CONSTRAINT "treasury_transactions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_transactions" ADD CONSTRAINT "treasury_transactions_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_users_firebase_uid" ON "users" USING btree ("firebase_uid");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_user_role" ON "users" USING btree ("user_role");--> statement-breakpoint
CREATE INDEX "idx_cages_site_id" ON "cages" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "idx_cages_status" ON "cages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_employee_compensation_employee_id" ON "employee_compensation" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_employee_compensation_pay_type" ON "employee_compensation" USING btree ("pay_type");--> statement-breakpoint
CREATE INDEX "idx_employee_comp_components_revision_id" ON "employee_compensation_components" USING btree ("revision_id");--> statement-breakpoint
CREATE INDEX "idx_employee_comp_components_type" ON "employee_compensation_components" USING btree ("component_type");--> statement-breakpoint
CREATE INDEX "idx_employee_comp_components_active" ON "employee_compensation_components" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_employee_comp_revisions_employee_id" ON "employee_compensation_revisions" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_employee_comp_revisions_effective_from" ON "employee_compensation_revisions" USING btree ("effective_from");--> statement-breakpoint
CREATE INDEX "idx_employee_comp_revisions_effective_to" ON "employee_compensation_revisions" USING btree ("effective_to");--> statement-breakpoint
CREATE INDEX "idx_employee_comp_revisions_active" ON "employee_compensation_revisions" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_employee_comp_revisions_employee_effective_from_unique" ON "employee_compensation_revisions" USING btree ("employee_id","effective_from");--> statement-breakpoint
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
CREATE INDEX "idx_vaccinations_inventory_item" ON "vaccinations" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "idx_batch_inventory_consumptions_batch" ON "batch_inventory_consumptions" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_batch_inventory_consumptions_item" ON "batch_inventory_consumptions" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "idx_batch_inventory_consumptions_lot" ON "batch_inventory_consumptions" USING btree ("inventory_lot_id");--> statement-breakpoint
CREATE INDEX "idx_chick_placements_batch" ON "chick_placements" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_chick_placements_supplier" ON "chick_placements" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_chick_placements_contract" ON "chick_placements" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "idx_chick_placements_date" ON "chick_placements" USING btree ("placement_date");--> statement-breakpoint
CREATE INDEX "idx_feed_dist_farm_batch" ON "feed_distributions" USING btree ("farm_batch_id");--> statement-breakpoint
CREATE INDEX "idx_feed_dist_date" ON "feed_distributions" USING btree ("distribution_date");--> statement-breakpoint
CREATE INDEX "idx_feed_inventory_ingredient" ON "feed_inventory" USING btree ("ingredient_name");--> statement-breakpoint
CREATE INDEX "idx_feed_inventory_item_type" ON "feed_inventory" USING btree ("item_type_id");--> statement-breakpoint
CREATE INDEX "idx_feed_inventory_item_code" ON "feed_inventory" USING btree ("item_code");--> statement-breakpoint
CREATE INDEX "idx_feed_prod_status" ON "feed_production_batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_feed_prod_date" ON "feed_production_batches" USING btree ("production_date");--> statement-breakpoint
CREATE INDEX "idx_feed_prod_recipe" ON "feed_production_batches" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "idx_inv_alerts_item" ON "inventory_alerts" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "idx_inv_alerts_status" ON "inventory_alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_inv_audit_item" ON "inventory_audit_trail" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "idx_inv_audit_date" ON "inventory_audit_trail" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_inventory_item_types_code" ON "inventory_item_types" USING btree ("type_code");--> statement-breakpoint
CREATE INDEX "idx_inventory_item_types_category" ON "inventory_item_types" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_inventory_item_types_feed" ON "inventory_item_types" USING btree ("is_feed");--> statement-breakpoint
CREATE INDEX "idx_lots_inventory_item" ON "inventory_lots" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "idx_lots_remaining" ON "inventory_lots" USING btree ("remaining_quantity");--> statement-breakpoint
CREATE INDEX "idx_lots_received_date" ON "inventory_lots" USING btree ("received_date");--> statement-breakpoint
CREATE INDEX "idx_inventory_movements_date" ON "inventory_movements" USING btree ("movement_date");--> statement-breakpoint
CREATE INDEX "idx_inventory_movements_type" ON "inventory_movements" USING btree ("movement_type");--> statement-breakpoint
CREATE INDEX "idx_inventory_movements_item" ON "inventory_movements" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_movements_lot" ON "inventory_movements" USING btree ("inventory_lot_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_movements_batch" ON "inventory_movements" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_movements_source" ON "inventory_movements" USING btree ("source_module","source_entity_type","source_entity_id");--> statement-breakpoint
CREATE INDEX "idx_pml_material" ON "production_material_lots" USING btree ("production_material_id");--> statement-breakpoint
CREATE INDEX "idx_pml_lot" ON "production_material_lots" USING btree ("inventory_lot_id");--> statement-breakpoint
CREATE INDEX "idx_poi_order" ON "purchase_order_items" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "idx_poi_inventory" ON "purchase_order_items" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "idx_po_status" ON "purchase_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_po_supplier" ON "purchase_orders" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_po_order_date" ON "purchase_orders" USING btree ("order_date");--> statement-breakpoint
CREATE INDEX "idx_report_sched_type" ON "report_schedules" USING btree ("report_type");--> statement-breakpoint
CREATE INDEX "idx_report_sched_active" ON "report_schedules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_service_work_orders_type" ON "service_work_orders" USING btree ("service_type");--> statement-breakpoint
CREATE INDEX "idx_service_work_orders_status" ON "service_work_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_service_work_orders_supplier" ON "service_work_orders" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_service_work_orders_contract" ON "service_work_orders" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "idx_service_work_orders_site" ON "service_work_orders" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "idx_service_work_orders_batch" ON "service_work_orders" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_service_work_orders_date" ON "service_work_orders" USING btree ("service_date");--> statement-breakpoint
CREATE INDEX "idx_site_inventory_consumptions_site" ON "site_inventory_consumptions" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "idx_site_inventory_consumptions_item" ON "site_inventory_consumptions" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "idx_site_inventory_consumptions_lot" ON "site_inventory_consumptions" USING btree ("inventory_lot_id");--> statement-breakpoint
CREATE INDEX "idx_site_inventory_consumptions_date" ON "site_inventory_consumptions" USING btree ("consumption_date");--> statement-breakpoint
CREATE INDEX "idx_supplier_contract_terms_contract" ON "supplier_contract_terms" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_contract_terms_type" ON "supplier_contract_terms" USING btree ("term_type");--> statement-breakpoint
CREATE INDEX "idx_supplier_contracts_supplier" ON "supplier_contracts" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_contracts_status" ON "supplier_contracts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_supplier_contracts_validity" ON "supplier_contracts" USING btree ("valid_from","valid_to");--> statement-breakpoint
CREATE INDEX "idx_supplier_invoices_supplier" ON "supplier_invoices" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_invoices_po" ON "supplier_invoices" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_invoices_contract" ON "supplier_invoices" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_invoices_due_date" ON "supplier_invoices" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_supplier_invoices_status" ON "supplier_invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_supplier_payment_allocations_payment" ON "supplier_payment_allocations" USING btree ("supplier_payment_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_payment_allocations_invoice" ON "supplier_payment_allocations" USING btree ("supplier_invoice_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_payments_supplier" ON "supplier_payments" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_payments_po" ON "supplier_payments" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_payments_status" ON "supplier_payments" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "idx_supplier_payments_date" ON "supplier_payments" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "idx_buyer_receipt_allocations_line_id" ON "buyer_receipt_allocations" USING btree ("receipt_line_id");--> statement-breakpoint
CREATE INDEX "idx_buyer_receipt_allocations_sale_id" ON "buyer_receipt_allocations" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "idx_buyer_receipt_lines_receipt_id" ON "buyer_receipt_lines" USING btree ("receipt_id");--> statement-breakpoint
CREATE INDEX "idx_buyer_receipt_lines_payment_status" ON "buyer_receipt_lines" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "idx_buyer_receipts_buyer_id" ON "buyer_receipts" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "idx_buyer_receipts_receipt_date" ON "buyer_receipts" USING btree ("receipt_date");--> statement-breakpoint
CREATE INDEX "idx_payments_sale_id" ON "payments" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "idx_payments_payment_status" ON "payments" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "idx_sale_lorries_sale_id" ON "sale_lorries" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "idx_sales_batch_id" ON "sales" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_sales_buyer_id" ON "sales" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "idx_sales_sale_date" ON "sales" USING btree ("sale_date");--> statement-breakpoint
CREATE INDEX "idx_attendance_employee_id" ON "attendance" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_attendance_date" ON "attendance" USING btree ("attendance_date");--> statement-breakpoint
CREATE INDEX "idx_leave_balances_employee_id" ON "leave_balances" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_compensation_templates_category" ON "compensation_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_compensation_templates_active" ON "compensation_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_payroll_employee_id" ON "payroll" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_pay_period" ON "payroll" USING btree ("pay_period");--> statement-breakpoint
CREATE INDEX "idx_payroll_status" ON "payroll" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_payroll_compensation_revision_id" ON "payroll" USING btree ("compensation_revision_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_id" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_is_read" ON "notifications" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "idx_period_locks_period" ON "period_locks" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "idx_period_locks_scope" ON "period_locks" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "idx_period_locks_status" ON "period_locks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_cheque_books_account" ON "cheque_books" USING btree ("finance_account_id");--> statement-breakpoint
CREATE INDEX "idx_cheque_books_status" ON "cheque_books" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_cheque_leaves_book" ON "cheque_leaves" USING btree ("cheque_book_id");--> statement-breakpoint
CREATE INDEX "idx_cheque_leaves_account" ON "cheque_leaves" USING btree ("finance_account_id");--> statement-breakpoint
CREATE INDEX "idx_cheque_leaves_status" ON "cheque_leaves" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_cheque_leaves_source" ON "cheque_leaves" USING btree ("source_module","source_entity_type","source_entity_id");--> statement-breakpoint
CREATE INDEX "idx_finance_accounts_type" ON "finance_accounts" USING btree ("account_type");--> statement-breakpoint
CREATE INDEX "idx_finance_accounts_status" ON "finance_accounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_finance_reconciliations_account" ON "finance_reconciliations" USING btree ("finance_account_id");--> statement-breakpoint
CREATE INDEX "idx_finance_reconciliations_period" ON "finance_reconciliations" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "idx_finance_reconciliations_statement_date" ON "finance_reconciliations" USING btree ("statement_date");--> statement-breakpoint
CREATE INDEX "idx_finance_reconciliations_status" ON "finance_reconciliations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_operational_expenses_date" ON "operational_expenses" USING btree ("expense_date");--> statement-breakpoint
CREATE INDEX "idx_operational_expenses_category" ON "operational_expenses" USING btree ("expense_category");--> statement-breakpoint
CREATE INDEX "idx_operational_expenses_status" ON "operational_expenses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_operational_expenses_site" ON "operational_expenses" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "idx_operational_expenses_batch" ON "operational_expenses" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_operational_expenses_account" ON "operational_expenses" USING btree ("finance_account_id");--> statement-breakpoint
CREATE INDEX "idx_petty_cash_allocations_code" ON "petty_cash_allocations" USING btree ("allocation_code");--> statement-breakpoint
CREATE INDEX "idx_petty_cash_allocations_account" ON "petty_cash_allocations" USING btree ("petty_cash_account_id");--> statement-breakpoint
CREATE INDEX "idx_petty_cash_allocations_user" ON "petty_cash_allocations" USING btree ("allocated_to_user_id");--> statement-breakpoint
CREATE INDEX "idx_petty_cash_allocations_status" ON "petty_cash_allocations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_petty_cash_expenses_allocation" ON "petty_cash_expenses" USING btree ("allocation_id");--> statement-breakpoint
CREATE INDEX "idx_petty_cash_expenses_status" ON "petty_cash_expenses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_petty_cash_expenses_date" ON "petty_cash_expenses" USING btree ("expense_date");--> statement-breakpoint
CREATE INDEX "idx_treasury_entries_transaction" ON "treasury_transaction_entries" USING btree ("treasury_transaction_id");--> statement-breakpoint
CREATE INDEX "idx_treasury_entries_account" ON "treasury_transaction_entries" USING btree ("finance_account_id");--> statement-breakpoint
CREATE INDEX "idx_treasury_entries_value_date" ON "treasury_transaction_entries" USING btree ("value_date");--> statement-breakpoint
CREATE INDEX "idx_treasury_entries_cleared_at" ON "treasury_transaction_entries" USING btree ("cleared_at");--> statement-breakpoint
CREATE INDEX "idx_treasury_entries_reconciliation" ON "treasury_transaction_entries" USING btree ("reconciliation_id");--> statement-breakpoint
CREATE INDEX "idx_treasury_links_transaction" ON "treasury_transaction_links" USING btree ("treasury_transaction_id");--> statement-breakpoint
CREATE INDEX "idx_treasury_links_source" ON "treasury_transaction_links" USING btree ("source_module","source_entity_type","source_entity_id");--> statement-breakpoint
CREATE INDEX "idx_treasury_transactions_date" ON "treasury_transactions" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "idx_treasury_transactions_type" ON "treasury_transactions" USING btree ("transaction_type");--> statement-breakpoint
CREATE INDEX "idx_treasury_transactions_status" ON "treasury_transactions" USING btree ("status");