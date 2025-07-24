-- Custom SQL migration file, put you code below! --
UPDATE settings
SET
    settings = settings || '{"unregisteredUserCoursesAccessibility": true}'
WHERE
    settings.user_id IS NULL;