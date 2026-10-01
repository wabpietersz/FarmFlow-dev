CREATE TABLE "staff_loan_recoveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"loan_id" integer NOT NULL,
	"payroll_id" integer,
	"amount" numeric(12, 2) NOT NULL,
	"recovery_date" date NOT NULL,
	"treasury_transaction_id" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_loans" (
	"id" serial PRIMARY KEY NOT NULL,
	"loan_code" varchar(50) NOT NULL,
	"employee_id" integer NOT NULL,
	"loan_type" varchar(20) NOT NULL,
	"principal" numeric(12, 2) NOT NULL,
	"installment_amount" numeric(12, 2) NOT NULL,
	"issued_date" date NOT NULL,
	"first_recovery_period" date NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"finance_account_id" integer,
	"payment_method" varchar(20),
	"treasury_transaction_id" integer,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "staff_loans_loan_code_unique" UNIQUE("loan_code")
);
--> statement-breakpoint
CREATE TABLE "statutory_remittances" (
	"id" serial PRIMARY KEY NOT NULL,
	"pay_period" date NOT NULL,
	"epf_employee" numeric(12, 2) NOT NULL,
	"epf_employer" numeric(12, 2) NOT NULL,
	"etf_employer" numeric(12, 2) NOT NULL,
	"employee_count" integer NOT NULL,
	"paid_date" date NOT NULL,
	"finance_account_id" integer NOT NULL,
	"epf_reference" varchar(100),
	"etf_reference" varchar(100),
	"treasury_transaction_id" integer,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "statutory_remittances_pay_period_unique" UNIQUE("pay_period")
);
--> statement-breakpoint
ALTER TABLE "employee_compensation_components" ADD COLUMN "counts_for_epf" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "epf_number" varchar(30);--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "epf_eligible" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll" ADD COLUMN "epf_base" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll" ADD COLUMN "epf_employee" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll" ADD COLUMN "epf_employer" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll" ADD COLUMN "etf_employer" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll" ADD COLUMN "other_deductions" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll" ADD COLUMN "loan_recovery" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll" ADD COLUMN "statutory_rates" jsonb;--> statement-breakpoint
ALTER TABLE "payroll_allowances" ADD COLUMN "counts_for_epf" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_loan_recoveries" ADD CONSTRAINT "staff_loan_recoveries_loan_id_staff_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."staff_loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_loan_recoveries" ADD CONSTRAINT "staff_loan_recoveries_payroll_id_payroll_id_fk" FOREIGN KEY ("payroll_id") REFERENCES "public"."payroll"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_loan_recoveries" ADD CONSTRAINT "staff_loan_recoveries_treasury_transaction_id_treasury_transactions_id_fk" FOREIGN KEY ("treasury_transaction_id") REFERENCES "public"."treasury_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_loans" ADD CONSTRAINT "staff_loans_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_loans" ADD CONSTRAINT "staff_loans_finance_account_id_finance_accounts_id_fk" FOREIGN KEY ("finance_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_loans" ADD CONSTRAINT "staff_loans_treasury_transaction_id_treasury_transactions_id_fk" FOREIGN KEY ("treasury_transaction_id") REFERENCES "public"."treasury_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_loans" ADD CONSTRAINT "staff_loans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statutory_remittances" ADD CONSTRAINT "statutory_remittances_finance_account_id_finance_accounts_id_fk" FOREIGN KEY ("finance_account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statutory_remittances" ADD CONSTRAINT "statutory_remittances_treasury_transaction_id_treasury_transactions_id_fk" FOREIGN KEY ("treasury_transaction_id") REFERENCES "public"."treasury_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statutory_remittances" ADD CONSTRAINT "statutory_remittances_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_staff_loan_recoveries_loan" ON "staff_loan_recoveries" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "idx_staff_loan_recoveries_payroll" ON "staff_loan_recoveries" USING btree ("payroll_id");--> statement-breakpoint
CREATE INDEX "idx_staff_loans_employee" ON "staff_loans" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_staff_loans_status" ON "staff_loans" USING btree ("status");--> statement-breakpoint
-- Existing payrolls: their deductions are "other" deductions; EPF stays 0 on history (it was never calculated)
UPDATE "payroll" p SET "other_deductions" = COALESCE((SELECT SUM(d."amount") FROM "payroll_deductions" d WHERE d."payroll_id" = p."id"), 0);--> statement-breakpoint
-- Two-way categories: advances go out and come back; employee EPF is withheld then paid over
INSERT INTO "finance_categories" ("code","name","category_type","report_group","is_system","sort_order") VALUES
  ('staff_advances','Staff Advances & Loans','financing','Staff Advances',true,545),
  ('epf_withheld','EPF Withheld from Staff (to pay over)','financing','Statutory Withholdings',true,546)
ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
INSERT INTO "system_config" ("config_key","config_value","description") VALUES
  ('payroll.statutory', '{"epfEmployeeRate": 8, "epfEmployerRate": 12, "etfEmployerRate": 3}', 'EPF/ETF rates (%)')
ON CONFLICT ("config_key") DO NOTHING;
