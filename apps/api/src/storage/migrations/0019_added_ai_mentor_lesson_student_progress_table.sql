CREATE TABLE IF NOT EXISTS "ai_mentor_student_lesson_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"student_lesson_progress_id" uuid NOT NULL,
	"summary" text,
	"score" integer,
	"min_score" integer,
	"max_score" integer,
	"percentage" integer,
	"passed" boolean DEFAULT false
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_mentor_student_lesson_progress" ADD CONSTRAINT "ai_mentor_student_lesson_progress_student_lesson_progress_id_student_lesson_progress_id_fk" FOREIGN KEY ("student_lesson_progress_id") REFERENCES "public"."student_lesson_progress"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
