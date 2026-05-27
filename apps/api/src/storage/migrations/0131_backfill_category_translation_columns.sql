-- Custom SQL migration file, put you code below! --
DO $$
DECLARE
  category_record RECORD;
  parsed_title jsonb;
BEGIN
  FOR category_record IN
    SELECT "id", "title"
    FROM "categories"
  LOOP
    BEGIN
      parsed_title := category_record."title"::jsonb;

      IF jsonb_typeof(parsed_title) <> 'object' THEN
        parsed_title := NULL;
      END IF;
    EXCEPTION
      WHEN others THEN
        parsed_title := NULL;
    END;

    UPDATE "categories"
    SET
      "title_translations" = COALESCE(
        parsed_title,
        jsonb_build_object('en', category_record."title")
      ),
      "base_language" = 'en',
      "available_locales" = ARRAY['en']::text[]
    WHERE "id" = category_record."id";
  END LOOP;
END $$;
