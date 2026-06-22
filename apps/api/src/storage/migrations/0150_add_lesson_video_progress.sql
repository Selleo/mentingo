CREATE TABLE IF NOT EXISTS "lesson_video_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"student_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"resource_entity_id" uuid NOT NULL,
	"duration_seconds" integer NOT NULL,
	"bucket_size_seconds" integer DEFAULT 1 NOT NULL,
	"watched_ranges" "int4multirange" DEFAULT '{}'::int4multirange NOT NULL,
	"covered_bucket_count" integer DEFAULT 0 NOT NULL,
	"coverage_percent" numeric(5, 4) DEFAULT 0 NOT NULL,
	"active_watch_seconds" numeric(10, 2) DEFAULT 0 NOT NULL,
	"is_watched" boolean DEFAULT false NOT NULL,
	"watched_at" timestamp(3) with time zone,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	CONSTRAINT "lesson_video_progress_student_id_lesson_id_resource_entity_id_unique" UNIQUE("student_id","lesson_id","resource_entity_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lesson_video_progress" ADD CONSTRAINT "lesson_video_progress_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lesson_video_progress" ADD CONSTRAINT "lesson_video_progress_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lesson_video_progress" ADD CONSTRAINT "lesson_video_progress_resource_entity_id_resource_entity_id_fk" FOREIGN KEY ("resource_entity_id") REFERENCES "public"."resource_entity"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lesson_video_progress" ADD CONSTRAINT "lesson_video_progress_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lesson_video_progress_tenant_id_idx" ON "lesson_video_progress" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lesson_video_progress_lesson_idx" ON "lesson_video_progress" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lesson_video_progress_resource_entity_idx" ON "lesson_video_progress" USING btree ("resource_entity_id");