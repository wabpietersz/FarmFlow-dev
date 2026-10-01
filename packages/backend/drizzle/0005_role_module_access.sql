CREATE TABLE "role_module_access" (
	"id" serial PRIMARY KEY NOT NULL,
	"role" varchar(50) NOT NULL,
	"module_key" varchar(50) NOT NULL,
	"level" varchar(10) NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_role_module" UNIQUE("role","module_key")
);
--> statement-breakpoint
ALTER TABLE "role_module_access" ADD CONSTRAINT "role_module_access_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;