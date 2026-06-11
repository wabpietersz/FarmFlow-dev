CREATE TABLE IF NOT EXISTS "sale_lorries" (
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

CREATE TABLE IF NOT EXISTS "buyer_receipts" (
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

CREATE TABLE IF NOT EXISTS "buyer_receipt_lines" (
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
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "buyer_receipt_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"receipt_line_id" integer NOT NULL,
	"sale_id" integer NOT NULL,
	"allocated_amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "sale_lorries" ADD CONSTRAINT "sale_lorries_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "buyer_receipts" ADD CONSTRAINT "buyer_receipts_buyer_id_buyers_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."buyers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "buyer_receipts" ADD CONSTRAINT "buyer_receipts_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "buyer_receipt_lines" ADD CONSTRAINT "buyer_receipt_lines_receipt_id_buyer_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."buyer_receipts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "buyer_receipt_allocations" ADD CONSTRAINT "buyer_receipt_allocations_receipt_line_id_buyer_receipt_lines_id_fk" FOREIGN KEY ("receipt_line_id") REFERENCES "public"."buyer_receipt_lines"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "buyer_receipt_allocations" ADD CONSTRAINT "buyer_receipt_allocations_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "idx_sale_lorries_sale_id" ON "sale_lorries" USING btree ("sale_id");
CREATE INDEX IF NOT EXISTS "idx_buyer_receipts_buyer_id" ON "buyer_receipts" USING btree ("buyer_id");
CREATE INDEX IF NOT EXISTS "idx_buyer_receipts_receipt_date" ON "buyer_receipts" USING btree ("receipt_date");
CREATE INDEX IF NOT EXISTS "idx_buyer_receipt_lines_receipt_id" ON "buyer_receipt_lines" USING btree ("receipt_id");
CREATE INDEX IF NOT EXISTS "idx_buyer_receipt_lines_payment_status" ON "buyer_receipt_lines" USING btree ("payment_status");
CREATE INDEX IF NOT EXISTS "idx_buyer_receipt_allocations_line_id" ON "buyer_receipt_allocations" USING btree ("receipt_line_id");
CREATE INDEX IF NOT EXISTS "idx_buyer_receipt_allocations_sale_id" ON "buyer_receipt_allocations" USING btree ("sale_id");
