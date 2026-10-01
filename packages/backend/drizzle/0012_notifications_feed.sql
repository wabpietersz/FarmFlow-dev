ALTER TABLE "notifications" ADD COLUMN "title" varchar(200);--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "link" varchar(300);--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "tone" varchar(20) DEFAULT 'info' NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "dedupe_key" varchar(120);--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "uq_notifications_user_dedupe" UNIQUE("user_id","dedupe_key");