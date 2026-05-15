-- Custom SQL migration file, put your code below! --

UPDATE settings
SET settings = jsonb_set(
        COALESCE(settings, '{}'::jsonb),
        '{calendarEnabled}',
        'false'::jsonb,
        true
    )
WHERE user_id IS NULL
  AND NOT (settings ? 'calendarEnabled');

UPDATE settings
SET settings = jsonb_set(
        COALESCE(settings, '{}'::jsonb),
        '{liveTrainingEnabled}',
        'false'::jsonb,
        true
    )
WHERE user_id IS NULL
  AND NOT (settings ? 'liveTrainingEnabled');
