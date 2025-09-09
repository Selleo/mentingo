-- Custom SQL migration file, put you code below! --
UPDATE settings
SET
    settings = jsonb_set(
        COALESCE(settings, '{}'::jsonb),
        '{adminFinishedCourseNotification}',
        'false'::jsonb,
        true
    )
WHERE
    user_id IN (
        SELECT id FROM users WHERE role = 'admin'
    );