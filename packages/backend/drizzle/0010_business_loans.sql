CREATE TABLE "business_loan_repayments" (
	"id" serial PRIMARY KEY NOT NULL,
	"loan_id" integer NOT NULL,
	"payment_date" date NOT NULL,
	"principal_amount" numeric(14, 2) NOT NULL,
	"interest_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"finance_account_id" integer NOT NULL,
	"treasury_transaction_id" integer,
	"reference" varchar(100),
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_loans" (
	"id" serial PRIMARY KEY NOT NULL,
	"loan_code" varchar(50) NOT NULL,
	"lender" varchar(150) NOT NULL,
	"principal" numeric(14, 2) NOT NULL,
	"interest_rate" numeric(6, 3),
	"received_date" date NOT NULL,
	"term_months" integer,
	"monthly_installment" numeric(14, 2),
	"finance_account_id" integer NOT NULL,
	"treasury_transaction_id" integer,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "business_loans_loan_code_unique" UNIQUE("loan_code")
);
--> statement-breakpoint
ALTER TABLE "business_loan_repayments" ADD CONSTRAINT "business_loan_repayments_loan_id_business_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."business_loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_loan_repayments" ADD CONSTRAINT "business_loan_repayments_finance_account_id_finance_accounts_id_fk" FOREIGN KEY ("finance_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_loan_repayments" ADD CONSTRAINT "business_loan_repayments_treasury_transaction_id_treasury_transactions_id_fk" FOREIGN KEY ("treasury_transaction_id") REFERENCES "public"."treasury_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_loan_repayments" ADD CONSTRAINT "business_loan_repayments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_loans" ADD CONSTRAINT "business_loans_finance_account_id_finance_accounts_id_fk" FOREIGN KEY ("finance_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_loans" ADD CONSTRAINT "business_loans_treasury_transaction_id_treasury_transactions_id_fk" FOREIGN KEY ("treasury_transaction_id") REFERENCES "public"."treasury_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_loans" ADD CONSTRAINT "business_loans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_business_loan_repayments_loan" ON "business_loan_repayments" USING btree ("loan_id");