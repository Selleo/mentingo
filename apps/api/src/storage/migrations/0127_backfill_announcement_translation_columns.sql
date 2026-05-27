-- Custom SQL migration file, put your code below! --
DO $$
DECLARE
  announcement_record RECORD;
  parsed_title jsonb;
  parsed_content jsonb;
BEGIN
  FOR announcement_record IN
    SELECT "id", "title", "content"
    FROM "announcements"
  LOOP
    BEGIN
      parsed_title := announcement_record."title"::jsonb;

      IF jsonb_typeof(parsed_title) <> 'object' THEN
        parsed_title := NULL;
      END IF;
    EXCEPTION
      WHEN others THEN
        parsed_title := NULL;
    END;

    BEGIN
      parsed_content := announcement_record."content"::jsonb;

      IF jsonb_typeof(parsed_content) <> 'object' THEN
        parsed_content := NULL;
      END IF;
    EXCEPTION
      WHEN others THEN
        parsed_content := NULL;
    END;

    UPDATE "announcements"
    SET
      "title_translations" = COALESCE(
        parsed_title,
        jsonb_build_object('en', announcement_record."title")
      ),
      "content_translations" = COALESCE(
        parsed_content,
        jsonb_build_object('en', announcement_record."content")
      ),
      "base_language" = 'en',
      "available_locales" = ARRAY['en']::text[]
    WHERE "id" = announcement_record."id";
  END LOOP;
END $$;
