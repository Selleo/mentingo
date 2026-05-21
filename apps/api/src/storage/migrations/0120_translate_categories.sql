DO $$
DECLARE
  category_record RECORD;
  parsed_title jsonb;
BEGIN
  FOR category_record IN
    SELECT "id", "title"
    FROM "categories"
    WHERE "title" IS NOT NULL
  LOOP
    BEGIN
      parsed_title := category_record."title"::jsonb;

      IF jsonb_typeof(parsed_title) = 'object' THEN
        CONTINUE;
      END IF;
    EXCEPTION
      WHEN others THEN
        parsed_title := NULL;
    END;

    UPDATE "categories"
    SET "title" = jsonb_build_object('en', category_record."title")::text
    WHERE "id" = category_record."id";
  END LOOP;
END $$;
