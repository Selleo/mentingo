CREATE TABLE IF NOT EXISTS "course_slugs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"slug" text NOT NULL,
	"course_short_id" varchar(5) NOT NULL,
	"lang" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "short_id" varchar(5);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION generate_course_short_id() RETURNS text AS $$
DECLARE
  chars text := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result text := '';
  i int;
  max_attempts int := 100;
  attempt int := 0;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..5 LOOP
      result := result || substr(chars, floor(random() * 36 + 1)::int, 1);
    END LOOP;

    IF NOT EXISTS (SELECT 1 FROM courses WHERE short_id = result) THEN
      RETURN result;
    END IF;

    attempt := attempt + 1;
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique short_id after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION set_course_short_id() RETURNS trigger AS $$
BEGIN
  IF NEW.short_id IS NULL OR NEW.short_id = '' THEN
    NEW.short_id := generate_course_short_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER courses_set_short_id_trigger
  BEFORE INSERT ON courses
  FOR EACH ROW
  EXECUTE FUNCTION set_course_short_id();
--> statement-breakpoint
UPDATE "courses" SET "short_id" = generate_course_short_id() WHERE "short_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "courses" ALTER COLUMN "short_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_short_id_unique" UNIQUE("short_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_slugs" ADD CONSTRAINT "course_slugs_course_short_id_courses_short_id_fk" FOREIGN KEY ("course_short_id") REFERENCES "public"."courses"("short_id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "course_slug_course_short_id_lang_slug_unique_idx" ON "course_slugs" USING btree ("course_short_id","lang","slug");