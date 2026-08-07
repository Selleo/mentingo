-- Custom SQL migration file, put you code below! --
UPDATE settings
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{dashboard}',
  '{"widgets":[{"id":"a_placeholder_1","order":1,"width":2},{"id":"a_placeholder_2","order":2,"width":1},{"id":"a_placeholder_3","order":3,"width":1},{"id":"s_placeholder_1","order":1,"width":2},{"id":"s_placeholder_2","order":2,"width":1},{"id":"s_placeholder_3","order":3,"width":1}]}'::jsonb,
  true
)
WHERE user_id IS NOT NULL
  AND (
    settings IS NULL
    OR NOT (settings ? 'dashboard')
  );
