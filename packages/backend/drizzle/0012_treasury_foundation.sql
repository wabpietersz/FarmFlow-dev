CREATE TABLE IF NOT EXISTS "finance_accounts" (
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

CREATE TABLE IF NOT EXISTS "treasury_transactions" (
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

CREATE TABLE IF NOT EXISTS "treasury_transaction_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"treasury_transaction_id" integer NOT NULL,
	"finance_account_id" integer NOT NULL,
	"entry_direction" varchar(20) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"value_date" date NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "treasury_transaction_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"treasury_transaction_id" integer NOT NULL,
	"source_module" varchar(50) NOT NULL,
	"source_entity_type" varchar(50) NOT NULL,
	"source_entity_id" integer NOT NULL,
	"source_code_snapshot" varchar(100),
	"allocated_amount" numeric(12, 2),
	"created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "buyer_receipt_lines" ADD COLUMN IF NOT EXISTS "finance_account_id" integer;
ALTER TABLE "buyer_receipt_lines" ADD COLUMN IF NOT EXISTS "treasury_transaction_id" integer;
ALTER TABLE "buyer_receipt_lines" ADD COLUMN IF NOT EXISTS "treasury_reversal_transaction_id" integer;

DO $$ BEGIN
 ALTER TABLE "finance_accounts" ADD CONSTRAINT "finance_accounts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "treasury_transactions" ADD CONSTRAINT "treasury_transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "treasury_transactions" ADD CONSTRAINT "treasury_transactions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "treasury_transactions" ADD CONSTRAINT "treasury_transactions_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "treasury_transaction_entries" ADD CONSTRAINT "treasury_transaction_entries_treasury_transaction_id_treasury_transactions_id_fk" FOREIGN KEY ("treasury_transaction_id") REFERENCES "public"."treasury_transactions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "treasury_transaction_entries" ADD CONSTRAINT "treasury_transaction_entries_finance_account_id_finance_accounts_id_fk" FOREIGN KEY ("finance_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "treasury_transaction_links" ADD CONSTRAINT "treasury_transaction_links_treasury_transaction_id_treasury_transactions_id_fk" FOREIGN KEY ("treasury_transaction_id") REFERENCES "public"."treasury_transactions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "buyer_receipt_lines" ADD CONSTRAINT "buyer_receipt_lines_finance_account_id_finance_accounts_id_fk" FOREIGN KEY ("finance_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "buyer_receipt_lines" ADD CONSTRAINT "buyer_receipt_lines_treasury_transaction_id_treasury_transactions_id_fk" FOREIGN KEY ("treasury_transaction_id") REFERENCES "public"."treasury_transactions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "buyer_receipt_lines" ADD CONSTRAINT "buyer_receipt_lines_treasury_reversal_transaction_id_treasury_transactions_id_fk" FOREIGN KEY ("treasury_reversal_transaction_id") REFERENCES "public"."treasury_transactions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "idx_finance_accounts_type" ON "finance_accounts" USING btree ("account_type");
CREATE INDEX IF NOT EXISTS "idx_finance_accounts_status" ON "finance_accounts" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_treasury_transactions_date" ON "treasury_transactions" USING btree ("transaction_date");
CREATE INDEX IF NOT EXISTS "idx_treasury_transactions_type" ON "treasury_transactions" USING btree ("transaction_type");
CREATE INDEX IF NOT EXISTS "idx_treasury_transactions_status" ON "treasury_transactions" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_treasury_entries_transaction" ON "treasury_transaction_entries" USING btree ("treasury_transaction_id");
CREATE INDEX IF NOT EXISTS "idx_treasury_entries_account" ON "treasury_transaction_entries" USING btree ("finance_account_id");
CREATE INDEX IF NOT EXISTS "idx_treasury_entries_value_date" ON "treasury_transaction_entries" USING btree ("value_date");
CREATE INDEX IF NOT EXISTS "idx_treasury_links_transaction" ON "treasury_transaction_links" USING btree ("treasury_transaction_id");
CREATE INDEX IF NOT EXISTS "idx_treasury_links_source" ON "treasury_transaction_links" USING btree ("source_module", "source_entity_type", "source_entity_id");
