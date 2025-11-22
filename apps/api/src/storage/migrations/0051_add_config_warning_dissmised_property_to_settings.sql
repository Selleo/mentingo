-- Custom SQL migration file, put you code below! --
UPDATE settings
SET
    settings = jsonb_set(
        COALESCE(settings, '{}'::jsonb),
        '{configWarningDismissed}',
        'false'::jsonb,
        true
    )
FROM users
WHERE
    settings.user_id IS NOT NULL
    AND (settings.settings->'configWarningDismissed') IS NULL
    AND users.role = 'admin'
    AND settings.user_id = users.id;