-- Custom SQL migration file, put you code below! --

-- Insert user_onboarding records for existing users
INSERT INTO user_onboarding (user_id, created_at, updated_at)
SELECT id AS user_id, NOW() AS created_at, NOW() AS updated_at
FROM users
WHERE NOT EXISTS (
    SELECT 1
    FROM user_onboarding
    WHERE user_onboarding.user_id = users.id
);
