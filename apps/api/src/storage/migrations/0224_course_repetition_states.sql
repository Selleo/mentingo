CREATE TABLE IF NOT EXISTS "course_learning_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"kind" text DEFAULT 'current' NOT NULL,
	"previous_state_id" uuid,
	"completed_at" timestamp(3) with time zone,
	"finished_chapter_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "course_learning_states_learner_course_kind" UNIQUE("student_id","course_id","kind")
);
--> statement-breakpoint
ALTER TABLE "lesson_video_progress" DROP CONSTRAINT "lesson_video_progress_student_id_lesson_id_resource_entity_id_unique";--> statement-breakpoint
ALTER TABLE "student_chapter_progress" DROP CONSTRAINT "student_chapter_progress_student_id_course_id_chapter_id_unique";--> statement-breakpoint
ALTER TABLE "student_lesson_progress" DROP CONSTRAINT "student_lesson_progress_student_id_lesson_id_chapter_id_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "scorm_attempts_student_package_sco_attempt_unique_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "assessment_attempts_tenant_assessment_learner_number_idx";--> statement-breakpoint
ALTER TABLE "courses" ALTER COLUMN "settings" SET DEFAULT '{"lessonSequenceEnabled":false,"quizFeedbackEnabled":true,"certificateSignature":null,"certificateFontColor":"#000000","certificateValidity":null,"repetitionEnabled":false,"videoCompletionTrackingEnabled":true}'::jsonb;--> statement-breakpoint
ALTER TABLE "ai_mentor_threads" ADD COLUMN "learning_state_id" uuid;--> statement-breakpoint
ALTER TABLE "lesson_video_progress" ADD COLUMN "learning_state_id" uuid;--> statement-breakpoint
ALTER TABLE "scorm_attempts" ADD COLUMN "learning_state_id" uuid;--> statement-breakpoint
ALTER TABLE "student_chapter_progress" ADD COLUMN "learning_state_id" uuid;--> statement-breakpoint
ALTER TABLE "student_lesson_progress" ADD COLUMN "learning_state_id" uuid;--> statement-breakpoint
ALTER TABLE "assessment_attempts" ADD COLUMN "learning_state_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_learning_states" ADD CONSTRAINT "course_learning_states_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_learning_states" ADD CONSTRAINT "course_learning_states_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_learning_states" ADD CONSTRAINT "course_learning_states_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_learning_states_tenant_id_idx" ON "course_learning_states" USING btree ("tenant_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_mentor_threads" ADD CONSTRAINT "ai_mentor_threads_learning_state_id_course_learning_states_id_fk" FOREIGN KEY ("learning_state_id") REFERENCES "public"."course_learning_states"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lesson_video_progress" ADD CONSTRAINT "lesson_video_progress_learning_state_id_course_learning_states_id_fk" FOREIGN KEY ("learning_state_id") REFERENCES "public"."course_learning_states"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scorm_attempts" ADD CONSTRAINT "scorm_attempts_learning_state_id_course_learning_states_id_fk" FOREIGN KEY ("learning_state_id") REFERENCES "public"."course_learning_states"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_chapter_progress" ADD CONSTRAINT "student_chapter_progress_learning_state_id_course_learning_states_id_fk" FOREIGN KEY ("learning_state_id") REFERENCES "public"."course_learning_states"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_lesson_progress" ADD CONSTRAINT "student_lesson_progress_learning_state_id_course_learning_states_id_fk" FOREIGN KEY ("learning_state_id") REFERENCES "public"."course_learning_states"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_learning_state_id_course_learning_states_id_fk" FOREIGN KEY ("learning_state_id") REFERENCES "public"."course_learning_states"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "lesson_video_progress" ADD CONSTRAINT "lesson_video_progress_student_id_lesson_id_resource_entity_id_learning_state_id_unique" UNIQUE NULLS NOT DISTINCT("student_id","lesson_id","resource_entity_id","learning_state_id");--> statement-breakpoint
ALTER TABLE "scorm_attempts" ADD CONSTRAINT "scorm_attempts_student_package_sco_attempt_unique_idx" UNIQUE NULLS NOT DISTINCT("student_id","package_id","sco_id","attempt_number","learning_state_id");--> statement-breakpoint
ALTER TABLE "student_chapter_progress" ADD CONSTRAINT "student_chapter_progress_student_id_course_id_chapter_id_learning_state_id_unique" UNIQUE NULLS NOT DISTINCT("student_id","course_id","chapter_id","learning_state_id");--> statement-breakpoint
ALTER TABLE "student_lesson_progress" ADD CONSTRAINT "student_lesson_progress_student_id_lesson_id_chapter_id_learning_state_id_unique" UNIQUE NULLS NOT DISTINCT("student_id","lesson_id","chapter_id","learning_state_id");--> statement-breakpoint
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_tenant_assessment_learner_number_idx" UNIQUE NULLS NOT DISTINCT("tenant_id","assessment_id","learner_id","attempt_number","learning_state_id");