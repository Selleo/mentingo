CREATE TABLE IF NOT EXISTS "course_slugs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"slug" text NOT NULL,
	"course_short_id" varchar(5) NOT NULL,
	"lang" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "short_id" varchar(5);--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_short_id_unique" UNIQUE("short_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_slugs" ADD CONSTRAINT "course_slugs_course_short_id_courses_short_id_fk" FOREIGN KEY ("course_short_id") REFERENCES "public"."courses"("short_id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "course_slug_course_short_id_lang_slug_unique_idx" ON "course_slugs" USING btree ("course_short_id","lang","slug");