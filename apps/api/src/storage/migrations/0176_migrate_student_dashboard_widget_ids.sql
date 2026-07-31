UPDATE "settings" AS target
SET "settings" = jsonb_set(
  target."settings",
  '{dashboard,widgets}',
  (
    SELECT jsonb_agg(
      jsonb_set(
        widget.value,
        '{id}',
        to_jsonb(
          CASE widget.value->>'id'
            WHEN 's_placeholder_1' THEN 's_continue_learning'
            WHEN 's_placeholder_2' THEN 's_required_course'
            WHEN 's_placeholder_3' THEN 's_course_completion'
            ELSE widget.value->>'id'
          END
        ),
        false
      )
      ORDER BY widget.ordinality
    )
    FROM jsonb_array_elements(target."settings"->'dashboard'->'widgets')
      WITH ORDINALITY AS widget(value, ordinality)
  ),
  false
)
WHERE jsonb_typeof(target."settings"->'dashboard'->'widgets') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(target."settings"->'dashboard'->'widgets') AS widget(value)
    WHERE widget.value->>'id' IN (
      's_placeholder_1',
      's_placeholder_2',
      's_placeholder_3'
    )
  );
