ALTER TABLE "payroll" ADD COLUMN "compensation_revision_id" integer;
--> statement-breakpoint
ALTER TABLE "payroll" ADD COLUMN "compensation_snapshot" jsonb;
--> statement-breakpoint
ALTER TABLE "payroll" ADD CONSTRAINT "payroll_compensation_revision_id_employee_compensation_revisions_id_fk" FOREIGN KEY ("compensation_revision_id") REFERENCES "public"."employee_compensation_revisions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_payroll_compensation_revision_id" ON "payroll" USING btree ("compensation_revision_id");
