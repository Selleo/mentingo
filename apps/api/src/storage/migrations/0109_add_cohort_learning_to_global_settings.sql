UPDATE settings
SET settings = jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{cohortLearningEnabled}',
    'false'::jsonb,
    true
)
WHERE user_id IS NULL
  AND (settings->'cohortLearningEnabled') IS NULL;
