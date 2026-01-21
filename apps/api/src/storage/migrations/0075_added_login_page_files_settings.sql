UPDATE settings
SET settings = jsonb_set(
        COALESCE(settings, '{}'::jsonb),
        '{loginPageFiles}',
        jsonb_build_array(),
        true
       )
WHERE user_id IS NULL;