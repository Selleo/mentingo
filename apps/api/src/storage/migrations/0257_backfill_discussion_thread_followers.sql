-- Custom SQL migration file, put you code below! --
INSERT INTO "discussion_thread_followers" ("thread_id", "user_id", "tenant_id")
SELECT DISTINCT "thread_id", "user_id", "tenant_id"
FROM "course_chat_messages"
WHERE "deleted_at" IS NULL
ON CONFLICT ("thread_id", "user_id") DO NOTHING;
