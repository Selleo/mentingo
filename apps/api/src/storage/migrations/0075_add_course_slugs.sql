CREATE TABLE IF NOT EXISTS "course_slugs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"slug" text NOT NULL,
	"course_id" uuid NOT NULL,
	"lang" text NOT NULL,
	CONSTRAINT "course_slugs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "courses" ALTER COLUMN "settings" SET DEFAULT '{"lessonSequenceEnabled":false,"quizFeedbackEnabled":true}'::jsonb;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_slugs" ADD CONSTRAINT "course_slugs_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "course_slugs_course_id_lang_unique" ON "course_slugs" USING btree ("course_id","lang");