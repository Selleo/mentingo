-- Custom SQL migration file, put you code below! --
--
-- Backfill content lesson completion for students who watched all videos required
-- by at least one localized lesson description.

CREATE TEMP TABLE lesson_video_completion_backfill_candidates ON COMMIT DROP AS
WITH localized_video_refs AS (
  SELECT DISTINCT
    l.tenant_id,
    l.id AS lesson_id,
    c.id AS chapter_id,
    c.course_id,
    description_entry.key AS language_answered,
    re.id AS resource_entity_id
  FROM lessons l
  INNER JOIN chapters c
    ON c.id = l.chapter_id
  INNER JOIN courses crs
    ON crs.id = c.course_id
    AND crs.tenant_id = c.tenant_id
  CROSS JOIN LATERAL jsonb_each_text(l.description) AS description_entry(key, value)
  INNER JOIN resource_entity re
    ON re.entity_id = l.id
    AND re.entity_type = 'lesson'
    AND re.relationship_type = 'attachment'
    AND re.tenant_id = l.tenant_id
  INNER JOIN resources r
    ON r.id = re.resource_id
    AND r.tenant_id = re.tenant_id
  WHERE l.type = 'content'
    AND l.description IS NOT NULL
    AND jsonb_typeof(l.description) = 'object'
    AND c.tenant_id = l.tenant_id
    AND COALESCE((crs.settings->>'videoCompletionTrackingEnabled')::boolean, TRUE) = TRUE
    AND r.archived = FALSE
    AND r.content_type LIKE 'video/%'
    AND (
      description_entry.value ILIKE ('%' || re.resource_id::text || '%')
      OR description_entry.value ILIKE ('%' || re.id::text || '%')
    )
),
localized_video_sets AS (
  SELECT
    tenant_id,
    lesson_id,
    chapter_id,
    course_id,
    language_answered,
    COUNT(*) AS required_video_count
  FROM localized_video_refs
  GROUP BY tenant_id, lesson_id, chapter_id, course_id, language_answered
),
completed_localized_video_sets AS (
  SELECT
    refs.tenant_id,
    refs.lesson_id,
    refs.chapter_id,
    refs.course_id,
    refs.language_answered,
    lvp.student_id,
    MAX(lvp.watched_at) AS completed_at,
    COUNT(DISTINCT refs.resource_entity_id) AS watched_video_count
  FROM localized_video_refs refs
  INNER JOIN lesson_video_progress lvp
    ON lvp.lesson_id = refs.lesson_id
    AND lvp.resource_entity_id = refs.resource_entity_id
    AND lvp.tenant_id = refs.tenant_id
    AND lvp.is_watched = TRUE
  INNER JOIN users u
    ON u.id = lvp.student_id
    AND u.deleted_at IS NULL
  GROUP BY
    refs.tenant_id,
    refs.lesson_id,
    refs.chapter_id,
    refs.course_id,
    refs.language_answered,
    lvp.student_id
),
eligible_completions AS (
  SELECT
    completed_sets.tenant_id,
    completed_sets.lesson_id,
    completed_sets.chapter_id,
    completed_sets.course_id,
    completed_sets.language_answered,
    completed_sets.student_id,
    COALESCE(completed_sets.completed_at, CURRENT_TIMESTAMP) AS completed_at
  FROM completed_localized_video_sets completed_sets
  INNER JOIN localized_video_sets required_sets
    ON required_sets.tenant_id = completed_sets.tenant_id
    AND required_sets.lesson_id = completed_sets.lesson_id
    AND required_sets.chapter_id = completed_sets.chapter_id
    AND required_sets.course_id = completed_sets.course_id
    AND required_sets.language_answered = completed_sets.language_answered
  LEFT JOIN student_lesson_progress slp
    ON slp.lesson_id = completed_sets.lesson_id
    AND slp.student_id = completed_sets.student_id
    AND slp.tenant_id = completed_sets.tenant_id
  WHERE completed_sets.watched_video_count = required_sets.required_video_count
    AND slp.completed_at IS NULL
    AND (
      EXISTS (
        SELECT 1
        FROM student_courses sc
        WHERE sc.student_id = completed_sets.student_id
          AND sc.course_id = completed_sets.course_id
          AND sc.tenant_id = completed_sets.tenant_id
          AND sc.status = 'enrolled'
      )
      OR EXISTS (
        SELECT 1
        FROM chapters c
        WHERE c.id = completed_sets.chapter_id
          AND c.tenant_id = completed_sets.tenant_id
          AND c.is_freemium = TRUE
      )
      OR EXISTS (
        SELECT 1
        FROM course_student_mode csm
        WHERE csm.user_id = completed_sets.student_id
          AND csm.course_id = completed_sets.course_id
          AND csm.tenant_id = completed_sets.tenant_id
      )
    )
),
ranked_completions AS (
  SELECT
    eligible_completions.*,
    ROW_NUMBER() OVER (
      PARTITION BY student_id, lesson_id
      ORDER BY completed_at ASC, language_answered ASC
    ) AS completion_rank
  FROM eligible_completions
)
SELECT
  tenant_id,
  lesson_id,
  chapter_id,
  course_id,
  language_answered,
  student_id,
  completed_at
FROM ranked_completions
WHERE completion_rank = 1;

CREATE TEMP TABLE lesson_video_completion_backfilled_lessons ON COMMIT DROP AS
WITH upserted_lesson_progress AS (
  INSERT INTO student_lesson_progress (
    student_id,
    chapter_id,
    lesson_id,
    completed_question_count,
    is_started,
    completed_at,
    language_answered,
    tenant_id
  )
  SELECT
    student_id,
    chapter_id,
    lesson_id,
    0,
    TRUE,
    completed_at,
    language_answered,
    tenant_id
  FROM lesson_video_completion_backfill_candidates
  ON CONFLICT (student_id, lesson_id, chapter_id)
  DO UPDATE SET
    completed_at = EXCLUDED.completed_at,
    language_answered = EXCLUDED.language_answered,
    is_started = TRUE,
    updated_at = CURRENT_TIMESTAMP
  WHERE student_lesson_progress.completed_at IS NULL
  RETURNING
    student_lesson_progress.tenant_id,
    student_lesson_progress.student_id,
    student_lesson_progress.chapter_id,
    student_lesson_progress.lesson_id,
    student_lesson_progress.completed_at,
    student_lesson_progress.language_answered
)
SELECT
  upserted_lesson_progress.tenant_id,
  upserted_lesson_progress.student_id,
  upserted_lesson_progress.chapter_id,
  candidates.course_id,
  upserted_lesson_progress.lesson_id,
  upserted_lesson_progress.completed_at,
  upserted_lesson_progress.language_answered
FROM upserted_lesson_progress
INNER JOIN lesson_video_completion_backfill_candidates candidates
  ON candidates.student_id = upserted_lesson_progress.student_id
  AND candidates.lesson_id = upserted_lesson_progress.lesson_id;

CREATE TEMP TABLE lesson_video_completion_affected_chapters ON COMMIT DROP AS
SELECT DISTINCT
  tenant_id,
  student_id,
  chapter_id,
  course_id
FROM lesson_video_completion_backfilled_lessons;

INSERT INTO student_chapter_progress (
  student_id,
  course_id,
  chapter_id,
  completed_lesson_count,
  completed_at,
  completed_as_freemium,
  tenant_id
)
SELECT
  affected.student_id,
  affected.course_id,
  affected.chapter_id,
  COUNT(slp.id)::integer AS completed_lesson_count,
  CASE
    WHEN COUNT(slp.id)::integer = c.lesson_count THEN MAX(slp.completed_at)
    ELSE NULL
  END AS completed_at,
  CASE
    WHEN COUNT(slp.id)::integer = c.lesson_count
      AND sc.id IS NULL
      AND c.is_freemium = TRUE
      THEN TRUE
    ELSE FALSE
  END AS completed_as_freemium,
  affected.tenant_id
FROM lesson_video_completion_affected_chapters affected
INNER JOIN chapters c
  ON c.id = affected.chapter_id
  AND c.tenant_id = affected.tenant_id
LEFT JOIN student_lesson_progress slp
  ON slp.student_id = affected.student_id
  AND slp.chapter_id = affected.chapter_id
  AND slp.tenant_id = affected.tenant_id
  AND slp.completed_at IS NOT NULL
LEFT JOIN student_courses sc
  ON sc.student_id = affected.student_id
  AND sc.course_id = affected.course_id
  AND sc.tenant_id = affected.tenant_id
  AND sc.status = 'enrolled'
GROUP BY
  affected.tenant_id,
  affected.student_id,
  affected.course_id,
  affected.chapter_id,
  c.lesson_count,
  c.is_freemium,
  sc.id
ON CONFLICT (student_id, course_id, chapter_id)
DO UPDATE SET
  completed_lesson_count = EXCLUDED.completed_lesson_count,
  completed_at = EXCLUDED.completed_at,
  completed_as_freemium = EXCLUDED.completed_as_freemium,
  updated_at = CURRENT_TIMESTAMP;

CREATE TEMP TABLE lesson_video_completion_affected_courses ON COMMIT DROP AS
SELECT DISTINCT
  backfilled.tenant_id,
  backfilled.student_id,
  backfilled.course_id,
  FIRST_VALUE(backfilled.language_answered) OVER (
    PARTITION BY backfilled.student_id, backfilled.course_id
    ORDER BY backfilled.completed_at DESC, backfilled.lesson_id
  ) AS completed_language
FROM lesson_video_completion_backfilled_lessons backfilled
INNER JOIN student_courses sc
  ON sc.student_id = backfilled.student_id
  AND sc.course_id = backfilled.course_id
  AND sc.tenant_id = backfilled.tenant_id
  AND sc.status = 'enrolled';

WITH course_progress AS (
  SELECT
    affected.tenant_id,
    affected.student_id,
    affected.course_id,
    affected.completed_language,
    COUNT(scp.id)::integer AS finished_chapter_count,
    MAX(scp.completed_at) AS completed_at,
    c.chapter_count
  FROM lesson_video_completion_affected_courses affected
  INNER JOIN courses c
    ON c.id = affected.course_id
    AND c.tenant_id = affected.tenant_id
  LEFT JOIN student_chapter_progress scp
    ON scp.student_id = affected.student_id
    AND scp.course_id = affected.course_id
    AND scp.tenant_id = affected.tenant_id
    AND scp.completed_at IS NOT NULL
  GROUP BY
    affected.tenant_id,
    affected.student_id,
    affected.course_id,
    affected.completed_language,
    c.chapter_count
)
UPDATE student_courses sc
SET
  finished_chapter_count = course_progress.finished_chapter_count,
  progress = CASE
    WHEN course_progress.finished_chapter_count = course_progress.chapter_count THEN 'completed'
    WHEN sc.progress = 'completed' THEN sc.progress
    ELSE 'in_progress'
  END,
  completed_at = CASE
    WHEN course_progress.finished_chapter_count = course_progress.chapter_count
      AND sc.progress <> 'completed' THEN
      COALESCE(sc.completed_at, course_progress.completed_at, CURRENT_TIMESTAMP)
    WHEN sc.progress = 'completed' THEN sc.completed_at
    ELSE NULL
  END,
  course_completion_metadata = CASE
    WHEN course_progress.finished_chapter_count = course_progress.chapter_count
      AND sc.progress <> 'completed' THEN
      jsonb_set(
        COALESCE(sc.course_completion_metadata, '{}'::jsonb),
        '{completed_language}',
        to_jsonb(course_progress.completed_language),
        TRUE
      )
    ELSE sc.course_completion_metadata
  END,
  updated_at = CURRENT_TIMESTAMP
FROM course_progress
WHERE sc.student_id = course_progress.student_id
  AND sc.course_id = course_progress.course_id
  AND sc.tenant_id = course_progress.tenant_id
  AND sc.status = 'enrolled';
