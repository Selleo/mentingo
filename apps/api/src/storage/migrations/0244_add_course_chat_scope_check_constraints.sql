-- Custom: drizzle-kit 0.22 does not generate CHECK constraints; definitions mirror the course_chat_threads table in schema/index.ts.
ALTER TABLE "course_chat_threads" ADD CONSTRAINT "course_chat_threads_scope_check" CHECK ("scope" IN ('general', 'course'));
--> statement-breakpoint
ALTER TABLE "course_chat_threads" ADD CONSTRAINT "course_chat_threads_scope_course_check" CHECK (("scope" = 'course') = ("course_id" IS NOT NULL));
--> statement-breakpoint
ALTER TABLE "course_chat_threads" ADD CONSTRAINT "course_chat_threads_general_title_check" CHECK ("scope" <> 'general' OR "title" IS NOT NULL);
