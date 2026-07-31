-- Custom SQL migration file, put you code below! --
WITH "localized_lessons" AS (
  SELECT
    "courses"."id" AS "course_id",
    "course_languages"."language",
    "lessons"."id" AS "lesson_id",
    "lessons"."type" AS "lesson_type",
    COALESCE(
      "lessons"."description" ->> "course_languages"."language",
      "lessons"."description" ->> "courses"."base_language",
      ''
    ) AS "description_html",
    COUNT("questions"."id")::int AS "question_count"
  FROM "courses"
  CROSS JOIN LATERAL UNNEST("courses"."available_locales") AS "course_languages" ("language")
  LEFT JOIN "chapters" ON "chapters"."course_id" = "courses"."id"
  LEFT JOIN "lessons" ON "lessons"."chapter_id" = "chapters"."id"
  LEFT JOIN "questions" ON "questions"."lesson_id" = "lessons"."id"
  GROUP BY
    "courses"."id",
    "course_languages"."language",
    "lessons"."id",
    "lessons"."type",
    "lessons"."description",
    "courses"."base_language"
),
"lesson_content_counts" AS (
  SELECT
    "course_id",
    "language",
    "lesson_id",
    "lesson_type",
    "question_count",
    CASE
      WHEN BTRIM(REGEXP_REPLACE("description_html", '<[^>]*>', '', 'g')) = '' THEN 0
      ELSE CARDINALITY(
        REGEXP_SPLIT_TO_ARRAY(
          BTRIM(REGEXP_REPLACE("description_html", '<[^>]*>', '', 'g')),
          E'\\s+'
        )
      )
    END AS "word_count",
    (
      SELECT COUNT(*)
      FROM REGEXP_MATCHES(
        "description_html",
        'data-node-type=["'']video["'']',
        'gi'
      )
    ) AS "video_count",
    (
      SELECT COUNT(*)
      FROM REGEXP_MATCHES(
        "description_html",
        'data-node-type=["'']image["'']',
        'gi'
      )
    ) AS "image_count",
    (
      SELECT COUNT(*)
      FROM REGEXP_MATCHES(
        "description_html",
        'data-node-type=["'']downloadable-file["'']',
        'gi'
      )
    ) AS "download_count",
    (
      SELECT COUNT(*)
      FROM REGEXP_MATCHES(
        "description_html",
        'data-node-type=["'']presentation["'']',
        'gi'
      )
    ) AS "presentation_count"
  FROM "localized_lessons"
),
"lesson_duration_estimates" AS (
  SELECT
    "course_id",
    "language",
    CASE
      WHEN "lesson_id" IS NULL THEN 0
      WHEN "lesson_type" = 'content' THEN
        CEIL(("word_count" * 60.0) / 200)
        + ("video_count" * 180)
        + ("image_count" * 15)
        + ("download_count" * 30)
        + ("presentation_count" * 180)
        + ("question_count" * 60)
      WHEN "lesson_type" = 'quiz' THEN
        CEIL(("word_count" * 60.0) / 200)
        + ("question_count" * 60)
      WHEN "lesson_type" = 'ai_mentor' THEN
        CEIL(("word_count" * 60.0) / 200) + 600
      WHEN "lesson_type" = 'embed' THEN
        CEIL(("word_count" * 60.0) / 200) + 180
      ELSE CEIL(("word_count" * 60.0) / 200)
    END AS "estimated_seconds"
  FROM "lesson_content_counts"
),
"course_language_duration_estimates" AS (
  SELECT
    "course_id",
    "language",
    CASE
      WHEN SUM("estimated_seconds") > 0
        THEN CEIL(SUM("estimated_seconds") / 60.0)::int
      ELSE 0
    END AS "total_minutes"
  FROM "lesson_duration_estimates"
  GROUP BY "course_id", "language"
),
"course_duration_estimates" AS (
  SELECT
    "course_id",
    JSONB_OBJECT_AGG(
      "language",
      JSONB_BUILD_OBJECT(
        'totalMinutes',
        "total_minutes"
      )
    ) AS "duration_estimates"
  FROM "course_language_duration_estimates"
  GROUP BY "course_id"
)
UPDATE "courses"
SET "duration_estimates" = "course_duration_estimates"."duration_estimates"
FROM "course_duration_estimates"
WHERE "courses"."id" = "course_duration_estimates"."course_id";
