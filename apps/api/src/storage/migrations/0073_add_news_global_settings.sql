-- Custom SQL migration file, put you code below! --
UPDATE settings
SET settings = jsonb_set(
        COALESCE(settings, '{}'::jsonb),
        '{newsEnabled}',
        'false'::jsonb,
        true
    )
WHERE user_id IS NULL;

UPDATE settings
SET settings = jsonb_set(
        COALESCE(settings, '{}'::jsonb),
        '{unregisteredUserNewsAccessibility}',
        'false'::jsonb,
        true
    )
WHERE user_id IS NULL;