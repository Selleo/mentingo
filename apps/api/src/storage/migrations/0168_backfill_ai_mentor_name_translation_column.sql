-- Custom SQL migration file, put you code below! --
DO $$
DECLARE
  ai_mentor_lesson_record RECORD;
  parsed_name jsonb;
BEGIN
  FOR ai_mentor_lesson_record IN
    SELECT ai_mentor_lesson."id", ai_mentor_lesson."name", course."base_language"
    FROM "ai_mentor_lessons" AS ai_mentor_lesson
    INNER JOIN "lessons" AS lesson ON lesson."id" = ai_mentor_lesson."lesson_id"
    INNER JOIN "chapters" AS chapter ON chapter."id" = lesson."chapter_id"
    INNER JOIN "courses" AS course ON course."id" = chapter."course_id"
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
      jsonb_build_object(
        ai_mentor_lesson_record."base_language",
        ai_mentor_lesson_record."name"
      )
    )
    WHERE "id" = ai_mentor_lesson_record."id";
  END LOOP;
END $$;
