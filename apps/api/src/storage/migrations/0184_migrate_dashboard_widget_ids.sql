UPDATE settings
SET settings = jsonb_set(
  settings,
  '{dashboard,widgets}',
  (
    SELECT jsonb_agg(
      CASE widget->>'id'
        WHEN 'a_placeholder_1' THEN jsonb_set(widget, '{id}', '"a_event_calendar"'::jsonb)
        WHEN 'a_placeholder_2' THEN jsonb_set(widget, '{id}', '"a_training_completion"'::jsonb)
        WHEN 'a_placeholder_3' THEN jsonb_set(widget, '{id}', '"a_incomplete_courses"'::jsonb)
        ELSE widget
      END
      ORDER BY position
    )
    FROM jsonb_array_elements(settings #> '{dashboard,widgets}')
      WITH ORDINALITY AS dashboard_widget(widget, position)
  ),
  false
)
WHERE user_id IS NOT NULL
  AND jsonb_typeof(settings #> '{dashboard,widgets}') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(settings #> '{dashboard,widgets}') AS dashboard_widget(widget)
    WHERE widget->>'id' IN ('a_placeholder_1', 'a_placeholder_2', 'a_placeholder_3')
  );
