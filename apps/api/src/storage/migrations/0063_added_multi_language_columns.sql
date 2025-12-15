ALTER TABLE "student_courses" ADD COLUMN "course_completion_metadata" jsonb;--> statement-breakpoint
ALTER TABLE "student_lesson_progress" ADD COLUMN "language_answered" text DEFAULT 'en';