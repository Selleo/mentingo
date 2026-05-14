CREATE OR REPLACE FUNCTION pg_temp.replace_blank_answer_markers(content text, answer_ids uuid[])
  RETURNS text
  LANGUAGE plpgsql
AS
$$
DECLARE
  result          text := content;
  marker_position integer;
  answer_index    integer := 1;
  answer_count    integer := COALESCE(array_length(answer_ids, 1), 0);
BEGIN
  IF result IS NULL OR answer_count = 0 THEN
    RETURN result;
  END IF;

  LOOP
    marker_position := strpos(result, '[word]');

    IF marker_position = 0 OR answer_index > answer_count THEN
      EXIT;
    END IF;

    result := overlay(
      result
      placing '<blank-answer-' || answer_ids[answer_index]::text || '>'
      from marker_position for 6
    );

    answer_index := answer_index + 1;
  END LOOP;

  RETURN result;
END;
$$;

WITH ordered_correct_answers AS (
  SELECT
    q.id AS question_id,
    array_agg(
      qao.id
      ORDER BY qao.display_order NULLS LAST, qao.created_at, qao.id
    ) AS answer_ids
  FROM questions q

  JOIN question_answer_options qao
    ON qao.question_id = q.id

  WHERE q.type IN ('fill_in_the_blanks_text', 'fill_in_the_blanks_dnd')
    AND q.description::text LIKE '%[word]%'
    AND q.description::text NOT LIKE '%<blank-answer-%'
    AND qao.is_correct = true

  GROUP BY q.id
),
migrated_descriptions AS (
  SELECT
    q.id AS question_id,
    jsonb_object_agg(
      description_entry.key,
      to_jsonb(
        pg_temp.replace_blank_answer_markers(
          description_entry.value,
          ordered_correct_answers.answer_ids
        )
      )
    ) AS description
  FROM questions q

  JOIN ordered_correct_answers
    ON ordered_correct_answers.question_id = q.id

  CROSS JOIN LATERAL jsonb_each_text(q.description) AS description_entry(key, value)

  WHERE q.description IS NOT NULL
    AND jsonb_typeof(q.description) = 'object'

  GROUP BY q.id
)
UPDATE questions q
SET description = migrated_descriptions.description
FROM migrated_descriptions
WHERE q.id = migrated_descriptions.question_id;
