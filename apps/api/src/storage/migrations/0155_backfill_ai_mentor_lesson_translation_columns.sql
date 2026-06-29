-- Custom SQL migration file, put you code below! --
DO $$
DECLARE
  ai_mentor_lesson_record RECORD;
  parsed_ai_mentor_instructions jsonb;
  parsed_completion_conditions jsonb;
BEGIN
  FOR ai_mentor_lesson_record IN
    SELECT "id", "ai_mentor_instructions", "completion_conditions"
    FROM "ai_mentor_lessons"
  LOOP
    BEGIN
      parsed_ai_mentor_instructions := ai_mentor_lesson_record."ai_mentor_instructions"::jsonb;

      IF jsonb_typeof(parsed_ai_mentor_instructions) <> 'object' THEN
        parsed_ai_mentor_instructions := NULL;
      END IF;
    EXCEPTION
      WHEN others THEN
        parsed_ai_mentor_instructions := NULL;
    END;

    BEGIN
      parsed_completion_conditions := ai_mentor_lesson_record."completion_conditions"::jsonb;

      IF jsonb_typeof(parsed_completion_conditions) <> 'object' THEN
        parsed_completion_conditions := NULL;
      END IF;
    EXCEPTION
      WHEN others THEN
        parsed_completion_conditions := NULL;
    END;

    UPDATE "ai_mentor_lessons"
    SET
      "ai_mentor_instructions_translations" = COALESCE(
        parsed_ai_mentor_instructions,
        jsonb_build_object('en', ai_mentor_lesson_record."ai_mentor_instructions")
      ),
      "completion_conditions_translations" = COALESCE(
        parsed_completion_conditions,
        jsonb_build_object('en', ai_mentor_lesson_record."completion_conditions")
      )
    WHERE "id" = ai_mentor_lesson_record."id";
  END LOOP;
END $$;
