ALTER TABLE "treasury_transaction_entries" ADD COLUMN IF NOT EXISTS "cleared_at" date;
ALTER TABLE "treasury_transaction_entries" ADD COLUMN IF NOT EXISTS "reconciliation_id" integer;

CREATE TABLE IF NOT EXISTS "finance_reconciliations" (
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

CREATE TABLE IF NOT EXISTS "operational_expenses" (
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

DO $$ BEGIN
 ALTER TABLE "finance_reconciliations" ADD CONSTRAINT "finance_reconciliations_finance_account_id_finance_accounts_id_fk" FOREIGN KEY ("finance_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "finance_reconciliations" ADD CONSTRAINT "finance_reconciliations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "finance_reconciliations" ADD CONSTRAINT "finance_reconciliations_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "treasury_transaction_entries" ADD CONSTRAINT "treasury_transaction_entries_reconciliation_id_finance_reconciliations_id_fk" FOREIGN KEY ("reconciliation_id") REFERENCES "public"."finance_reconciliations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "operational_expenses" ADD CONSTRAINT "operational_expenses_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "operational_expenses" ADD CONSTRAINT "operational_expenses_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "operational_expenses" ADD CONSTRAINT "operational_expenses_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "operational_expenses" ADD CONSTRAINT "operational_expenses_finance_account_id_finance_accounts_id_fk" FOREIGN KEY ("finance_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "operational_expenses" ADD CONSTRAINT "operational_expenses_cheque_leaf_id_cheque_leaves_id_fk" FOREIGN KEY ("cheque_leaf_id") REFERENCES "public"."cheque_leaves"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "operational_expenses" ADD CONSTRAINT "operational_expenses_treasury_transaction_id_treasury_transactions_id_fk" FOREIGN KEY ("treasury_transaction_id") REFERENCES "public"."treasury_transactions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "operational_expenses" ADD CONSTRAINT "operational_expenses_treasury_reversal_transaction_id_treasury_transactions_id_fk" FOREIGN KEY ("treasury_reversal_transaction_id") REFERENCES "public"."treasury_transactions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "operational_expenses" ADD CONSTRAINT "operational_expenses_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "idx_treasury_entries_cleared_at" ON "treasury_transaction_entries" USING btree ("cleared_at");
CREATE INDEX IF NOT EXISTS "idx_treasury_entries_reconciliation" ON "treasury_transaction_entries" USING btree ("reconciliation_id");
CREATE INDEX IF NOT EXISTS "idx_finance_reconciliations_account" ON "finance_reconciliations" USING btree ("finance_account_id");
CREATE INDEX IF NOT EXISTS "idx_finance_reconciliations_period" ON "finance_reconciliations" USING btree ("period_start", "period_end");
CREATE INDEX IF NOT EXISTS "idx_finance_reconciliations_statement_date" ON "finance_reconciliations" USING btree ("statement_date");
CREATE INDEX IF NOT EXISTS "idx_finance_reconciliations_status" ON "finance_reconciliations" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_operational_expenses_date" ON "operational_expenses" USING btree ("expense_date");
CREATE INDEX IF NOT EXISTS "idx_operational_expenses_category" ON "operational_expenses" USING btree ("expense_category");
CREATE INDEX IF NOT EXISTS "idx_operational_expenses_status" ON "operational_expenses" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_operational_expenses_site" ON "operational_expenses" USING btree ("site_id");
CREATE INDEX IF NOT EXISTS "idx_operational_expenses_batch" ON "operational_expenses" USING btree ("batch_id");
CREATE INDEX IF NOT EXISTS "idx_operational_expenses_account" ON "operational_expenses" USING btree ("finance_account_id");
