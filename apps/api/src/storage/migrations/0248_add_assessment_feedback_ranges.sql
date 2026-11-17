CREATE TABLE IF NOT EXISTS "assessment_feedback_ranges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"min_percent" integer NOT NULL,
	"max_percent" integer NOT NULL,
	"display_order" integer NOT NULL,
	"message" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_feedback_ranges" ADD CONSTRAINT "assessment_feedback_ranges_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_feedback_ranges" ADD CONSTRAINT "assessment_feedback_ranges_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_feedback_ranges_tenant_id_idx" ON "assessment_feedback_ranges" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assessment_feedback_ranges_tenant_assessment_display_order_idx" ON "assessment_feedback_ranges" USING btree ("tenant_id","assessment_id","display_order");