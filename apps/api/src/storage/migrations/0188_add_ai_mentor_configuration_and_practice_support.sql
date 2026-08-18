DO $$ BEGIN
 CREATE TYPE "public"."ai_mentor_roleplay_difficulty" AS ENUM('cooperative', 'realistic', 'challenging');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ai_mentor_teaching_style" AS ENUM('explain_and_practice', 'guided_discovery', 'socratic');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."structured_ai_mentor_type" AS ENUM('teacher', 'roleplay');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_mentor_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"ai_mentor_lesson_id" uuid,
	"practice_session_id" uuid,
	"type" "structured_ai_mentor_type" NOT NULL,
	"opening_instruction" jsonb,
	"additional_instructions" jsonb,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_mentor_roleplay_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"configuration_id" uuid NOT NULL,
	"scenario" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ai_role" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"learner_role" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"character_goal" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"difficulty" "ai_mentor_roleplay_difficulty" NOT NULL,
	"facts_and_constraints" jsonb,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	CONSTRAINT "ai_mentor_roleplay_configurations_configuration_id_unique" UNIQUE("configuration_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_mentor_teacher_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"configuration_id" uuid NOT NULL,
	"task_goal" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expertise" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"content_scope" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"teaching_style" "ai_mentor_teaching_style" NOT NULL,
	"feedback_guidance" jsonb,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	CONSTRAINT "ai_mentor_teacher_configurations_configuration_id_unique" UNIQUE("configuration_id")
);
--> statement-breakpoint
ALTER TABLE "ai_mentor_practice_sessions" RENAME COLUMN "instructions" TO "scenario";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_mentor_configurations" ADD CONSTRAINT "ai_mentor_configurations_ai_mentor_lesson_id_ai_mentor_lessons_id_fk" FOREIGN KEY ("ai_mentor_lesson_id") REFERENCES "public"."ai_mentor_lessons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_mentor_configurations" ADD CONSTRAINT "ai_mentor_configurations_practice_session_id_ai_mentor_practice_sessions_id_fk" FOREIGN KEY ("practice_session_id") REFERENCES "public"."ai_mentor_practice_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_mentor_configurations" ADD CONSTRAINT "ai_mentor_configurations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_mentor_roleplay_configurations" ADD CONSTRAINT "ai_mentor_roleplay_configurations_configuration_id_ai_mentor_configurations_id_fk" FOREIGN KEY ("configuration_id") REFERENCES "public"."ai_mentor_configurations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_mentor_roleplay_configurations" ADD CONSTRAINT "ai_mentor_roleplay_configurations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_mentor_teacher_configurations" ADD CONSTRAINT "ai_mentor_teacher_configurations_configuration_id_ai_mentor_configurations_id_fk" FOREIGN KEY ("configuration_id") REFERENCES "public"."ai_mentor_configurations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_mentor_teacher_configurations" ADD CONSTRAINT "ai_mentor_teacher_configurations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_mentor_configurations_tenant_id_idx" ON "ai_mentor_configurations" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_mentor_configurations_lesson_unique_idx" ON "ai_mentor_configurations" USING btree ("ai_mentor_lesson_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_mentor_configurations_practice_session_unique_idx" ON "ai_mentor_configurations" USING btree ("practice_session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_mentor_roleplay_configurations_tenant_id_idx" ON "ai_mentor_roleplay_configurations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_mentor_teacher_configurations_tenant_id_idx" ON "ai_mentor_teacher_configurations" USING btree ("tenant_id");