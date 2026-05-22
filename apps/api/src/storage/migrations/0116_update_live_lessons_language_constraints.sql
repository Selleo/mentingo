DROP INDEX IF EXISTS "live_lessons_training_link_unique_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "live_lessons_lesson_unique_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "live_lessons_training_lesson_unique_idx";--> statement-breakpoint
ALTER TABLE "live_lessons" ADD COLUMN "language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "live_lessons_lesson_language_unique_idx" ON "live_lessons" USING btree ("lesson_id","language");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_lessons_training_link_idx" ON "live_lessons" USING btree ("tenant_id","live_training_link_id");