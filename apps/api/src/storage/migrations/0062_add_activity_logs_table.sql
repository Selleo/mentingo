DO $$ BEGIN
 CREATE TYPE "public"."activity_log_action_type" AS ENUM('create', 'read', 'update', 'delete', 'login', 'logout', 'enroll_course', 'unenroll_course', 'complete_lesson', 'complete_course', 'complete_chapter', 'view_announcement');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."activity_log_resource_type" AS ENUM('user', 'course', 'chapter', 'lesson', 'announcement', 'group', 'settings', 'integration');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"actor_id" uuid NOT NULL,
	"actor_email" text NOT NULL,
	"actor_role" text NOT NULL,
	"action_type" "activity_log_action_type" NOT NULL,
	"resource_type" "activity_log_resource_type",
	"resource_id" uuid,
	"metadata" jsonb NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_logs_actor_idx" ON "activity_logs" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_logs_action_idx" ON "activity_logs" USING btree ("action_type","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_logs_timeframe_idx" ON "activity_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_logs_resource_idx" ON "activity_logs" USING btree ("resource_type","resource_id");