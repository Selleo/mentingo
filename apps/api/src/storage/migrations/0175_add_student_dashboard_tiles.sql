CREATE TABLE IF NOT EXISTS "ai_mentor_practice_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"user_id" uuid NOT NULL,
	"practice_date" date NOT NULL,
	"timezone" text NOT NULL,
	"language" varchar(20) NOT NULL,
	"challenge" text NOT NULL,
	"counterpart" text NOT NULL,
	"desired_outcome" text NOT NULL,
	"generated_title" text,
	"generated_instructions" text,
	"status" varchar(20) DEFAULT 'queued' NOT NULL,
	"error_code" text,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_mentor_threads" ALTER COLUMN "ai_mentor_lesson_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_mentor_threads" ADD COLUMN "practice_session_id" uuid;--> statement-breakpoint
ALTER TABLE "student_courses" ADD COLUMN "last_opened_at" timestamp(3) with time zone;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_mentor_practice_sessions" ADD CONSTRAINT "ai_mentor_practice_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_mentor_practice_sessions" ADD CONSTRAINT "ai_mentor_practice_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_mentor_practice_sessions_tenant_id_idx" ON "ai_mentor_practice_sessions" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_mentor_practice_sessions_daily_unique_idx" ON "ai_mentor_practice_sessions" USING btree ("tenant_id","user_id","practice_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_mentor_practice_sessions_status_idx" ON "ai_mentor_practice_sessions" USING btree ("tenant_id","status");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_mentor_threads" ADD CONSTRAINT "ai_mentor_threads_practice_session_id_ai_mentor_practice_sessions_id_fk" FOREIGN KEY ("practice_session_id") REFERENCES "public"."ai_mentor_practice_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_mentor_threads_practice_session_unique_idx" ON "ai_mentor_threads" USING btree ("practice_session_id");
--> statement-breakpoint
ALTER TABLE "ai_mentor_threads"
ADD CONSTRAINT "ai_mentor_threads_exactly_one_source_check"
CHECK (
  ("ai_mentor_lesson_id" IS NOT NULL AND "practice_session_id" IS NULL)
  OR
  ("ai_mentor_lesson_id" IS NULL AND "practice_session_id" IS NOT NULL)
);
