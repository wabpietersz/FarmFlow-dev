CREATE TABLE "batch_close_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_id" integer NOT NULL,
	"closed_at" timestamp DEFAULT now() NOT NULL,
	"closed_by" integer,
	"revenue" numeric(14, 2) NOT NULL,
	"total_cost" numeric(14, 2) NOT NULL,
	"profit" numeric(14, 2) NOT NULL,
	"costs" jsonb NOT NULL,
	"kpis" jsonb NOT NULL,
	"notes" text,
	CONSTRAINT "batch_close_snapshots_batch_id_unique" UNIQUE("batch_id")
);
--> statement-breakpoint
ALTER TABLE "batch_close_snapshots" ADD CONSTRAINT "batch_close_snapshots_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_close_snapshots" ADD CONSTRAINT "batch_close_snapshots_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;