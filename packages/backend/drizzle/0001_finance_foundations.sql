CREATE TABLE "cost_centres" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"centre_type" varchar(20) NOT NULL,
	"site_id" integer,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cost_centres_code_unique" UNIQUE("code"),
	CONSTRAINT "cost_centres_site_id_unique" UNIQUE("site_id")
);
--> statement-breakpoint
CREATE TABLE "finance_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"category_type" varchar(20) NOT NULL,
	"report_group" varchar(100) NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "finance_categories_code_unique" UNIQUE("code"),
	CONSTRAINT "finance_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "cost_centre_id" integer;--> statement-breakpoint
ALTER TABLE "inventory_item_types" ADD COLUMN "finance_category_id" integer;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "cost_centre_id" integer;--> statement-breakpoint
ALTER TABLE "service_work_orders" ADD COLUMN "category_id" integer;--> statement-breakpoint
ALTER TABLE "service_work_orders" ADD COLUMN "cost_centre_id" integer;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "default_category_id" integer;--> statement-breakpoint
ALTER TABLE "operational_expenses" ADD COLUMN "category_id" integer;--> statement-breakpoint
ALTER TABLE "operational_expenses" ADD COLUMN "cost_centre_id" integer;--> statement-breakpoint
ALTER TABLE "petty_cash_expenses" ADD COLUMN "category_id" integer;--> statement-breakpoint
ALTER TABLE "petty_cash_expenses" ADD COLUMN "cost_centre_id" integer;--> statement-breakpoint
ALTER TABLE "treasury_transaction_entries" ADD COLUMN "category_id" integer;--> statement-breakpoint
ALTER TABLE "treasury_transaction_entries" ADD COLUMN "cost_centre_id" integer;--> statement-breakpoint
ALTER TABLE "treasury_transaction_entries" ADD COLUMN "batch_id" integer;--> statement-breakpoint
ALTER TABLE "cost_centres" ADD CONSTRAINT "cost_centres_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_cost_centres_type" ON "cost_centres" USING btree ("centre_type");--> statement-breakpoint
CREATE INDEX "idx_cost_centres_status" ON "cost_centres" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_finance_categories_type" ON "finance_categories" USING btree ("category_type");--> statement-breakpoint
CREATE INDEX "idx_finance_categories_status" ON "finance_categories" USING btree ("status");--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_cost_centre_id_cost_centres_id_fk" FOREIGN KEY ("cost_centre_id") REFERENCES "public"."cost_centres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_item_types" ADD CONSTRAINT "inventory_item_types_finance_category_id_finance_categories_id_fk" FOREIGN KEY ("finance_category_id") REFERENCES "public"."finance_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_cost_centre_id_cost_centres_id_fk" FOREIGN KEY ("cost_centre_id") REFERENCES "public"."cost_centres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_work_orders" ADD CONSTRAINT "service_work_orders_category_id_finance_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."finance_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_work_orders" ADD CONSTRAINT "service_work_orders_cost_centre_id_cost_centres_id_fk" FOREIGN KEY ("cost_centre_id") REFERENCES "public"."cost_centres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_default_category_id_finance_categories_id_fk" FOREIGN KEY ("default_category_id") REFERENCES "public"."finance_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_expenses" ADD CONSTRAINT "operational_expenses_category_id_finance_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."finance_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_expenses" ADD CONSTRAINT "operational_expenses_cost_centre_id_cost_centres_id_fk" FOREIGN KEY ("cost_centre_id") REFERENCES "public"."cost_centres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petty_cash_expenses" ADD CONSTRAINT "petty_cash_expenses_category_id_finance_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."finance_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petty_cash_expenses" ADD CONSTRAINT "petty_cash_expenses_cost_centre_id_cost_centres_id_fk" FOREIGN KEY ("cost_centre_id") REFERENCES "public"."cost_centres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_transaction_entries" ADD CONSTRAINT "treasury_transaction_entries_category_id_finance_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."finance_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_transaction_entries" ADD CONSTRAINT "treasury_transaction_entries_cost_centre_id_cost_centres_id_fk" FOREIGN KEY ("cost_centre_id") REFERENCES "public"."cost_centres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_transaction_entries" ADD CONSTRAINT "treasury_transaction_entries_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_treasury_entries_category" ON "treasury_transaction_entries" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_treasury_entries_cost_centre" ON "treasury_transaction_entries" USING btree ("cost_centre_id");--> statement-breakpoint
CREATE INDEX "idx_treasury_entries_batch" ON "treasury_transaction_entries" USING btree ("batch_id");--> statement-breakpoint
-- ─── Seed: system finance categories ───────────────────────────────────────
INSERT INTO "finance_categories" ("code","name","category_type","report_group","is_system","sort_order") VALUES
  ('bird_sales','Bird Sales','income','Sales',true,10),
  ('other_farm_income','Other Farm Income (manure, litter, scrap)','income','Sales',true,20),
  ('interest_income','Interest Income','income','Other Income',true,30),
  ('other_income','Other Income','income','Other Income',true,40),
  ('chicks','Day-old Chicks','expense','Livestock',true,100),
  ('feed_raw_materials','Feed Raw Materials','expense','Feed',true,110),
  ('purchased_feed','Purchased Feed','expense','Feed',true,120),
  ('medicine_vaccines','Medicine & Vaccines','expense','Health',true,130),
  ('litter_bedding','Litter & Bedding','expense','Farm Supplies',true,140),
  ('farm_consumables','Farm Consumables','expense','Farm Supplies',true,150),
  ('electricity','Electricity','expense','Utilities',true,200),
  ('fuel_gas','Fuel & Gas','expense','Utilities',true,210),
  ('water','Water','expense','Utilities',true,220),
  ('repairs_maintenance','Repairs & Maintenance','expense','Repairs & Maintenance',true,230),
  ('equipment_purchase','Equipment Purchase','expense','Capital Expenditure',true,240),
  ('transport','Transport & Logistics','expense','Transport',true,250),
  ('wages_salaries','Wages & Salaries','expense','Labour',true,300),
  ('epf_etf','EPF / ETF Contributions','expense','Labour',true,310),
  ('staff_welfare','Staff Welfare','expense','Labour',true,320),
  ('professional_fees','Professional Fees','expense','Administration',true,400),
  ('bank_charges','Bank Charges','expense','Administration',true,410),
  ('rent_lease','Rent & Lease','expense','Administration',true,420),
  ('insurance','Insurance','expense','Administration',true,430),
  ('office_admin','Office & Administration','expense','Administration',true,440),
  ('taxes_licenses','Taxes & Licenses','expense','Administration',true,450),
  ('loan_interest','Loan Interest','expense','Finance Costs',true,460),
  ('other_expense','Other Expenses','expense','Other Expenses',true,490),
  ('owner_capital','Owner Capital Introduced','financing','Owner Equity',true,500),
  ('owner_drawings','Owner Drawings','financing','Owner Equity',true,510),
  ('loan_received','Loan Received','financing','Loans',true,520),
  ('loan_repayment','Loan Principal Repayment','financing','Loans',true,530),
  ('customer_advances','Customer Advances (unallocated receipts)','financing','Customer Advances',true,540),
  ('internal_transfer','Internal Transfer','transfer','Transfers',true,900),
  ('uncategorized','Uncategorized (needs review)','suspense','Uncategorized',true,999);
--> statement-breakpoint
-- ─── Seed: cost centres (one per site + feed mill + admin) ────────────────
INSERT INTO "cost_centres" ("code","name","centre_type","site_id")
  SELECT 'SITE-' || s."id", s."site_name", 'site', s."id" FROM "sites" s;
--> statement-breakpoint
INSERT INTO "cost_centres" ("code","name","centre_type") VALUES
  ('MILL','Feed Mill','mill'),
  ('ADMIN','Admin / Head Office','admin');
--> statement-breakpoint
-- ─── Backfill master data ──────────────────────────────────────────────────
UPDATE "employees" e SET "cost_centre_id" = cc."id" FROM "cost_centres" cc WHERE cc."site_id" = e."site_id";
--> statement-breakpoint
UPDATE "inventory_item_types" t SET "finance_category_id" = fc."id"
  FROM "finance_categories" fc
  WHERE fc."code" = CASE
    WHEN t."is_feed" OR t."category" = 'feed' THEN 'feed_raw_materials'
    WHEN t."category" = 'health' THEN 'medicine_vaccines'
    WHEN t."category" = 'assets' THEN 'equipment_purchase'
    ELSE 'farm_consumables' END;
--> statement-breakpoint
UPDATE "purchase_orders" po SET "cost_centre_id" = (
  SELECT CASE WHEN bool_or(t."is_feed") THEN (SELECT "id" FROM "cost_centres" WHERE "code" = 'MILL')
              ELSE (SELECT "id" FROM "cost_centres" WHERE "code" = 'ADMIN') END
  FROM "purchase_order_items" poi
  JOIN "feed_inventory" fi ON fi."id" = poi."inventory_item_id"
  JOIN "inventory_item_types" t ON t."id" = fi."item_type_id"
  WHERE poi."purchase_order_id" = po."id");
--> statement-breakpoint
UPDATE "purchase_orders" SET "cost_centre_id" = (SELECT "id" FROM "cost_centres" WHERE "code" = 'ADMIN') WHERE "cost_centre_id" IS NULL;
--> statement-breakpoint
-- Free-text expense categories → category ids (exact name/code match, then keywords, else uncategorized)
CREATE FUNCTION pg_temp.ff_match_category(txt text) RETURNS integer LANGUAGE sql AS $$
  SELECT COALESCE(
    (SELECT "id" FROM "finance_categories" WHERE lower("name") = lower(trim(txt)) OR lower("code") = lower(trim(txt)) LIMIT 1),
    (SELECT "id" FROM "finance_categories" WHERE "code" = CASE
      WHEN txt ~* 'electric|power|ceb' THEN 'electricity'
      WHEN txt ~* 'fuel|diesel|petrol|gas' THEN 'fuel_gas'
      WHEN txt ~* 'water' THEN 'water'
      WHEN txt ~* 'repair|maint' THEN 'repairs_maintenance'
      WHEN txt ~* 'transport|lorry|vehicle|hire' THEN 'transport'
      WHEN txt ~* 'station|office|print|admin' THEN 'office_admin'
      WHEN txt ~* 'medic|vaccin|vet' THEN 'medicine_vaccines'
      WHEN txt ~* 'litter|saw ?dust|husk|bedding' THEN 'litter_bedding'
      WHEN txt ~* 'welfare|meal|food|tea' THEN 'staff_welfare'
      WHEN txt ~* 'bank' THEN 'bank_charges'
      ELSE 'uncategorized' END)
  );
$$;
--> statement-breakpoint
UPDATE "operational_expenses" oe SET
  "category_id" = pg_temp.ff_match_category(oe."expense_category"),
  "cost_centre_id" = CASE
    WHEN oe."batch_id" IS NOT NULL THEN (SELECT cc."id" FROM "batches" b JOIN "cost_centres" cc ON cc."site_id" = b."site_id" WHERE b."id" = oe."batch_id")
    WHEN oe."site_id" IS NOT NULL THEN (SELECT "id" FROM "cost_centres" WHERE "site_id" = oe."site_id")
    ELSE (SELECT "id" FROM "cost_centres" WHERE "code" = 'ADMIN') END;
--> statement-breakpoint
UPDATE "petty_cash_expenses" pe SET
  "category_id" = pg_temp.ff_match_category(pe."expense_category"),
  "cost_centre_id" = COALESCE(
    (SELECT cc."id" FROM "petty_cash_allocations" pa JOIN "cost_centres" cc ON cc."site_id" = pa."site_id" WHERE pa."id" = pe."allocation_id"),
    (SELECT "id" FROM "cost_centres" WHERE "code" = 'ADMIN'));
--> statement-breakpoint
UPDATE "service_work_orders" wo SET
  "category_id" = (SELECT "id" FROM "finance_categories" WHERE "code" = CASE wo."service_type"
    WHEN 'utility' THEN 'electricity' WHEN 'fuel' THEN 'fuel_gas' ELSE 'repairs_maintenance' END),
  "cost_centre_id" = CASE
    WHEN wo."batch_id" IS NOT NULL THEN (SELECT cc."id" FROM "batches" b JOIN "cost_centres" cc ON cc."site_id" = b."site_id" WHERE b."id" = wo."batch_id")
    WHEN wo."site_id" IS NOT NULL THEN (SELECT "id" FROM "cost_centres" WHERE "site_id" = wo."site_id")
    ELSE (SELECT "id" FROM "cost_centres" WHERE "code" = 'ADMIN') END;
--> statement-breakpoint
-- ─── Backfill ledger entry tags from each transaction's source document ────
UPDATE "treasury_transaction_entries" e SET
  "category_id" = src."category_id", "cost_centre_id" = src."cost_centre_id", "batch_id" = src."batch_id"
FROM (
  SELECT t."id" AS tx_id,
    CASE
      WHEN t."transaction_type" IN ('internal_transfer','petty_cash_allocation') THEN (SELECT "id" FROM "finance_categories" WHERE "code" = 'internal_transfer')
      WHEN t."transaction_type" IN ('customer_receipt','customer_receipt_reversal') THEN
        CASE WHEN sale_link."batch_id" IS NOT NULL THEN (SELECT "id" FROM "finance_categories" WHERE "code" = 'bird_sales')
             ELSE (SELECT "id" FROM "finance_categories" WHERE "code" = 'customer_advances') END
      WHEN t."transaction_type" = 'payroll_disbursement' THEN (SELECT "id" FROM "finance_categories" WHERE "code" = 'wages_salaries')
      WHEN t."transaction_type" = 'operational_expense' THEN oe."category_id"
      WHEN t."transaction_type" = 'petty_cash_expense' THEN pe."category_id"
      WHEN t."transaction_type" = 'supplier_payment' THEN COALESCE(wo."category_id", po_cat."category_id")
      ELSE NULL
    END AS category_id,
    CASE
      WHEN t."transaction_type" IN ('internal_transfer','petty_cash_allocation') THEN NULL
      WHEN t."transaction_type" IN ('customer_receipt','customer_receipt_reversal') THEN sale_link."cost_centre_id"
      WHEN t."transaction_type" = 'payroll_disbursement' THEN (SELECT "cost_centre_id" FROM "employees" WHERE "id" = t."counterparty_id")
      WHEN t."transaction_type" = 'operational_expense' THEN oe."cost_centre_id"
      WHEN t."transaction_type" = 'petty_cash_expense' THEN pe."cost_centre_id"
      WHEN t."transaction_type" = 'supplier_payment' THEN COALESCE(wo."cost_centre_id", po_cat."cost_centre_id")
      ELSE NULL
    END AS cost_centre_id,
    CASE
      WHEN t."transaction_type" IN ('customer_receipt','customer_receipt_reversal') THEN sale_link."batch_id"
      WHEN t."transaction_type" = 'operational_expense' THEN oe."batch_id"
      WHEN t."transaction_type" = 'supplier_payment' THEN wo."batch_id"
      ELSE NULL
    END AS batch_id
  FROM "treasury_transactions" t
  LEFT JOIN LATERAL (
    SELECT s."batch_id", cc."id" AS cost_centre_id
    FROM "treasury_transaction_links" l
    JOIN "sales" s ON s."id" = l."source_entity_id"
    JOIN "batches" b ON b."id" = s."batch_id"
    JOIN "cost_centres" cc ON cc."site_id" = b."site_id"
    WHERE l."treasury_transaction_id" = t."id" AND l."source_entity_type" = 'sale'
    ORDER BY l."id" LIMIT 1
  ) sale_link ON true
  LEFT JOIN "operational_expenses" oe ON oe."treasury_transaction_id" = t."id"
  LEFT JOIN "petty_cash_expenses" pe ON pe."treasury_transaction_id" = t."id"
  LEFT JOIN LATERAL (
    SELECT w.* FROM "treasury_transaction_links" l JOIN "service_work_orders" w ON w."id" = l."source_entity_id"
    WHERE l."treasury_transaction_id" = t."id" AND l."source_entity_type" = 'service_work_order' LIMIT 1
  ) wo ON true
  LEFT JOIN LATERAL (
    SELECT (SELECT typ."finance_category_id" FROM "purchase_order_items" poi
              JOIN "feed_inventory" fi ON fi."id" = poi."inventory_item_id"
              JOIN "inventory_item_types" typ ON typ."id" = fi."item_type_id"
             WHERE poi."purchase_order_id" = po."id"
             ORDER BY poi."ordered_quantity" * poi."unit_price" DESC LIMIT 1) AS category_id,
           po."cost_centre_id"
    FROM "treasury_transaction_links" l JOIN "purchase_orders" po ON po."id" = l."source_entity_id"
    WHERE l."treasury_transaction_id" = t."id" AND l."source_entity_type" = 'purchase_order' LIMIT 1
  ) po_cat ON true
) src
WHERE e."treasury_transaction_id" = src.tx_id;
--> statement-breakpoint
-- Anything still untagged is parked in "uncategorized" / Admin for review in the Treasury UI.
UPDATE "treasury_transaction_entries" SET "category_id" = (SELECT "id" FROM "finance_categories" WHERE "code" = 'uncategorized') WHERE "category_id" IS NULL;
--> statement-breakpoint
UPDATE "treasury_transaction_entries" e SET "cost_centre_id" = (SELECT "id" FROM "cost_centres" WHERE "code" = 'ADMIN')
  WHERE e."cost_centre_id" IS NULL
    AND e."category_id" <> (SELECT "id" FROM "finance_categories" WHERE "code" = 'internal_transfer');
--> statement-breakpoint
ALTER TABLE "treasury_transaction_entries" ALTER COLUMN "category_id" SET NOT NULL;
