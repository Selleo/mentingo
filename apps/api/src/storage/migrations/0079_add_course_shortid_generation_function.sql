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

CREATE OR REPLACE FUNCTION set_course_short_id() RETURNS trigger AS $$
BEGIN
  IF NEW.short_id IS NULL OR NEW.short_id = '' THEN
    NEW.short_id := generate_course_short_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER courses_set_short_id_trigger
  BEFORE INSERT ON courses
  FOR EACH ROW
  EXECUTE FUNCTION set_course_short_id();

UPDATE "courses" SET "short_id" = generate_course_short_id() WHERE "short_id" IS NULL;

ALTER TABLE "courses" ALTER COLUMN "short_id" SET NOT NULL;