INSERT INTO settings (user_id, settings)
SELECT u.id, 
       CASE 
           WHEN u.role = 'admin' THEN '{"language": "en", "adminNewUserNotification": true}'::JSONB
           ELSE '{"language": "en"}'::JSONB
       END as settings
FROM users u
LEFT JOIN settings s ON u.id = s.user_id
WHERE s.user_id IS NULL;