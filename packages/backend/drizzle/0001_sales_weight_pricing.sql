ALTER TABLE "sales" ADD COLUMN "total_weight" numeric(10, 2) NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "sales" RENAME COLUMN "price_per_bird" TO "price_per_kg";--> statement-breakpoint
ALTER TABLE "sales" ALTER COLUMN "total_weight" DROP DEFAULT;
