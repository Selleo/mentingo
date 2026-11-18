-- Custom SQL migration file, put you code below! --
INSERT INTO "discussion_thread_followers" ("thread_id", "user_id", "tenant_id", "created_at", "updated_at")
SELECT "thread_id", "user_id", "tenant_id", MIN("created_at"), MIN("created_at")
FROM "course_chat_messages"
WHERE "deleted_at" IS NULL
GROUP BY "thread_id", "user_id", "tenant_id"
ON CONFLICT ("thread_id", "user_id") DO NOTHING;
