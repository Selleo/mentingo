ALTER TABLE "lessons" ADD COLUMN "quiz_settings" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "feedback" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "student_lesson_progress" ADD COLUMN "quiz_attempt_state" jsonb;