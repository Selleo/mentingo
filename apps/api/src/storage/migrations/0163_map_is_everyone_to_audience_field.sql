-- Custom SQL migration file, put you code below! --
UPDATE "announcements"
SET "audience" = 'all_users'
WHERE "is_everyone" = true;

UPDATE "announcements"
SET "audience" = 'selected_users'
WHERE "is_everyone" = false;