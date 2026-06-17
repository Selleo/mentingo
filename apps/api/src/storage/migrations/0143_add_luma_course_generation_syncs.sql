CREATE TABLE IF NOT EXISTS "luma_course_generation_syncs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"course_id" uuid NOT NULL,
	"draft_id" uuid,
	"status" text DEFAULT 'not_started' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp(3) with time zone,
	"processed_at" timestamp(3) with time zone,
	"failed_at" timestamp(3) with time zone,
	"dismissed_at" timestamp(3) with time zone,
	"last_error" text,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	CONSTRAINT "luma_course_generation_syncs_course_id_unique" UNIQUE("course_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "luma_course_generation_syncs" ADD CONSTRAINT "luma_course_generation_syncs_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "luma_course_generation_syncs" ADD CONSTRAINT "luma_course_generation_syncs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "luma_course_generation_syncs_tenant_id_idx" ON "luma_course_generation_syncs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "luma_course_generation_syncs_course_id_idx" ON "luma_course_generation_syncs" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "luma_course_generation_syncs_status_idx" ON "luma_course_generation_syncs" USING btree ("status");