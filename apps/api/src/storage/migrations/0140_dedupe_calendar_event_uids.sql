-- Custom SQL migration file, put you code below! --
WITH ranked_calendar_events AS (
  SELECT
    "calendar_events"."id",
    row_number() OVER (
      PARTITION BY "calendar_events"."uid"
      ORDER BY
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM "group_courses"
            WHERE "group_courses"."calendar_event_id" = "calendar_events"."id"
          ) THEN 0
          ELSE 1
        END,
        CASE WHEN "calendar_events"."deleted_at" IS NULL THEN 0 ELSE 1 END,
        "calendar_events"."updated_at" DESC,
        "calendar_events"."created_at" DESC,
        "calendar_events"."id"
    ) AS "rank"
  FROM "calendar_events"
)
UPDATE "calendar_events"
SET
  "uid" = concat("calendar_events"."uid", ':duplicate:', "calendar_events"."id"),
  "updated_at" = CURRENT_TIMESTAMP
FROM "ranked_calendar_events"
WHERE "calendar_events"."id" = "ranked_calendar_events"."id"
  AND "ranked_calendar_events"."rank" > 1;
