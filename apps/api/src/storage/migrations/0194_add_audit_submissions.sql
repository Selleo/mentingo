CREATE TABLE IF NOT EXISTS "audit_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"type" text NOT NULL,
	"definition_version" integer NOT NULL,
	"submitted_by_id" uuid NOT NULL,
	"answers" jsonb NOT NULL,
	"score" integer NOT NULL,
	"competency_scores" jsonb NOT NULL,
	"completed_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_submissions" ADD CONSTRAINT "audit_submissions_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_submissions" ADD CONSTRAINT "audit_submissions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_submissions_tenant_id_idx" ON "audit_submissions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_submissions_tenant_type_completed_idx" ON "audit_submissions" USING btree ("tenant_id","type","completed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_submissions_user_type_completed_idx" ON "audit_submissions" USING btree ("submitted_by_id","type","completed_at");