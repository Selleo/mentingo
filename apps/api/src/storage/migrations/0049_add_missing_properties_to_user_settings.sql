-- Custom SQL migration file, put you code below! --

-- Add isMFAEnabled field to users who don't have it set
UPDATE settings
SET
    settings = jsonb_set(
        COALESCE(settings, '{}'::jsonb),
        '{isMFAEnabled}',
        'false'::jsonb,
        true
    )
WHERE
    user_id IS NOT NULL
    AND (settings->'isMFAEnabled') IS NULL;

-- Add MFASecret field to users who don't have it set
UPDATE settings
SET
    settings = jsonb_set(
        COALESCE(settings, '{}'::jsonb),
        '{MFASecret}',
        'null'::jsonb,
        true
    )
WHERE
    user_id IS NOT NULL
    AND (settings->'MFASecret') IS NULL;
