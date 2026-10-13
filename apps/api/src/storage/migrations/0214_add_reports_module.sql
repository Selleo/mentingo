CREATE TABLE IF NOT EXISTS "reports_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"visibility" text NOT NULL,
	"query" jsonb NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reports_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"format" text NOT NULL,
	"status" text NOT NULL,
	"processing_token" text,
	"query" jsonb NOT NULL,
	"access_fingerprint" text NOT NULL,
	"expires_at" timestamp(3) with time zone,
	"artifact_key" text,
	"failure_code" text,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reports_configurations" ADD CONSTRAINT "reports_configurations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reports_configurations" ADD CONSTRAINT "reports_configurations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reports_exports" ADD CONSTRAINT "reports_exports_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reports_exports" ADD CONSTRAINT "reports_exports_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reports_configurations_tenant_id_idx" ON "reports_configurations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reports_configurations_tenant_owner_idx" ON "reports_configurations" USING btree ("tenant_id","owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reports_configurations_tenant_visibility_idx" ON "reports_configurations" USING btree ("tenant_id","visibility");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reports_exports_tenant_id_idx" ON "reports_exports" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reports_exports_tenant_expiry_idx" ON "reports_exports" USING btree ("tenant_id","expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "group_users_report_group_learner_idx" ON "group_users" USING btree ("tenant_id","group_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_courses_report_learner_idx" ON "student_courses" USING btree ("tenant_id","student_id","course_id") WHERE "student_courses"."status" = 'enrolled';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_courses_report_enrollment_idx" ON "student_courses" USING btree ("tenant_id","enrolled_at","id") WHERE "student_courses"."status" = 'enrolled';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_courses_report_completion_idx" ON "student_courses" USING btree ("tenant_id","completed_at","id") WHERE "student_courses"."status" = 'enrolled' AND "student_courses"."completed_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_learning_path_courses_report_learner_course_path_idx" ON "student_learning_path_courses" USING btree ("tenant_id","student_id","course_id","learning_path_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_learning_paths_report_path_learner_idx" ON "student_learning_paths" USING btree ("tenant_id","learning_path_id","student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_lesson_progress_report_learner_chapter_idx" ON "student_lesson_progress" USING btree ("tenant_id","student_id","chapter_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_attempts_report_latest_graded_idx" ON "assessment_attempts" USING btree ("tenant_id","learner_id","assessment_id","attempt_number") WHERE "assessment_attempts"."score_percentage" IS NOT NULL AND "assessment_attempts"."graded_at" IS NOT NULL;