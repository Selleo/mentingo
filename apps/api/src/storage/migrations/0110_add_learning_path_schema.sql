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
CREATE INDEX IF NOT EXISTS "student_learning_path_courses_tenant_id_idx" ON "student_learning_path_courses" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_learning_path_courses_student_path_idx" ON "student_learning_path_courses" USING btree ("student_id","learning_path_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_learning_path_courses_course_idx" ON "student_learning_path_courses" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_learning_paths_tenant_id_idx" ON "student_learning_paths" USING btree ("tenant_id");