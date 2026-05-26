-- Custom SQL migration file, put you code below! --

UPDATE settings
SET settings = jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{liveTrainingMaxParallelSessions}',
    COALESCE(settings->'liveTrainingMaxParallelSessions', '5'::jsonb),
    true
  )
WHERE user_id IS NULL
  AND (
    settings IS NULL
    OR NOT (settings ? 'liveTrainingMaxParallelSessions')
  );
