-- Custom SQL migration file, put you code below! --

DO $$
DECLARE
  group_record RECORD;
  parsed_name jsonb;
  parsed_characteristic jsonb;
BEGIN
  FOR group_record IN
    SELECT "id", "name", "characteristic"
    FROM "groups"
  LOOP
    BEGIN
      parsed_name := group_record."name"::jsonb;

      IF jsonb_typeof(parsed_name) = 'object' THEN
        parsed_name := group_record."name"::jsonb;
      ELSE
        parsed_name := NULL;
      END IF;
    EXCEPTION
      WHEN others THEN
        parsed_name := NULL;
    END;

    IF group_record."characteristic" IS NOT NULL THEN
      BEGIN
        parsed_characteristic := group_record."characteristic"::jsonb;

        IF jsonb_typeof(parsed_characteristic) = 'object' THEN
          parsed_characteristic := group_record."characteristic"::jsonb;
        ELSE
          parsed_characteristic := NULL;
        END IF;
      EXCEPTION
        WHEN others THEN
          parsed_characteristic := NULL;
      END;
    ELSE
      parsed_characteristic := NULL;
    END IF;

    UPDATE "groups"
    SET
      "name" = COALESCE(parsed_name, jsonb_build_object('en', group_record."name"))::text,
      "characteristic" = CASE
        WHEN group_record."characteristic" IS NULL THEN NULL
        ELSE COALESCE(
          parsed_characteristic,
          jsonb_build_object('en', group_record."characteristic")
        )::text
      END
    WHERE "id" = group_record."id";
  END LOOP;
END $$;
