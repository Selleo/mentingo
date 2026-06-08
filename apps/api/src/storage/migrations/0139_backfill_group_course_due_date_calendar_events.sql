WITH source_rows AS (
  SELECT
    "group_courses"."id" AS "group_course_id",
    "group_courses"."tenant_id",
    "group_courses"."course_id",
    "group_courses"."group_id",
    "courses"."title",
    "courses"."base_language",
    "courses"."available_locales",
    date_trunc('day', "group_courses"."due_date" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS "starts_at",
    (date_trunc('day', "group_courses"."due_date" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') + interval '1 day' AS "ends_at",
    concat('course-due-date:', "group_courses"."course_id", ':', "group_courses"."group_id") AS "uid"
  FROM "group_courses"
  INNER JOIN "courses" ON "courses"."id" = "group_courses"."course_id"
  WHERE "group_courses"."is_mandatory" = true
    AND "group_courses"."due_date" IS NOT NULL
    AND "group_courses"."calendar_event_id" IS NULL
),
inserted_calendar_events AS (
  INSERT INTO "calendar_events" (
    "tenant_id",
    "uid",
    "sequence",
    "status",
    "base_language",
    "available_locales",
    "title",
    "description",
    "starts_at",
    "ends_at",
    "all_day",
    "timezone",
    "location",
    "organizer_user_id",
    "rrule",
    "exdates",
    "deleted_at"
  )
  SELECT
    "source_rows"."tenant_id",
    "source_rows"."uid",
    0,
    'scheduled',
    "source_rows"."base_language",
    "source_rows"."available_locales",
    "source_rows"."title",
    null,
    "source_rows"."starts_at",
    "source_rows"."ends_at",
    true,
    'UTC',
    null,
    null,
    null,
    null,
    null
  FROM "source_rows"
  RETURNING "id", "uid"
)
UPDATE "group_courses"
SET "calendar_event_id" = "inserted_calendar_events"."id"
FROM "source_rows"
INNER JOIN "inserted_calendar_events" ON "inserted_calendar_events"."uid" = "source_rows"."uid"
WHERE "group_courses"."id" = "source_rows"."group_course_id";
