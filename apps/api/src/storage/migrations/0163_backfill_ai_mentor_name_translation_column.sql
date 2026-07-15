-- Custom SQL migration file, put you code below! --
DO $$
DECLARE
  ai_mentor_lesson_record RECORD;
  parsed_name jsonb;
BEGIN
  FOR ai_mentor_lesson_record IN
    SELECT "id", "name"
    FROM "ai_mentor_lessons"
  LOOP
    BEGIN
      parsed_name := ai_mentor_lesson_record."name"::jsonb;

      IF jsonb_typeof(parsed_name) <> 'object' THEN
        parsed_name := NULL;
      END IF;
    EXCEPTION
      WHEN others THEN
        parsed_name := NULL;
    END;

    UPDATE "ai_mentor_lessons"
    SET "name_translations" = COALESCE(
      parsed_name,
      jsonb_build_object('en', ai_mentor_lesson_record."name")
    )
    WHERE "id" = ai_mentor_lesson_record."id";
  END LOOP;
END $$;
