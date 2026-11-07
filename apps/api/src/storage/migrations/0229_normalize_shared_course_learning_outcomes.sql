-- Course transfers used to double-encode localized outcomes as a JSON string.
-- Decode only valid objects on shared copies; leave regular courses and other values alone.
WITH candidates AS (
  SELECT
    "id",
    CASE
      WHEN pg_input_is_valid("learning_outcomes" #>> '{}', 'jsonb')
        THEN ("learning_outcomes" #>> '{}')::jsonb
      ELSE NULL
    END AS "outcomes"
  FROM "courses"
  WHERE "origin_type" = 'exported'
    AND jsonb_typeof("learning_outcomes") = 'string'
)
UPDATE "courses"
SET "learning_outcomes" = candidates."outcomes"
FROM candidates
WHERE "courses"."id" = candidates."id"
  AND jsonb_typeof(candidates."outcomes") = 'object';
