CREATE TABLE IF NOT EXISTS "ai_judge_blocking_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"configuration_id" uuid NOT NULL,
	"description" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_judge_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"ai_mentor_lesson_id" uuid NOT NULL,
	"task_goal" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"passing_threshold_percent" integer NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	CONSTRAINT "ai_judge_configurations_ai_mentor_lesson_id_unique" UNIQUE("ai_mentor_lesson_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_judge_criteria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"configuration_id" uuid NOT NULL,
	"max_score" integer NOT NULL,
	"title" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expected_behavior" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_judge_score_guidance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"criterion_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"description" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"example" jsonb,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_mentor_judgement_blocking_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"judgement_id" uuid NOT NULL,
	"blocking_error_id" uuid,
	"blocking_error_description" text DEFAULT '' NOT NULL,
	"learner_safe_feedback" text NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_mentor_judgement_criteria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"judgement_id" uuid NOT NULL,
	"criterion_id" uuid,
	"criterion_title" text DEFAULT '' NOT NULL,
	"awarded_points" integer NOT NULL,
	"max_score_at_judgement" integer NOT NULL,
	"status" varchar(20) NOT NULL,
	"learner_safe_feedback" text,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_mentor_judgements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"thread_id" uuid NOT NULL,
	"configuration_id" uuid NOT NULL,
	"language" varchar(20) NOT NULL,
	"earned_points" integer NOT NULL,
	"max_score" integer NOT NULL,
	"percentage" integer NOT NULL,
	"passed" boolean NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	CONSTRAINT "ai_mentor_judgements_thread_id_unique" UNIQUE("thread_id")
);
--> statement-breakpoint
ALTER TABLE "ai_mentor_lessons" ALTER COLUMN "type" SET DEFAULT 'roleplay';--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_judge_blocking_errors" ADD CONSTRAINT "ai_judge_blocking_errors_configuration_id_ai_judge_configurations_id_fk" FOREIGN KEY ("configuration_id") REFERENCES "public"."ai_judge_configurations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_judge_blocking_errors" ADD CONSTRAINT "ai_judge_blocking_errors_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_judge_configurations" ADD CONSTRAINT "ai_judge_configurations_ai_mentor_lesson_id_ai_mentor_lessons_id_fk" FOREIGN KEY ("ai_mentor_lesson_id") REFERENCES "public"."ai_mentor_lessons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_judge_configurations" ADD CONSTRAINT "ai_judge_configurations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_judge_criteria" ADD CONSTRAINT "ai_judge_criteria_configuration_id_ai_judge_configurations_id_fk" FOREIGN KEY ("configuration_id") REFERENCES "public"."ai_judge_configurations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_judge_criteria" ADD CONSTRAINT "ai_judge_criteria_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_judge_score_guidance" ADD CONSTRAINT "ai_judge_score_guidance_criterion_id_ai_judge_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."ai_judge_criteria"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_judge_score_guidance" ADD CONSTRAINT "ai_judge_score_guidance_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_mentor_judgement_blocking_errors" ADD CONSTRAINT "ai_mentor_judgement_blocking_errors_judgement_id_ai_mentor_judgements_id_fk" FOREIGN KEY ("judgement_id") REFERENCES "public"."ai_mentor_judgements"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_mentor_judgement_blocking_errors" ADD CONSTRAINT "ai_mentor_judgement_blocking_errors_blocking_error_id_ai_judge_blocking_errors_id_fk" FOREIGN KEY ("blocking_error_id") REFERENCES "public"."ai_judge_blocking_errors"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_mentor_judgement_blocking_errors" ADD CONSTRAINT "ai_mentor_judgement_blocking_errors_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_mentor_judgement_criteria" ADD CONSTRAINT "ai_mentor_judgement_criteria_judgement_id_ai_mentor_judgements_id_fk" FOREIGN KEY ("judgement_id") REFERENCES "public"."ai_mentor_judgements"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_mentor_judgement_criteria" ADD CONSTRAINT "ai_mentor_judgement_criteria_criterion_id_ai_judge_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."ai_judge_criteria"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_mentor_judgement_criteria" ADD CONSTRAINT "ai_mentor_judgement_criteria_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_mentor_judgements" ADD CONSTRAINT "ai_mentor_judgements_thread_id_ai_mentor_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."ai_mentor_threads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_mentor_judgements" ADD CONSTRAINT "ai_mentor_judgements_configuration_id_ai_judge_configurations_id_fk" FOREIGN KEY ("configuration_id") REFERENCES "public"."ai_judge_configurations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_mentor_judgements" ADD CONSTRAINT "ai_mentor_judgements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_judge_blocking_errors_tenant_id_idx" ON "ai_judge_blocking_errors" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_judge_blocking_errors_configuration_id_created_at_idx" ON "ai_judge_blocking_errors" USING btree ("configuration_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_judge_configurations_tenant_id_idx" ON "ai_judge_configurations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_judge_criteria_tenant_id_idx" ON "ai_judge_criteria" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_judge_criteria_configuration_id_created_at_idx" ON "ai_judge_criteria" USING btree ("configuration_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_judge_score_guidance_tenant_id_idx" ON "ai_judge_score_guidance" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_judge_score_guidance_criterion_id_score_unique" ON "ai_judge_score_guidance" USING btree ("criterion_id","score");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_mentor_judgement_blocking_errors_tenant_id_idx" ON "ai_mentor_judgement_blocking_errors" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_mentor_judgement_blocking_errors_judgement_id_blocking_error_id_unique" ON "ai_mentor_judgement_blocking_errors" USING btree ("judgement_id","blocking_error_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_mentor_judgement_criteria_tenant_id_idx" ON "ai_mentor_judgement_criteria" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_mentor_judgement_criteria_judgement_id_criterion_id_unique" ON "ai_mentor_judgement_criteria" USING btree ("judgement_id","criterion_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_mentor_judgements_tenant_id_idx" ON "ai_mentor_judgements" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE "ai_mentor_student_lesson_progress" DROP COLUMN IF EXISTS "summary";