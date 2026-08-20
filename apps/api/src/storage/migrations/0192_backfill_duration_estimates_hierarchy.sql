CREATE TEMP TABLE "duration_lesson_projection" ON COMMIT DROP AS
WITH "course_languages" AS (
  SELECT "courses"."id" AS "course_id", "courses"."base_language" AS "language"
  FROM "courses"
  UNION
  SELECT "courses"."id", "locale"."language"
  FROM "courses"
  CROSS JOIN LATERAL unnest("courses"."available_locales") AS "locale" ("language")
), "localized_lessons" AS (
  SELECT
    "lessons"."id" AS "lesson_id",
    "lessons"."chapter_id",
    "lessons"."type" AS "lesson_type",
    "course_languages"."language",
    COALESCE(
      CASE
        WHEN "courses"."available_locales" @> ARRAY["course_languages"."language"]::text[]
          THEN COALESCE("lessons"."description" ->> "course_languages"."language", "lessons"."description" ->> "courses"."base_language")
        ELSE "lessons"."description" ->> "courses"."base_language"
      END,
      ''
    ) AS "description_html",
    COUNT("questions"."id")::int AS "question_count"
  FROM "lessons"
  INNER JOIN "chapters" ON "chapters"."id" = "lessons"."chapter_id"
  INNER JOIN "courses" ON "courses"."id" = "chapters"."course_id"
  INNER JOIN "course_languages" ON "course_languages"."course_id" = "courses"."id"
  LEFT JOIN "questions" ON "questions"."lesson_id" = "lessons"."id"
  GROUP BY "lessons"."id", "lessons"."chapter_id", "lessons"."type", "course_languages"."language", "lessons"."description", "courses"."available_locales", "courses"."base_language"
), "content_nodes" AS (
  SELECT
    "localized_lessons".*,
    "node"."match"[1] AS "node_html",
    "node"."match"[2] AS "node_type",
    (regexp_match("node"."match"[1], 'lesson-resource/([0-9a-fA-F-]{36})'))[1] AS "resource_reference"
  FROM "localized_lessons"
  LEFT JOIN LATERAL regexp_matches(
    "localized_lessons"."description_html",
    '(<[^>]*data-node-type=["''](video|image|downloadable-file|presentation)["''][^>]*>)',
    'gi'
  ) AS "node" ("match") ON TRUE
), "lesson_seconds" AS (
  SELECT
    "lesson_id",
    "chapter_id",
    "language",
    CASE
      WHEN "lesson_type" = 'content' THEN
        CASE
          WHEN btrim(regexp_replace("description_html", '<[^>]*>', '', 'g')) = '' THEN 0
          ELSE cardinality(regexp_split_to_array(btrim(regexp_replace("description_html", '<[^>]*>', '', 'g')), E'\\s+'))
        END * 60.0 / 200
        + COALESCE(SUM(CASE WHEN "node_type" = 'video' THEN COALESCE((
            SELECT ceil(NULLIF("resources"."metadata" ->> 'durationSeconds', '')::numeric)
            FROM "resources"
            LEFT JOIN "resource_entity" ON "resource_entity"."resource_id" = "resources"."id" AND "resource_entity"."entity_type" = 'lesson'
            WHERE ("resources"."id"::text = "resource_reference" OR "resource_entity"."id"::text = "resource_reference")
              AND ("resources"."metadata" ->> 'durationSeconds') ~ '^[0-9]+([.][0-9]+)?$'
              AND NULLIF("resources"."metadata" ->> 'durationSeconds', '')::numeric > 0
            LIMIT 1
          ), 180) ELSE 0 END), 0)
        + COALESCE(SUM(CASE WHEN "node_type" = 'image' THEN 15 ELSE 0 END), 0)
        + COALESCE(SUM(CASE WHEN "node_type" = 'downloadable-file' THEN 30 ELSE 0 END), 0)
        + COALESCE(SUM(CASE WHEN "node_type" = 'presentation' THEN 180 ELSE 0 END), 0)
        + "question_count" * 60
      WHEN "lesson_type" = 'quiz' THEN
        CASE
          WHEN btrim(regexp_replace("description_html", '<[^>]*>', '', 'g')) = '' THEN 0
          ELSE cardinality(regexp_split_to_array(btrim(regexp_replace("description_html", '<[^>]*>', '', 'g')), E'\\s+'))
        END * 60.0 / 200 + "question_count" * 60
      WHEN "lesson_type" = 'ai_mentor' THEN
        CASE
          WHEN btrim(regexp_replace("description_html", '<[^>]*>', '', 'g')) = '' THEN 0
          ELSE cardinality(regexp_split_to_array(btrim(regexp_replace("description_html", '<[^>]*>', '', 'g')), E'\\s+'))
        END * 60.0 / 200 + 600
      WHEN "lesson_type" = 'embed' THEN
        CASE
          WHEN btrim(regexp_replace("description_html", '<[^>]*>', '', 'g')) = '' THEN 0
          ELSE cardinality(regexp_split_to_array(btrim(regexp_replace("description_html", '<[^>]*>', '', 'g')), E'\\s+'))
        END * 60.0 / 200 + 180
      ELSE
        CASE
          WHEN btrim(regexp_replace("description_html", '<[^>]*>', '', 'g')) = '' THEN 0
          ELSE cardinality(regexp_split_to_array(btrim(regexp_replace("description_html", '<[^>]*>', '', 'g')), E'\\s+'))
        END * 60.0 / 200
    END AS "estimated_seconds"
  FROM "content_nodes"
  GROUP BY "lesson_id", "chapter_id", "lesson_type", "language", "description_html", "question_count"
)
SELECT
  "lesson_id",
  jsonb_object_agg("language", jsonb_build_object('totalSeconds', ceil("estimated_seconds")::int)) AS "duration_estimates"
FROM "lesson_seconds"
GROUP BY "lesson_id";

UPDATE "lessons"
SET "duration_estimates" = "duration_lesson_projection"."duration_estimates"
FROM "duration_lesson_projection"
WHERE "lessons"."id" = "duration_lesson_projection"."lesson_id";

CREATE TEMP TABLE "duration_chapter_projection" ON COMMIT DROP AS
WITH "course_languages" AS (
  SELECT "courses"."id" AS "course_id", "courses"."base_language" AS "language"
  FROM "courses"
  UNION
  SELECT "courses"."id", "locale"."language"
  FROM "courses"
  CROSS JOIN LATERAL unnest("courses"."available_locales") AS "locale" ("language")
), "chapter_language_totals" AS (
  SELECT
    "chapters"."id" AS "chapter_id",
    "course_languages"."language",
    COALESCE(SUM(("duration_lesson_projection"."duration_estimates" -> "course_languages"."language" ->> 'totalSeconds')::int), 0) AS "total_seconds"
  FROM "chapters"
  INNER JOIN "course_languages" ON "course_languages"."course_id" = "chapters"."course_id"
  LEFT JOIN "lessons" ON "lessons"."chapter_id" = "chapters"."id"
  LEFT JOIN "duration_lesson_projection" ON "duration_lesson_projection"."lesson_id" = "lessons"."id"
  GROUP BY "chapters"."id", "course_languages"."language"
)
SELECT
  "chapter_id",
  jsonb_object_agg("language", jsonb_build_object('totalSeconds', "total_seconds")) AS "duration_estimates"
FROM "chapter_language_totals"
GROUP BY "chapter_id";

UPDATE "chapters"
SET "duration_estimates" = "duration_chapter_projection"."duration_estimates"
FROM "duration_chapter_projection"
WHERE "chapters"."id" = "duration_chapter_projection"."chapter_id";

CREATE TEMP TABLE "duration_course_projection" ON COMMIT DROP AS
WITH "course_languages" AS (
  SELECT "courses"."id" AS "course_id", "courses"."base_language" AS "language"
  FROM "courses"
  UNION
  SELECT "courses"."id", "locale"."language"
  FROM "courses"
  CROSS JOIN LATERAL unnest("courses"."available_locales") AS "locale" ("language")
), "course_language_totals" AS (
  SELECT
    "courses"."id" AS "course_id",
    "course_languages"."language",
    COALESCE(SUM(("duration_chapter_projection"."duration_estimates" -> "course_languages"."language" ->> 'totalSeconds')::int), 0) AS "total_seconds"
  FROM "courses"
  INNER JOIN "course_languages" ON "course_languages"."course_id" = "courses"."id"
  LEFT JOIN "chapters" ON "chapters"."course_id" = "courses"."id"
  LEFT JOIN "duration_chapter_projection" ON "duration_chapter_projection"."chapter_id" = "chapters"."id"
  GROUP BY "courses"."id", "course_languages"."language"
)
SELECT
  "course_id",
  jsonb_object_agg("language", jsonb_build_object('totalSeconds', "total_seconds")) AS "duration_estimates"
FROM "course_language_totals"
GROUP BY "course_id";

UPDATE "courses"
SET "duration_estimates" = "duration_course_projection"."duration_estimates"
FROM "duration_course_projection"
WHERE "courses"."id" = "duration_course_projection"."course_id";
