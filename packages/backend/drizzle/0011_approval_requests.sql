CREATE TABLE "approval_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" varchar(40) NOT NULL,
	"entity_id" integer NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"summary" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"requested_by" integer NOT NULL,
	"decided_by" integer,
	"decided_at" timestamp,
	"decision_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_approval_requests_status" ON "approval_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_approval_requests_entity" ON "approval_requests" USING btree ("entity_type","entity_id");--> statement-breakpoint
INSERT INTO "system_config" ("config_key","config_value","description") VALUES
  ('approvals.limits', '{"purchaseOrder": null, "moneyOut": null}', 'Amounts (Rs) at or above which a manager must approve; null = off')
ON CONFLICT ("config_key") DO NOTHING;
