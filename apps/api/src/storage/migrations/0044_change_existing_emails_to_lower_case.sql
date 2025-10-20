-- Custom SQL migration file, put you code below! --
UPDATE users
SET email = LOWER(email)
WHERE email IS NOT NULL;