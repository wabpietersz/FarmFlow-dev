ALTER TABLE "payroll" ADD COLUMN IF NOT EXISTS "payment_method" varchar(50);
ALTER TABLE "payroll" ADD COLUMN IF NOT EXISTS "cheque_leaf_id" integer;

CREATE TABLE IF NOT EXISTS "cheque_books" (
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

CREATE TABLE IF NOT EXISTS "cheque_leaves" (
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

CREATE TABLE IF NOT EXISTS "supplier_payments" (
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

DO $$ BEGIN
 ALTER TABLE "payroll" ADD CONSTRAINT "payroll_cheque_leaf_id_cheque_leaves_id_fk" FOREIGN KEY ("cheque_leaf_id") REFERENCES "public"."cheque_leaves"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "cheque_books" ADD CONSTRAINT "cheque_books_finance_account_id_finance_accounts_id_fk" FOREIGN KEY ("finance_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "cheque_books" ADD CONSTRAINT "cheque_books_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "cheque_leaves" ADD CONSTRAINT "cheque_leaves_cheque_book_id_cheque_books_id_fk" FOREIGN KEY ("cheque_book_id") REFERENCES "public"."cheque_books"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "cheque_leaves" ADD CONSTRAINT "cheque_leaves_finance_account_id_finance_accounts_id_fk" FOREIGN KEY ("finance_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "cheque_leaves" ADD CONSTRAINT "cheque_leaves_treasury_transaction_id_treasury_transactions_id_fk" FOREIGN KEY ("treasury_transaction_id") REFERENCES "public"."treasury_transactions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_finance_account_id_finance_accounts_id_fk" FOREIGN KEY ("finance_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_cheque_leaf_id_cheque_leaves_id_fk" FOREIGN KEY ("cheque_leaf_id") REFERENCES "public"."cheque_leaves"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_treasury_transaction_id_treasury_transactions_id_fk" FOREIGN KEY ("treasury_transaction_id") REFERENCES "public"."treasury_transactions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_treasury_reversal_transaction_id_treasury_transactions_id_fk" FOREIGN KEY ("treasury_reversal_transaction_id") REFERENCES "public"."treasury_transactions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "idx_cheque_books_account" ON "cheque_books" USING btree ("finance_account_id");
CREATE INDEX IF NOT EXISTS "idx_cheque_books_status" ON "cheque_books" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_cheque_leaves_book" ON "cheque_leaves" USING btree ("cheque_book_id");
CREATE INDEX IF NOT EXISTS "idx_cheque_leaves_account" ON "cheque_leaves" USING btree ("finance_account_id");
CREATE INDEX IF NOT EXISTS "idx_cheque_leaves_status" ON "cheque_leaves" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_cheque_leaves_source" ON "cheque_leaves" USING btree ("source_module", "source_entity_type", "source_entity_id");
CREATE INDEX IF NOT EXISTS "idx_supplier_payments_supplier" ON "supplier_payments" USING btree ("supplier_id");
CREATE INDEX IF NOT EXISTS "idx_supplier_payments_po" ON "supplier_payments" USING btree ("purchase_order_id");
CREATE INDEX IF NOT EXISTS "idx_supplier_payments_status" ON "supplier_payments" USING btree ("payment_status");
CREATE INDEX IF NOT EXISTS "idx_supplier_payments_date" ON "supplier_payments" USING btree ("payment_date");
