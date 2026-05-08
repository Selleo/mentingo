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
 CREATE TYPE "public"."scorm_package_status" AS ENUM('processing', 'ready', 'failed');
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
CREATE TABLE IF NOT EXISTS "group_learning_paths" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"group_id" uuid NOT NULL,
	"learning_path_id" uuid NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	CONSTRAINT "group_learning_paths_group_id_learning_path_id_unique" UNIQUE("group_id","learning_path_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "learning_path_certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"user_id" uuid NOT NULL,
	"learning_path_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"issued_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp(3) with time zone,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "learning_path_courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"learning_path_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"display_order" integer NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "learning_path_entity_map" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"export_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"source_entity_id" uuid NOT NULL,
	"target_entity_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "learning_path_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"source_tenant_id" uuid NOT NULL,
	"source_learning_path_id" uuid NOT NULL,
	"target_tenant_id" uuid NOT NULL,
	"target_learning_path_id" uuid,
	"sync_status" text DEFAULT 'active' NOT NULL,
	"last_synced_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "learning_paths" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"title" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"description" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"thumbnail_reference" varchar(500),
	"status" text DEFAULT 'draft' NOT NULL,
	"includes_certificate" boolean DEFAULT false NOT NULL,
	"settings" jsonb DEFAULT '{"certificateSignature":null,"certificateFontColor":null}'::jsonb NOT NULL,
	"sequence_enabled" boolean DEFAULT false NOT NULL,
	"author_id" uuid NOT NULL,
	"origin_type" text DEFAULT 'regular' NOT NULL,
	"source_learning_path_id" uuid,
	"source_tenant_id" uuid,
	"base_language" text DEFAULT 'en' NOT NULL,
	"available_locales" text[] DEFAULT ARRAY['en']::text[] NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
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
	"status" "scorm_package_status" DEFAULT 'processing' NOT NULL,
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
CREATE TABLE IF NOT EXISTS "student_learning_path_courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"student_id" uuid NOT NULL,
	"learning_path_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	CONSTRAINT "student_learning_path_courses_student_id_learning_path_id_course_id_unique" UNIQUE("student_id","learning_path_id","course_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student_learning_paths" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"student_id" uuid NOT NULL,
	"learning_path_id" uuid NOT NULL,
	"progress" text DEFAULT 'not_started' NOT NULL,
	"completed_at" timestamp(3) with time zone,
	"enrolled_at" timestamp(3) with time zone DEFAULT now(),
	"enrollment_type" text DEFAULT 'direct' NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	CONSTRAINT "student_learning_paths_student_id_learning_path_id_unique" UNIQUE("student_id","learning_path_id")
);
--> statement-breakpoint
DROP TABLE "scorm_files";--> statement-breakpoint
DROP TABLE "scorm_metadata";--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "course_type" "course_type" DEFAULT 'default' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_learning_paths" ADD CONSTRAINT "group_learning_paths_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_learning_paths" ADD CONSTRAINT "group_learning_paths_learning_path_id_learning_paths_id_fk" FOREIGN KEY ("learning_path_id") REFERENCES "public"."learning_paths"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_learning_paths" ADD CONSTRAINT "group_learning_paths_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "learning_path_certificates" ADD CONSTRAINT "learning_path_certificates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "learning_path_certificates" ADD CONSTRAINT "learning_path_certificates_learning_path_id_learning_paths_id_fk" FOREIGN KEY ("learning_path_id") REFERENCES "public"."learning_paths"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "learning_path_certificates" ADD CONSTRAINT "learning_path_certificates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "learning_path_courses" ADD CONSTRAINT "learning_path_courses_learning_path_id_learning_paths_id_fk" FOREIGN KEY ("learning_path_id") REFERENCES "public"."learning_paths"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "learning_path_courses" ADD CONSTRAINT "learning_path_courses_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "learning_path_courses" ADD CONSTRAINT "learning_path_courses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "learning_path_entity_map" ADD CONSTRAINT "learning_path_entity_map_export_id_learning_path_exports_id_fk" FOREIGN KEY ("export_id") REFERENCES "public"."learning_path_exports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "learning_path_exports" ADD CONSTRAINT "learning_path_exports_source_tenant_id_tenants_id_fk" FOREIGN KEY ("source_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "learning_path_exports" ADD CONSTRAINT "learning_path_exports_target_tenant_id_tenants_id_fk" FOREIGN KEY ("target_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "learning_path_exports" ADD CONSTRAINT "learning_path_exports_target_learning_path_id_learning_paths_id_fk" FOREIGN KEY ("target_learning_path_id") REFERENCES "public"."learning_paths"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
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
DO $$ BEGIN
 ALTER TABLE "student_learning_path_courses" ADD CONSTRAINT "student_learning_path_courses_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_learning_path_courses" ADD CONSTRAINT "student_learning_path_courses_learning_path_id_learning_paths_id_fk" FOREIGN KEY ("learning_path_id") REFERENCES "public"."learning_paths"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_learning_path_courses" ADD CONSTRAINT "student_learning_path_courses_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_learning_path_courses" ADD CONSTRAINT "student_learning_path_courses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_learning_paths" ADD CONSTRAINT "student_learning_paths_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_learning_paths" ADD CONSTRAINT "student_learning_paths_learning_path_id_learning_paths_id_fk" FOREIGN KEY ("learning_path_id") REFERENCES "public"."learning_paths"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_learning_paths" ADD CONSTRAINT "student_learning_paths_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "group_learning_paths_tenant_id_idx" ON "group_learning_paths" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "group_learning_paths_learning_path_idx" ON "group_learning_paths" USING btree ("learning_path_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "learning_path_certificates_tenant_id_idx" ON "learning_path_certificates" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "learning_path_courses_tenant_id_idx" ON "learning_path_courses" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "learning_path_courses_path_id_course_id_unique_idx" ON "learning_path_courses" USING btree ("learning_path_id","course_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "learning_path_courses_path_id_display_order_unique_idx" ON "learning_path_courses" USING btree ("learning_path_id","display_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "learning_path_courses_path_id_display_order_idx" ON "learning_path_courses" USING btree ("learning_path_id","display_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "learning_path_entity_map_export_idx" ON "learning_path_entity_map" USING btree ("export_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "learning_path_entity_map_source_entity_idx" ON "learning_path_entity_map" USING btree ("entity_type","source_entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "learning_path_entity_map_source_unique_idx" ON "learning_path_entity_map" USING btree ("export_id","entity_type","source_entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "learning_path_exports_source_learning_path_idx" ON "learning_path_exports" USING btree ("source_tenant_id","source_learning_path_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "learning_path_exports_target_learning_path_idx" ON "learning_path_exports" USING btree ("target_tenant_id","target_learning_path_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "learning_path_exports_source_target_unique_idx" ON "learning_path_exports" USING btree ("source_tenant_id","source_learning_path_id","target_tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "learning_paths_tenant_id_idx" ON "learning_paths" USING btree ("tenant_id");--> statement-breakpoint
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
CREATE INDEX IF NOT EXISTS "student_learning_path_courses_tenant_id_idx" ON "student_learning_path_courses" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_learning_path_courses_student_path_idx" ON "student_learning_path_courses" USING btree ("student_id","learning_path_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_learning_path_courses_course_idx" ON "student_learning_path_courses" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_learning_paths_tenant_id_idx" ON "student_learning_paths" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE "courses" DROP COLUMN IF EXISTS "is_scorm";