DO $$ BEGIN
 CREATE TYPE "public"."course_type" AS ENUM('default', 'scorm');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."scorm_completion_status" AS ENUM('completed', 'incomplete', 'not_attempted', 'unknown');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."scorm_package_entity_type" AS ENUM('course', 'lesson');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."scorm_package_status" AS ENUM('ready', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."scorm_standard" AS ENUM('scorm_1_2', 'scorm_2004');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."scorm_success_status" AS ENUM('passed', 'failed', 'unknown');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scorm_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"student_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"sco_id" uuid NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"started_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"completed_at" timestamp(3) with time zone,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scorm_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"entity_type" "scorm_package_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"standard" "scorm_standard" NOT NULL,
	"original_file_reference" text NOT NULL,
	"extracted_files_reference" text NOT NULL,
	"manifest_entry_point" text NOT NULL,
	"manifest_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "scorm_package_status" DEFAULT 'ready' NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scorm_runtime_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"attempt_id" uuid NOT NULL,
	"completion_status" "scorm_completion_status" DEFAULT 'unknown' NOT NULL,
	"success_status" "scorm_success_status" DEFAULT 'unknown' NOT NULL,
	"score_raw" numeric(10, 4),
	"score_min" numeric(10, 4),
	"score_max" numeric(10, 4),
	"score_scaled" numeric(10, 4),
	"lesson_location" text,
	"suspend_data" text,
	"session_time" text,
	"total_time" text,
	"progress_measure" numeric(10, 4),
	"entry" text,
	"exit" text,
	"raw_cmi_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scorm_scos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"package_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"organization_identifier" text,
	"identifier" text NOT NULL,
	"identifier_ref" text,
	"resource_identifier" text,
	"resource_type" text,
	"scorm_type" text,
	"title" text NOT NULL,
	"href" text,
	"launch_path" text NOT NULL,
	"parameters" text,
	"display_order" integer NOT NULL,
	"parent_identifier" text,
	"is_visible" boolean DEFAULT true NOT NULL,
	"item_metadata_json" jsonb,
	"resource_metadata_json" jsonb,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
DROP TABLE "scorm_files";--> statement-breakpoint
DROP TABLE "scorm_metadata";--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "course_type" "course_type" DEFAULT 'default' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scorm_attempts" ADD CONSTRAINT "scorm_attempts_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scorm_attempts" ADD CONSTRAINT "scorm_attempts_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scorm_attempts" ADD CONSTRAINT "scorm_attempts_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scorm_attempts" ADD CONSTRAINT "scorm_attempts_package_id_scorm_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."scorm_packages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scorm_attempts" ADD CONSTRAINT "scorm_attempts_sco_id_scorm_scos_id_fk" FOREIGN KEY ("sco_id") REFERENCES "public"."scorm_scos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scorm_attempts" ADD CONSTRAINT "scorm_attempts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scorm_packages" ADD CONSTRAINT "scorm_packages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scorm_runtime_state" ADD CONSTRAINT "scorm_runtime_state_attempt_id_scorm_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."scorm_attempts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scorm_runtime_state" ADD CONSTRAINT "scorm_runtime_state_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scorm_scos" ADD CONSTRAINT "scorm_scos_package_id_scorm_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."scorm_packages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scorm_scos" ADD CONSTRAINT "scorm_scos_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scorm_scos" ADD CONSTRAINT "scorm_scos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scorm_attempts_tenant_id_idx" ON "scorm_attempts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scorm_attempts_student_lesson_idx" ON "scorm_attempts" USING btree ("student_id","lesson_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scorm_attempts_student_package_idx" ON "scorm_attempts" USING btree ("student_id","package_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scorm_attempts_sco_id_idx" ON "scorm_attempts" USING btree ("sco_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "scorm_attempts_student_package_sco_attempt_unique_idx" ON "scorm_attempts" USING btree ("student_id","package_id","sco_id","attempt_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scorm_packages_tenant_id_idx" ON "scorm_packages" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scorm_packages_entity_idx" ON "scorm_packages" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "scorm_packages_entity_unique_idx" ON "scorm_packages" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scorm_runtime_state_tenant_id_idx" ON "scorm_runtime_state" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "scorm_runtime_state_attempt_id_unique_idx" ON "scorm_runtime_state" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scorm_scos_tenant_id_idx" ON "scorm_scos" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scorm_scos_package_id_idx" ON "scorm_scos" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scorm_scos_lesson_id_idx" ON "scorm_scos" USING btree ("lesson_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "scorm_scos_package_identifier_unique_idx" ON "scorm_scos" USING btree ("package_id","identifier");--> statement-breakpoint
ALTER TABLE "courses" DROP COLUMN IF EXISTS "is_scorm";