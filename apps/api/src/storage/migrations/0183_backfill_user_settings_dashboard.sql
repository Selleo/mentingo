UPDATE settings
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{dashboard}',
  '{"widgets":[{"id":"a_event_calendar","order":1,"width":2},{"id":"a_training_completion","order":2,"width":1},{"id":"a_incomplete_courses","order":3,"width":1},{"id":"s_continue_learning","order":1,"width":2},{"id":"s_event_calendar","order":2,"width":2},{"id":"s_required_course","order":3,"width":1},{"id":"s_course_completion","order":4,"width":1}]}'::jsonb,
  true
)
WHERE user_id IS NOT NULL
  AND (
    settings IS NULL
    OR NOT (settings ? 'dashboard')
  );
