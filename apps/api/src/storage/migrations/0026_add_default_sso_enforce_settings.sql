-- Custom SQL migration file, put you code below! --
UPDATE settings
SET
    settings = settings || '{"enforceSSO": false}'
WHERE
    settings.user_id IS NULL;