CREATE TABLE "sale_bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_code" varchar(50) NOT NULL,
	"buyer_id" integer NOT NULL,
	"batch_id" integer NOT NULL,
	"catch_date" date NOT NULL,
	"expected_birds" integer NOT NULL,
	"expected_avg_weight_kg" numeric(6, 3),
	"price_per_kg" numeric(10, 2) NOT NULL,
	"status" varchar(20) DEFAULT 'booked' NOT NULL,
	"sale_id" integer,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sale_bookings_booking_code_unique" UNIQUE("booking_code")
);
--> statement-breakpoint
ALTER TABLE "sales" ALTER COLUMN "batch_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "buyers" ADD COLUMN "credit_limit" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "sale_type" varchar(30) DEFAULT 'live_birds' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "site_id" integer;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "booking_id" integer;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "due_date" date;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "item_description" varchar(200);--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "quantity" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "unit" varchar(30);--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "unit_price" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "sale_bookings" ADD CONSTRAINT "sale_bookings_buyer_id_buyers_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."buyers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_bookings" ADD CONSTRAINT "sale_bookings_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_bookings" ADD CONSTRAINT "sale_bookings_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_bookings" ADD CONSTRAINT "sale_bookings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_sale_bookings_catch_date" ON "sale_bookings" USING btree ("catch_date");--> statement-breakpoint
CREATE INDEX "idx_sale_bookings_status" ON "sale_bookings" USING btree ("status");--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Existing sales: farm from their batch, due date from the buyer's credit terms
UPDATE "sales" s SET "site_id" = b."site_id" FROM "batches" b WHERE b."id" = s."batch_id";--> statement-breakpoint
UPDATE "sales" s SET "due_date" = s."sale_date" + COALESCE(bu."credit_terms", 0) FROM "buyers" bu WHERE bu."id" = s."buyer_id";--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_live_birds_need_batch" CHECK ("sale_type" <> 'live_birds' OR "batch_id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_type_valid" CHECK ("sale_type" IN ('live_birds', 'other_income'));
