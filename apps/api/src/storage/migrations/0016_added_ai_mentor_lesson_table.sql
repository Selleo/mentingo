CREATE TABLE IF NOT EXISTS "ai_mentor_lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"lesson_id" uuid NOT NULL,
	"ai_mentor_instructions" text NOT NULL,
	"completion_conditions" text NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_mentor_lessons" ADD CONSTRAINT "ai_mentor_lessons_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
