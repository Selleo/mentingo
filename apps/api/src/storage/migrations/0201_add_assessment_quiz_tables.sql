CREATE TABLE IF NOT EXISTS "assessment_attempt_blank_answers" (
	"question_answer_id" uuid NOT NULL,
	"blank_id" uuid NOT NULL,
	"submitted_text" text,
	"selected_drag_option_id" uuid,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	CONSTRAINT "assessment_attempt_blank_answers_tenant_id_question_answer_id_blank_id_pk" PRIMARY KEY("tenant_id","question_answer_id","blank_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assessment_attempt_choice_selections" (
	"question_answer_id" uuid NOT NULL,
	"selected_option_id" uuid NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	CONSTRAINT "assessment_attempt_choice_selections_tenant_id_question_answer_id_selected_option_id_pk" PRIMARY KEY("tenant_id","question_answer_id","selected_option_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assessment_attempt_open_text_answers" (
	"question_answer_id" uuid PRIMARY KEY NOT NULL,
	"submitted_text" text NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assessment_attempt_question_answer_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_answer_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"awarded_points" numeric(8, 2) NOT NULL,
	"explanation" text NOT NULL,
	"explanation_language" text NOT NULL,
	"reviewed_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assessment_attempt_question_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"grading_status" text NOT NULL,
	"awarded_points" numeric(8, 2),
	"submitted_at" timestamp(3) with time zone NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assessment_attempt_scale_selections" (
	"question_answer_id" uuid PRIMARY KEY NOT NULL,
	"selected_scale_option_id" uuid NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assessment_attempt_statement_answers" (
	"question_answer_id" uuid NOT NULL,
	"statement_id" uuid NOT NULL,
	"submitted_value" boolean NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	CONSTRAINT "assessment_attempt_statement_answers_tenant_id_question_answer_id_statement_id_pk" PRIMARY KEY("tenant_id","question_answer_id","statement_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assessment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"language" text NOT NULL,
	"learner_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"submission_status" text DEFAULT 'submitted' NOT NULL,
	"grading_status" text DEFAULT 'pending' NOT NULL,
	"result" text DEFAULT 'pending' NOT NULL,
	"available_points" numeric(10, 2) NOT NULL,
	"awarded_points" numeric(10, 2),
	"score_percentage" numeric(5, 2),
	"has_question_level_answers" boolean DEFAULT true NOT NULL,
	"started_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"submitted_at" timestamp(3) with time zone NOT NULL,
	"graded_at" timestamp(3) with time zone,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assessment_question_blank_answer_sets" (
	"blank_id" uuid NOT NULL,
	"language" text NOT NULL,
	"preferred_answer" text NOT NULL,
	"accepted_answers" text[] NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	CONSTRAINT "assessment_question_blank_answer_sets_tenant_id_blank_id_language_pk" PRIMARY KEY("tenant_id","blank_id","language")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assessment_question_blanks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"text_comparison_mode" text DEFAULT 'exact' NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assessment_question_choice_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"language" text NOT NULL,
	"display_order" integer NOT NULL,
	"is_correct" boolean NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assessment_question_drag_and_drop_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"language" text NOT NULL,
	"label" text NOT NULL,
	"target_blank_id" uuid,
	"display_order" integer NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assessment_question_open_text_settings" (
	"question_id" uuid PRIMARY KEY NOT NULL,
	"minimum_characters" integer,
	"maximum_characters" integer,
	"reviewer_instructions" text,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assessment_question_scale_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"scale_value" smallint NOT NULL,
	"display_order" integer NOT NULL,
	"label" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assessment_question_true_false_statements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"language" text NOT NULL,
	"display_order" integer NOT NULL,
	"correct_value" boolean NOT NULL,
	"statement" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assessment_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"question_type" text NOT NULL,
	"display_order" integer NOT NULL,
	"maximum_points" numeric(8, 2) DEFAULT '1' NOT NULL,
	"grading_mode" text NOT NULL,
	"prompt" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"title" jsonb,
	"description" jsonb,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"passing_score_percentage" numeric(5, 2) NOT NULL,
	"attempt_limit_mode" text DEFAULT 'none' NOT NULL,
	"maximum_attempts" integer,
	"attempt_cooldown" interval,
	"feedback_mode" text DEFAULT 'full' NOT NULL,
	"base_language" text DEFAULT 'en' NOT NULL,
	"available_locales" text[] DEFAULT ARRAY['en']::text[] NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_attempt_blank_answers" ADD CONSTRAINT "assessment_attempt_blank_answers_question_answer_id_assessment_attempt_question_answers_id_fk" FOREIGN KEY ("question_answer_id") REFERENCES "public"."assessment_attempt_question_answers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_attempt_blank_answers" ADD CONSTRAINT "assessment_attempt_blank_answers_blank_id_assessment_question_blanks_id_fk" FOREIGN KEY ("blank_id") REFERENCES "public"."assessment_question_blanks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_attempt_blank_answers" ADD CONSTRAINT "assessment_attempt_blank_answers_selected_drag_option_id_assessment_question_drag_and_drop_options_id_fk" FOREIGN KEY ("selected_drag_option_id") REFERENCES "public"."assessment_question_drag_and_drop_options"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_attempt_blank_answers" ADD CONSTRAINT "assessment_attempt_blank_answers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_attempt_choice_selections" ADD CONSTRAINT "assessment_attempt_choice_selections_question_answer_id_assessment_attempt_question_answers_id_fk" FOREIGN KEY ("question_answer_id") REFERENCES "public"."assessment_attempt_question_answers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_attempt_choice_selections" ADD CONSTRAINT "assessment_attempt_choice_selections_selected_option_id_assessment_question_choice_options_id_fk" FOREIGN KEY ("selected_option_id") REFERENCES "public"."assessment_question_choice_options"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_attempt_choice_selections" ADD CONSTRAINT "assessment_attempt_choice_selections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_attempt_open_text_answers" ADD CONSTRAINT "assessment_attempt_open_text_answers_question_answer_id_assessment_attempt_question_answers_id_fk" FOREIGN KEY ("question_answer_id") REFERENCES "public"."assessment_attempt_question_answers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_attempt_open_text_answers" ADD CONSTRAINT "assessment_attempt_open_text_answers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_attempt_question_answer_reviews" ADD CONSTRAINT "assessment_attempt_question_answer_reviews_question_answer_id_assessment_attempt_question_answers_id_fk" FOREIGN KEY ("question_answer_id") REFERENCES "public"."assessment_attempt_question_answers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_attempt_question_answer_reviews" ADD CONSTRAINT "assessment_attempt_question_answer_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_attempt_question_answer_reviews" ADD CONSTRAINT "assessment_attempt_question_answer_reviews_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_attempt_question_answers" ADD CONSTRAINT "assessment_attempt_question_answers_attempt_id_assessment_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."assessment_attempts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_attempt_question_answers" ADD CONSTRAINT "assessment_attempt_question_answers_question_id_assessment_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."assessment_questions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_attempt_question_answers" ADD CONSTRAINT "assessment_attempt_question_answers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_attempt_scale_selections" ADD CONSTRAINT "assessment_attempt_scale_selections_question_answer_id_assessment_attempt_question_answers_id_fk" FOREIGN KEY ("question_answer_id") REFERENCES "public"."assessment_attempt_question_answers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_attempt_scale_selections" ADD CONSTRAINT "assessment_attempt_scale_selections_selected_scale_option_id_assessment_question_scale_options_id_fk" FOREIGN KEY ("selected_scale_option_id") REFERENCES "public"."assessment_question_scale_options"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_attempt_scale_selections" ADD CONSTRAINT "assessment_attempt_scale_selections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_attempt_statement_answers" ADD CONSTRAINT "assessment_attempt_statement_answers_question_answer_id_assessment_attempt_question_answers_id_fk" FOREIGN KEY ("question_answer_id") REFERENCES "public"."assessment_attempt_question_answers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_attempt_statement_answers" ADD CONSTRAINT "assessment_attempt_statement_answers_statement_id_assessment_question_true_false_statements_id_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."assessment_question_true_false_statements"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_attempt_statement_answers" ADD CONSTRAINT "assessment_attempt_statement_answers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_learner_id_users_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_question_blank_answer_sets" ADD CONSTRAINT "assessment_question_blank_answer_sets_blank_id_assessment_question_blanks_id_fk" FOREIGN KEY ("blank_id") REFERENCES "public"."assessment_question_blanks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_question_blank_answer_sets" ADD CONSTRAINT "assessment_question_blank_answer_sets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_question_blanks" ADD CONSTRAINT "assessment_question_blanks_question_id_assessment_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."assessment_questions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_question_blanks" ADD CONSTRAINT "assessment_question_blanks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_question_choice_options" ADD CONSTRAINT "assessment_question_choice_options_question_id_assessment_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."assessment_questions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_question_choice_options" ADD CONSTRAINT "assessment_question_choice_options_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_question_drag_and_drop_options" ADD CONSTRAINT "assessment_question_drag_and_drop_options_question_id_assessment_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."assessment_questions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_question_drag_and_drop_options" ADD CONSTRAINT "assessment_question_drag_and_drop_options_target_blank_id_assessment_question_blanks_id_fk" FOREIGN KEY ("target_blank_id") REFERENCES "public"."assessment_question_blanks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_question_drag_and_drop_options" ADD CONSTRAINT "assessment_question_drag_and_drop_options_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_question_open_text_settings" ADD CONSTRAINT "assessment_question_open_text_settings_question_id_assessment_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."assessment_questions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_question_open_text_settings" ADD CONSTRAINT "assessment_question_open_text_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_question_scale_options" ADD CONSTRAINT "assessment_question_scale_options_question_id_assessment_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."assessment_questions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_question_scale_options" ADD CONSTRAINT "assessment_question_scale_options_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_question_true_false_statements" ADD CONSTRAINT "assessment_question_true_false_statements_question_id_assessment_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."assessment_questions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_question_true_false_statements" ADD CONSTRAINT "assessment_question_true_false_statements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessments" ADD CONSTRAINT "assessments_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessments" ADD CONSTRAINT "assessments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_attempt_blank_answers_tenant_id_idx" ON "assessment_attempt_blank_answers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_attempt_blank_answers_tenant_selected_option_idx" ON "assessment_attempt_blank_answers" USING btree ("tenant_id","selected_drag_option_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_attempt_choice_selections_tenant_id_idx" ON "assessment_attempt_choice_selections" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_attempt_choice_selections_tenant_option_idx" ON "assessment_attempt_choice_selections" USING btree ("tenant_id","selected_option_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_attempt_open_text_answers_tenant_id_idx" ON "assessment_attempt_open_text_answers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_attempt_question_answer_reviews_tenant_id_idx" ON "assessment_attempt_question_answer_reviews" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assessment_attempt_question_answer_reviews_tenant_attempt_revisionNumber_idx" ON "assessment_attempt_question_answer_reviews" USING btree ("tenant_id","question_answer_id","revision_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_attempt_question_answer_reviews_tenant_attempt_revisionNumber_lookup_idx" ON "assessment_attempt_question_answer_reviews" USING btree ("tenant_id","question_answer_id","revision_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_attempt_question_answer_reviews_tenant_reviewer_created_idx" ON "assessment_attempt_question_answer_reviews" USING btree ("tenant_id","reviewer_id","reviewed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_attempt_question_answers_tenant_id_idx" ON "assessment_attempt_question_answers" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assessment_attempt_question_answers_tenant_attempt_question_idx" ON "assessment_attempt_question_answers" USING btree ("tenant_id","attempt_id","question_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_attempt_question_answers_tenant_attempt_idx" ON "assessment_attempt_question_answers" USING btree ("tenant_id","attempt_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_attempt_question_answers_tenant_grading_submitted_idx" ON "assessment_attempt_question_answers" USING btree ("tenant_id","grading_status","submitted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_attempt_scale_selections_tenant_id_idx" ON "assessment_attempt_scale_selections" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_attempt_statement_answers_tenant_id_idx" ON "assessment_attempt_statement_answers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_attempt_statement_answers_tenant_statement_idx" ON "assessment_attempt_statement_answers" USING btree ("tenant_id","statement_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_attempts_tenant_id_idx" ON "assessment_attempts" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assessment_attempts_tenant_assessment_learner_number_idx" ON "assessment_attempts" USING btree ("tenant_id","assessment_id","learner_id","attempt_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_attempts_tenant_learner_assessment_started_idx" ON "assessment_attempts" USING btree ("tenant_id","learner_id","assessment_id","started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_attempts_tenant_assessment_language_idx" ON "assessment_attempts" USING btree ("tenant_id","assessment_id","language");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_attempts_tenant_grading_submitted_idx" ON "assessment_attempts" USING btree ("tenant_id","grading_status","submitted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_question_blank_answer_sets_tenant_id_idx" ON "assessment_question_blank_answer_sets" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_question_blank_answer_sets_tenant_language_target_blank_idx" ON "assessment_question_blank_answer_sets" USING btree ("tenant_id","language","blank_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_question_blanks_tenant_id_idx" ON "assessment_question_blanks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_question_blanks_tenant_question_idx" ON "assessment_question_blanks" USING btree ("tenant_id","question_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_question_choice_options_tenant_id_idx" ON "assessment_question_choice_options" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assessment_question_choice_options_tenant_question_language_display_order_idx" ON "assessment_question_choice_options" USING btree ("tenant_id","question_id","language","display_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_question_choice_options_tenant_question_language_display_order_lookup_idx" ON "assessment_question_choice_options" USING btree ("tenant_id","question_id","language","display_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_question_drag_and_drop_options_tenant_id_idx" ON "assessment_question_drag_and_drop_options" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assessment_question_drag_and_drop_options_tenant_question_language_display_order_idx" ON "assessment_question_drag_and_drop_options" USING btree ("tenant_id","question_id","language","display_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_question_drag_and_drop_options_tenant_question_language_display_order_lookup_idx" ON "assessment_question_drag_and_drop_options" USING btree ("tenant_id","question_id","language","display_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_question_drag_and_drop_options_tenant_target_blank_idx" ON "assessment_question_drag_and_drop_options" USING btree ("tenant_id","target_blank_id") WHERE "assessment_question_drag_and_drop_options"."target_blank_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_question_open_text_settings_tenant_id_idx" ON "assessment_question_open_text_settings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_question_scale_options_tenant_id_idx" ON "assessment_question_scale_options" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assessment_question_scale_options_tenant_question_value_idx" ON "assessment_question_scale_options" USING btree ("tenant_id","question_id","scale_value");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assessment_question_scale_options_tenant_question_display_order_idx" ON "assessment_question_scale_options" USING btree ("tenant_id","question_id","display_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_question_scale_options_tenant_question_display_order_lookup_idx" ON "assessment_question_scale_options" USING btree ("tenant_id","question_id","display_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_question_true_false_statements_tenant_id_idx" ON "assessment_question_true_false_statements" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assessment_question_true_false_statements_tenant_question_language_display_order_idx" ON "assessment_question_true_false_statements" USING btree ("tenant_id","question_id","language","display_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_question_true_false_statements_tenant_question_language_display_order_lookup_idx" ON "assessment_question_true_false_statements" USING btree ("tenant_id","question_id","language","display_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_questions_tenant_id_idx" ON "assessment_questions" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assessment_questions_tenant_assessment_display_order_idx" ON "assessment_questions" USING btree ("tenant_id","assessment_id","display_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_questions_tenant_assessment_display_order_lookup_idx" ON "assessment_questions" USING btree ("tenant_id","assessment_id","display_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessments_tenant_id_idx" ON "assessments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessments_tenant_id_lesson_id_idx" ON "assessments" USING btree ("tenant_id","lesson_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assessments_tenant_id_lesson_id_unique_idx" ON "assessments" USING btree ("tenant_id","lesson_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assessments_tenant_id_id_unique_idx" ON "assessments" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "resource_entity_assessment_question_prompt_image_unique_idx" ON "resource_entity" USING btree ("tenant_id","entity_id") WHERE "resource_entity"."entity_type" = 'assessment_question' AND "resource_entity"."relationship_type" = 'prompt_image';