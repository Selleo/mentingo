CREATE TABLE IF NOT EXISTS "assessment_attempt_matching_answers" (
	"question_answer_id" uuid NOT NULL,
	"pair_id" uuid NOT NULL,
	"submitted_match" text NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	CONSTRAINT "assessment_attempt_matching_answers_tenant_id_question_answer_id_pair_id_pk" PRIMARY KEY("tenant_id","question_answer_id","pair_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assessment_question_matching_pairs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"language" text NOT NULL,
	"display_order" integer NOT NULL,
	"prompt" text NOT NULL,
	"match" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assessment_questions" ADD COLUMN "scoring_mode" text DEFAULT 'all_or_nothing' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_attempt_matching_answers" ADD CONSTRAINT "assessment_attempt_matching_answers_question_answer_id_assessment_attempt_question_answers_id_fk" FOREIGN KEY ("question_answer_id") REFERENCES "public"."assessment_attempt_question_answers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_attempt_matching_answers" ADD CONSTRAINT "assessment_attempt_matching_answers_pair_id_assessment_question_matching_pairs_id_fk" FOREIGN KEY ("pair_id") REFERENCES "public"."assessment_question_matching_pairs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_attempt_matching_answers" ADD CONSTRAINT "assessment_attempt_matching_answers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_question_matching_pairs" ADD CONSTRAINT "assessment_question_matching_pairs_question_id_assessment_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."assessment_questions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_question_matching_pairs" ADD CONSTRAINT "assessment_question_matching_pairs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_attempt_matching_answers_tenant_id_idx" ON "assessment_attempt_matching_answers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_attempt_matching_answers_tenant_pair_idx" ON "assessment_attempt_matching_answers" USING btree ("tenant_id","pair_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_question_matching_pairs_tenant_id_idx" ON "assessment_question_matching_pairs" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assessment_question_matching_pairs_tenant_question_language_display_order_idx" ON "assessment_question_matching_pairs" USING btree ("tenant_id","question_id","language","display_order");