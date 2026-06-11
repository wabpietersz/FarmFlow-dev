ALTER TABLE "payroll" ADD COLUMN IF NOT EXISTS "finance_account_id" integer;
ALTER TABLE "payroll" ADD COLUMN IF NOT EXISTS "treasury_transaction_id" integer;

CREATE TABLE IF NOT EXISTS "petty_cash_allocations" (
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

CREATE TABLE IF NOT EXISTS "petty_cash_expenses" (
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

DO $$ BEGIN
 ALTER TABLE "payroll" ADD CONSTRAINT "payroll_finance_account_id_finance_accounts_id_fk" FOREIGN KEY ("finance_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "payroll" ADD CONSTRAINT "payroll_treasury_transaction_id_treasury_transactions_id_fk" FOREIGN KEY ("treasury_transaction_id") REFERENCES "public"."treasury_transactions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "petty_cash_allocations" ADD CONSTRAINT "petty_cash_allocations_source_finance_account_id_finance_accounts_id_fk" FOREIGN KEY ("source_finance_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "petty_cash_allocations" ADD CONSTRAINT "petty_cash_allocations_petty_cash_account_id_finance_accounts_id_fk" FOREIGN KEY ("petty_cash_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "petty_cash_allocations" ADD CONSTRAINT "petty_cash_allocations_allocated_to_user_id_users_id_fk" FOREIGN KEY ("allocated_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "petty_cash_allocations" ADD CONSTRAINT "petty_cash_allocations_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "petty_cash_allocations" ADD CONSTRAINT "petty_cash_allocations_treasury_transaction_id_treasury_transactions_id_fk" FOREIGN KEY ("treasury_transaction_id") REFERENCES "public"."treasury_transactions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "petty_cash_allocations" ADD CONSTRAINT "petty_cash_allocations_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "petty_cash_allocations" ADD CONSTRAINT "petty_cash_allocations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "petty_cash_expenses" ADD CONSTRAINT "petty_cash_expenses_allocation_id_petty_cash_allocations_id_fk" FOREIGN KEY ("allocation_id") REFERENCES "public"."petty_cash_allocations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "petty_cash_expenses" ADD CONSTRAINT "petty_cash_expenses_treasury_transaction_id_treasury_transactions_id_fk" FOREIGN KEY ("treasury_transaction_id") REFERENCES "public"."treasury_transactions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "petty_cash_expenses" ADD CONSTRAINT "petty_cash_expenses_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "petty_cash_expenses" ADD CONSTRAINT "petty_cash_expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "idx_petty_cash_allocations_code" ON "petty_cash_allocations" USING btree ("allocation_code");
CREATE INDEX IF NOT EXISTS "idx_petty_cash_allocations_account" ON "petty_cash_allocations" USING btree ("petty_cash_account_id");
CREATE INDEX IF NOT EXISTS "idx_petty_cash_allocations_user" ON "petty_cash_allocations" USING btree ("allocated_to_user_id");
CREATE INDEX IF NOT EXISTS "idx_petty_cash_allocations_status" ON "petty_cash_allocations" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_petty_cash_expenses_allocation" ON "petty_cash_expenses" USING btree ("allocation_id");
CREATE INDEX IF NOT EXISTS "idx_petty_cash_expenses_status" ON "petty_cash_expenses" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_petty_cash_expenses_date" ON "petty_cash_expenses" USING btree ("expense_date");
