ALTER TABLE "leave_balances" ALTER COLUMN "total_days" SET DATA TYPE numeric(6, 1);--> statement-breakpoint
ALTER TABLE "leave_balances" ALTER COLUMN "used_days" SET DATA TYPE numeric(6, 1);--> statement-breakpoint
ALTER TABLE "leave_balances" ALTER COLUMN "used_days" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "payroll" ALTER COLUMN "attended_days" SET DATA TYPE numeric(6, 1);--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "leave_type" varchar(50);