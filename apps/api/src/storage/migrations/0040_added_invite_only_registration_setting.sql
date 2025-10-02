-- Custom SQL migration file, put you code below! --
UPDATE settings
SET
    settings = jsonb_set(
            COALESCE(settings, '{}'::jsonb),
            '{inviteOnlyRegistration}',
            'false'::jsonb,
            true
               )
WHERE
    user_id IS NULL;