ALTER TABLE "users" ADD COLUMN "first_name" varchar(120) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_name" varchar(120) DEFAULT '' NOT NULL;--> statement-breakpoint
-- Backfill: first word is the first name, the rest is the last name
UPDATE "users" SET
  "first_name" = split_part(trim("full_name"), ' ', 1),
  "last_name" = trim(substr(trim("full_name"), length(split_part(trim("full_name"), ' ', 1)) + 1));
