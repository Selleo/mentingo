-- Custom SQL migration file, put you code below! --
UPDATE "announcements" SET "author_id" = NULL WHERE "source_type" = 'tenant_user_capacity';
