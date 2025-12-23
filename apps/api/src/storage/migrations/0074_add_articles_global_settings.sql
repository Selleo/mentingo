-- Custom SQL migration file, put you code below! --
UPDATE settings
SET settings = jsonb_set(
        COALESCE(settings, '{}'::jsonb),
        '{articlesEnabled}',
        'false'::jsonb,
        true
    )
WHERE user_id IS NULL;

UPDATE settings
SET settings = jsonb_set(
        COALESCE(settings, '{}'::jsonb),
        '{unregisteredUserArticlesAccessibility}',
        'false'::jsonb,
        true
    )
WHERE user_id IS NULL;