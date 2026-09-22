-- Backfill the target assessment model from the legacy quiz model.
-- Legacy question and attempt IDs are retained. Localized option IDs receive
-- new UUIDs, while each logical blank receives one UUID shared by all of its
-- localized rows.

INSERT INTO assessments (
  id,
  lesson_id,
  passing_score_percentage,
  attempt_limit_mode,
  maximum_attempts,
  attempt_cooldown,
  feedback_mode,
  base_language,
  available_locales,
  created_at,
  updated_at,
  tenant_id
)
SELECT
  lesson.id,
  lesson.id,
  LEAST(GREATEST(COALESCE(lesson.threshold_score, 0), 0), 100),
  CASE
    WHEN lesson.attempts_limit IS NULL OR lesson.attempts_limit <= 0 THEN 'none'
    WHEN lesson.quiz_cooldown_in_hours IS NULL OR lesson.quiz_cooldown_in_hours <= 0 THEN 'lifetime'
    ELSE 'cooldown_window'
  END,
  CASE WHEN lesson.attempts_limit > 0 THEN lesson.attempts_limit ELSE NULL END,
  CASE
    WHEN lesson.attempts_limit > 0 AND lesson.quiz_cooldown_in_hours > 0
      THEN lesson.quiz_cooldown_in_hours * interval '1 hour'
    ELSE NULL
  END,
  'full',
  CASE
    WHEN lesson.title ? 'en' THEN 'en'
    ELSE COALESCE((SELECT key FROM jsonb_object_keys(lesson.title) AS key LIMIT 1), 'en')
  END,
  CASE
    WHEN EXISTS (SELECT 1 FROM jsonb_object_keys(lesson.title))
      THEN ARRAY(SELECT key FROM jsonb_object_keys(lesson.title) AS key)
    ELSE ARRAY['en']::text[]
  END,
  lesson.created_at,
  lesson.updated_at,
  lesson.tenant_id
FROM lessons AS lesson
WHERE lesson.type = 'quiz'
ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE quiz_localized_option_backfill AS
SELECT
  gen_random_uuid() AS id,
  option.id AS legacy_id,
  option.question_id,
  localized_option.key AS language,
  localized_option.value AS label,
  NULLIF(option.matched_word ->> localized_option.key, '') AS matched_word,
  option.is_correct,
  option.scale_answer,
  row_number() OVER (
    PARTITION BY option.question_id, localized_option.key
    ORDER BY option.display_order NULLS LAST, option.created_at, option.id
  ) AS display_order,
  option.created_at,
  option.updated_at,
  option.tenant_id
FROM question_answer_options AS option
JOIN questions AS question ON question.id = option.question_id
JOIN lessons AS lesson ON lesson.id = question.lesson_id
CROSS JOIN LATERAL jsonb_each_text(COALESCE(option.option_text, '{}'::jsonb)) AS localized_option
WHERE lesson.type = 'quiz';

INSERT INTO assessment_questions (
  id,
  assessment_id,
  question_type,
  display_order,
  maximum_points,
  grading_mode,
  prompt,
  title,
  description,
  created_at,
  updated_at,
  tenant_id
)
SELECT
  question.id,
  question.lesson_id,
  question.type,
  row_number() OVER (
    PARTITION BY question.lesson_id
    ORDER BY question.display_order NULLS LAST, question.created_at, question.id
  ),
  1,
  CASE
    WHEN question.type IN ('brief_response', 'detailed_response') THEN 'manual'
    ELSE 'automatic'
  END,
  COALESCE(question.description, question.title, '{}'::jsonb),
  question.title,
  question.description,
  question.created_at,
  question.updated_at,
  question.tenant_id
FROM questions AS question
JOIN lessons AS lesson ON lesson.id = question.lesson_id
WHERE lesson.type = 'quiz'
ON CONFLICT (id) DO NOTHING;

INSERT INTO assessment_question_choice_options (
  id,
  question_id,
  language,
  display_order,
  is_correct,
  label,
  created_at,
  updated_at,
  tenant_id
)
SELECT
  option.id,
  option.question_id,
  option.language,
  option.display_order,
  option.is_correct,
  option.label,
  option.created_at,
  option.updated_at,
  option.tenant_id
FROM quiz_localized_option_backfill AS option
JOIN questions AS question ON question.id = option.question_id
JOIN lessons AS lesson ON lesson.id = question.lesson_id
WHERE lesson.type = 'quiz'
  AND question.type IN (
    'single_choice',
    'multiple_choice',
    'photo_question_single_choice',
    'photo_question_multiple_choice'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO assessment_question_true_false_statements (
  id,
  question_id,
  language,
  display_order,
  correct_value,
  statement,
  created_at,
  updated_at,
  tenant_id
)
SELECT
  option.id,
  option.question_id,
  option.language,
  option.display_order,
  option.is_correct,
  option.label,
  option.created_at,
  option.updated_at,
  option.tenant_id
FROM quiz_localized_option_backfill AS option
JOIN questions AS question ON question.id = option.question_id
JOIN lessons AS lesson ON lesson.id = question.lesson_id
WHERE lesson.type = 'quiz'
  AND question.type = 'true_or_false'
ON CONFLICT (id) DO NOTHING;

INSERT INTO assessment_question_scale_options (
  id,
  question_id,
  scale_value,
  display_order,
  label,
  created_at,
  updated_at,
  tenant_id
)
SELECT
  option.id,
  option.question_id,
  CASE
    WHEN option.scale_answer BETWEEN 1 AND 5 THEN option.scale_answer
    ELSE row_number() OVER (
      PARTITION BY option.question_id
      ORDER BY option.display_order NULLS LAST, option.created_at, option.id
    )
  END,
  row_number() OVER (
    PARTITION BY option.question_id
    ORDER BY option.display_order NULLS LAST, option.created_at, option.id
  ),
  COALESCE(option.option_text, '{}'::jsonb),
  option.created_at,
  option.updated_at,
  option.tenant_id
FROM question_answer_options AS option
JOIN questions AS question ON question.id = option.question_id
JOIN lessons AS lesson ON lesson.id = question.lesson_id
WHERE lesson.type = 'quiz'
  AND question.type = 'scale_1_5'
ON CONFLICT (id) DO NOTHING;

INSERT INTO assessment_question_open_text_settings (
  question_id,
  minimum_characters,
  maximum_characters,
  reviewer_instructions,
  created_at,
  updated_at,
  tenant_id
)
SELECT
  question.id,
  NULL,
  NULL,
  NULL,
  question.created_at,
  question.updated_at,
  question.tenant_id
FROM questions AS question
JOIN lessons AS lesson ON lesson.id = question.lesson_id
WHERE lesson.type = 'quiz'
  AND question.type IN ('brief_response', 'detailed_response')
ON CONFLICT (question_id) DO NOTHING;

CREATE TEMP TABLE quiz_blank_marker_source_backfill AS
WITH localized_prompts AS (
  SELECT
    question.id AS question_id,
    question.type AS question_type,
    localized_prompt.key AS language,
    localized_prompt.value AS prompt,
    question.created_at,
    question.updated_at,
    question.tenant_id
  FROM questions AS question
  JOIN lessons AS lesson ON lesson.id = question.lesson_id
  CROSS JOIN LATERAL jsonb_each_text(
    COALESCE(question.description, question.title, '{}'::jsonb)
  ) AS localized_prompt
  WHERE lesson.type = 'quiz'
    AND question.type IN ('fill_in_the_blanks_text', 'fill_in_the_blanks_dnd')
),
tagged_marker_occurrences AS (
  SELECT
    localized_prompt.*,
    marker.captures[1] AS legacy_marker_id,
    marker.occurrence
  FROM localized_prompts AS localized_prompt
  CROSS JOIN LATERAL regexp_matches(
    localized_prompt.prompt,
    '<blank-answer-([^>]+)>',
    'g'
  ) WITH ORDINALITY AS marker(captures, occurrence)
),
unique_tagged_markers AS (
  SELECT DISTINCT ON (question_id, language, legacy_marker_id)
    question_id,
    question_type,
    language,
    prompt,
    legacy_marker_id,
    occurrence,
    created_at,
    updated_at,
    tenant_id
  FROM tagged_marker_occurrences
  ORDER BY question_id, language, legacy_marker_id, occurrence
),
tagged_markers AS (
  SELECT
    question_id,
    question_type,
    language,
    prompt,
    'tagged'::text AS marker_type,
    legacy_marker_id,
    row_number() OVER (
      PARTITION BY question_id, language
      ORDER BY occurrence
    ) AS marker_position,
    created_at,
    updated_at,
    tenant_id
  FROM unique_tagged_markers
),
word_markers AS (
  SELECT
    localized_prompt.question_id,
    localized_prompt.question_type,
    localized_prompt.language,
    localized_prompt.prompt,
    'word'::text AS marker_type,
    NULL::text AS legacy_marker_id,
    marker.occurrence AS marker_position,
    localized_prompt.created_at,
    localized_prompt.updated_at,
    localized_prompt.tenant_id
  FROM localized_prompts AS localized_prompt
  CROSS JOIN LATERAL regexp_matches(
    localized_prompt.prompt,
    '\[word\]',
    'g'
  ) WITH ORDINALITY AS marker(captures, occurrence)
  WHERE localized_prompt.prompt !~ '<blank-answer-[^>]+>'
)
SELECT
  question_id,
  question_type,
  language,
  prompt,
  marker_type,
  legacy_marker_id,
  marker_position,
  created_at,
  updated_at,
  tenant_id
FROM tagged_markers
UNION ALL
SELECT
  question_id,
  question_type,
  language,
  prompt,
  marker_type,
  legacy_marker_id,
  marker_position,
  created_at,
  updated_at,
  tenant_id
FROM word_markers;

CREATE TEMP TABLE quiz_blank_id_backfill AS
SELECT
  logical_blank.question_id,
  logical_blank.marker_position,
  gen_random_uuid() AS blank_id
FROM (
  SELECT DISTINCT question_id, marker_position
  FROM quiz_blank_marker_source_backfill
) AS logical_blank;

CREATE TEMP TABLE quiz_blank_marker_backfill AS
SELECT
  blank_id.blank_id,
  marker.*
FROM quiz_blank_marker_source_backfill AS marker
JOIN quiz_blank_id_backfill AS blank_id
  ON blank_id.question_id = marker.question_id
 AND blank_id.marker_position = marker.marker_position;

DROP TABLE quiz_blank_id_backfill;
DROP TABLE quiz_blank_marker_source_backfill;

CREATE TEMP TABLE quiz_blank_option_backfill AS
WITH candidate_options AS (
  SELECT option.*
  FROM quiz_localized_option_backfill AS option
  JOIN questions AS question ON question.id = option.question_id
  WHERE question.type IN ('fill_in_the_blanks_text', 'fill_in_the_blanks_dnd')
    AND (
      option.is_correct
      OR (
        (
          SELECT COUNT(*)
          FROM quiz_blank_marker_backfill AS marker
          WHERE marker.question_id = option.question_id
            AND marker.language = option.language
        ) > (
          SELECT COUNT(*)
          FROM quiz_localized_option_backfill AS correct_option
          WHERE correct_option.question_id = option.question_id
            AND correct_option.language = option.language
            AND correct_option.is_correct
        )
        AND position(
          lower(option.label) IN lower(
            COALESCE(question.solution_explanation ->> option.language, '')
          )
        ) > 0
      )
    )
),
exact_matches AS (
  SELECT
    marker.*,
    option.id AS option_id,
    option.legacy_id AS legacy_option_id,
    COALESCE(option.matched_word, option.label) AS answer
  FROM quiz_blank_marker_backfill AS marker
  JOIN candidate_options AS option
    ON option.question_id = marker.question_id
   AND option.language = marker.language
   AND option.legacy_id::text = marker.legacy_marker_id
),
unmatched_markers AS (
  SELECT
    marker.*,
    row_number() OVER (
      PARTITION BY marker.question_id, marker.language
      ORDER BY marker.marker_position
    ) AS fallback_position
  FROM quiz_blank_marker_backfill AS marker
  WHERE NOT EXISTS (
    SELECT 1
    FROM exact_matches AS exact_match
    WHERE exact_match.question_id = marker.question_id
      AND exact_match.language = marker.language
      AND exact_match.marker_position = marker.marker_position
  )
),
unmatched_options AS (
  SELECT
    option.*,
    row_number() OVER (
      PARTITION BY option.question_id, option.language
      ORDER BY option.display_order, option.created_at, option.id
    ) AS fallback_position
  FROM candidate_options AS option
  WHERE NOT EXISTS (
      SELECT 1
      FROM exact_matches AS exact_match
      WHERE exact_match.option_id = option.id
    )
),
positional_matches AS (
  SELECT
    marker.blank_id,
    marker.question_id,
    marker.question_type,
    marker.language,
    marker.prompt,
    marker.marker_type,
    marker.legacy_marker_id,
    marker.marker_position,
    marker.created_at,
    marker.updated_at,
    marker.tenant_id,
    option.id AS option_id,
    option.legacy_id AS legacy_option_id,
    COALESCE(option.matched_word, option.label) AS answer
  FROM unmatched_markers AS marker
  JOIN unmatched_options AS option
    ON option.question_id = marker.question_id
   AND option.language = marker.language
   AND option.fallback_position = marker.fallback_position
)
SELECT * FROM exact_matches
UNION ALL
SELECT * FROM positional_matches;

CREATE TEMP TABLE quiz_unmigratable_question_backfill AS
WITH unresolved_questions AS (
  SELECT DISTINCT marker.question_id
  FROM quiz_blank_marker_backfill AS marker
  LEFT JOIN quiz_blank_option_backfill AS mapping
    ON mapping.question_id = marker.question_id
   AND mapping.language = marker.language
   AND mapping.marker_position = marker.marker_position
  WHERE mapping.option_id IS NULL
),
mixed_marker_questions AS (
  SELECT DISTINCT marker.question_id
  FROM quiz_blank_marker_backfill AS marker
  WHERE marker.marker_type = 'tagged'
    AND marker.prompt ~ '\[word\]'
)
SELECT question_id FROM unresolved_questions
UNION
SELECT question_id FROM mixed_marker_questions;

DELETE FROM assessment_questions AS assessment_question
USING quiz_unmigratable_question_backfill AS unmigratable_question
WHERE assessment_question.id = unmigratable_question.question_id;

WITH ordered_questions AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY assessment_id
      ORDER BY display_order, created_at, id
    ) AS display_order
  FROM assessment_questions
)
UPDATE assessment_questions AS assessment_question
SET display_order = ordered_question.display_order
FROM ordered_questions AS ordered_question
WHERE assessment_question.id = ordered_question.id
  AND assessment_question.display_order IS DISTINCT FROM ordered_question.display_order;

DO $$
DECLARE
  mapping record;
  placeholder text;
BEGIN
  FOR mapping IN
    SELECT *
    FROM quiz_blank_option_backfill
    WHERE NOT EXISTS (
      SELECT 1
      FROM quiz_unmigratable_question_backfill AS unmigratable_question
      WHERE unmigratable_question.question_id = quiz_blank_option_backfill.question_id
    )
    ORDER BY question_id, language, marker_position DESC
  LOOP
    IF mapping.marker_type = 'tagged' THEN
      placeholder := '__quiz_blank_' || mapping.marker_position::text || '__';

      UPDATE assessment_questions
      SET prompt = jsonb_set(
        prompt,
        ARRAY[mapping.language],
        to_jsonb(
          replace(
            replace(
              regexp_replace(
                prompt ->> mapping.language,
                '<blank-answer-' || mapping.legacy_marker_id || '>',
                placeholder,
                1,
                1
              ),
              '<blank-answer-' || mapping.legacy_marker_id || '>',
              ''
            ),
            placeholder,
            '<blank-answer-' || mapping.blank_id::text || '>'
          )
        ),
        true
      )
      WHERE id = mapping.question_id;
    ELSE
      UPDATE assessment_questions
      SET prompt = jsonb_set(
        prompt,
        ARRAY[mapping.language],
        to_jsonb(
          regexp_replace(
            prompt ->> mapping.language,
            '\[word\]',
            '<blank-answer-' || mapping.blank_id::text || '>',
            1,
            mapping.marker_position::integer
          )
        ),
        true
      )
      WHERE id = mapping.question_id;
    END IF;
  END LOOP;
END
$$;

INSERT INTO assessment_question_blanks (
  id,
  question_id,
  text_comparison_mode,
  created_at,
  updated_at,
  tenant_id
)
SELECT DISTINCT ON (mapping.blank_id)
  mapping.blank_id,
  mapping.question_id,
  'exact',
  mapping.created_at,
  mapping.updated_at,
  mapping.tenant_id
FROM quiz_blank_option_backfill AS mapping
WHERE NOT EXISTS (
  SELECT 1
  FROM quiz_unmigratable_question_backfill AS unmigratable_question
  WHERE unmigratable_question.question_id = mapping.question_id
)
ORDER BY mapping.blank_id, mapping.language
ON CONFLICT (id) DO NOTHING;

INSERT INTO assessment_question_blank_answer_sets (
  blank_id,
  language,
  preferred_answer,
  accepted_answers,
  created_at,
  updated_at,
  tenant_id
)
SELECT
  mapping.blank_id,
  mapping.language,
  mapping.answer,
  ARRAY[mapping.answer],
  mapping.created_at,
  mapping.updated_at,
  mapping.tenant_id
FROM quiz_blank_option_backfill AS mapping
WHERE NOT EXISTS (
  SELECT 1
  FROM quiz_unmigratable_question_backfill AS unmigratable_question
  WHERE unmigratable_question.question_id = mapping.question_id
)
ON CONFLICT (tenant_id, blank_id, language) DO NOTHING;

INSERT INTO assessment_question_drag_and_drop_options (
  id,
  question_id,
  language,
  label,
  target_blank_id,
  display_order,
  created_at,
  updated_at,
  tenant_id
)
SELECT
  option.id,
  option.question_id,
  option.language,
  option.label,
  mapping.blank_id,
  option.display_order,
  option.created_at,
  option.updated_at,
  option.tenant_id
FROM quiz_localized_option_backfill AS option
JOIN questions AS question ON question.id = option.question_id
JOIN lessons AS lesson ON lesson.id = question.lesson_id
LEFT JOIN quiz_blank_option_backfill AS mapping
  ON mapping.option_id = option.id
WHERE lesson.type = 'quiz'
  AND question.type = 'fill_in_the_blanks_dnd'
  AND NOT EXISTS (
    SELECT 1
    FROM quiz_unmigratable_question_backfill AS unmigratable_question
    WHERE unmigratable_question.question_id = question.id
  )
ON CONFLICT (id) DO NOTHING;

DROP TABLE quiz_blank_option_backfill;
DROP TABLE quiz_blank_marker_backfill;
DROP TABLE quiz_localized_option_backfill;

INSERT INTO resources (
  reference,
  content_type,
  metadata,
  visibility,
  tenant_id
)
SELECT DISTINCT ON (question.tenant_id, question.photo_s3_key)
  question.photo_s3_key,
  CASE lower(substring(question.photo_s3_key FROM '\.([^.]+)$'))
    WHEN 'png' THEN 'image/png'
    WHEN 'webp' THEN 'image/webp'
    WHEN 'svg' THEN 'image/svg+xml'
    ELSE 'image/jpeg'
  END,
  '{}'::jsonb,
  'public',
  question.tenant_id
FROM questions AS question
JOIN lessons AS lesson ON lesson.id = question.lesson_id
WHERE lesson.type = 'quiz'
  AND question.photo_s3_key IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM quiz_unmigratable_question_backfill AS unmigratable_question
    WHERE unmigratable_question.question_id = question.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM resources AS existing_resource
    WHERE existing_resource.reference = question.photo_s3_key
      AND existing_resource.tenant_id = question.tenant_id
      AND existing_resource.archived = false
  )
ORDER BY question.tenant_id, question.photo_s3_key, question.created_at
;

INSERT INTO resource_entity (
  resource_id,
  entity_id,
  entity_type,
  relationship_type,
  tenant_id
)
SELECT
  resource.id,
  question.id,
  'assessment_question',
  'prompt_image',
  question.tenant_id
FROM questions AS question
JOIN lessons AS lesson ON lesson.id = question.lesson_id
JOIN resources AS resource
  ON resource.reference = question.photo_s3_key
 AND resource.tenant_id = question.tenant_id
 AND resource.archived = false
WHERE lesson.type = 'quiz'
  AND question.photo_s3_key IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM quiz_unmigratable_question_backfill AS unmigratable_question
    WHERE unmigratable_question.question_id = question.id
  )
ON CONFLICT DO NOTHING;

DROP TABLE quiz_unmigratable_question_backfill;

INSERT INTO assessment_attempts (
  id,
  assessment_id,
  language,
  learner_id,
  attempt_number,
  submission_status,
  grading_status,
  result,
  available_points,
  awarded_points,
  score_percentage,
  has_question_level_answers,
  started_at,
  submitted_at,
  graded_at,
  tenant_id
)
SELECT
  attempt.id,
  attempt.lesson_id,
  assessment.base_language,
  attempt.user_id,
  row_number() OVER (
    PARTITION BY attempt.tenant_id, attempt.lesson_id, attempt.user_id
    ORDER BY attempt.created_at, attempt.id
  ),
  'submitted',
  'graded',
  CASE
    WHEN attempt.score >= COALESCE(assessment.passing_score_percentage, 0) THEN 'passed'
    ELSE 'failed'
  END,
  GREATEST(attempt.correct_answers + attempt.wrong_answers, 1),
  attempt.correct_answers,
  attempt.score,
  false,
  attempt.created_at,
  attempt.updated_at,
  attempt.updated_at,
  attempt.tenant_id
FROM quiz_attempts AS attempt
JOIN assessments AS assessment
  ON assessment.lesson_id = attempt.lesson_id
 AND assessment.tenant_id = attempt.tenant_id
ON CONFLICT (id) DO NOTHING;
