INSERT INTO settings (user_id, created_at, settings)
SELECT 
    NULL, 
    NOW(), 
    '{"loginBackgroundImageS3Key": null}'::JSONB
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE user_id IS NULL);

UPDATE settings 
SET settings = jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{loginBackgroundImageS3Key}',
    'null'::jsonb,
    true
)
WHERE user_id IS NULL 
AND NOT (settings ? 'loginBackgroundImageS3Key');


