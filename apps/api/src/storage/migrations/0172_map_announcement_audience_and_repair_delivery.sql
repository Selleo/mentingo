-- Preserve the existing audience selection before the legacy column is removed.
UPDATE "announcements"
SET "audience" = CASE
  WHEN "is_everyone" = true THEN 'all_users'
  ELSE 'selected_users'
END;
--> statement-breakpoint

-- System notifications are delivered to resolved recipients rather than to every tenant user.
UPDATE "announcements"
SET "audience" = 'selected_users'
WHERE "source_type" = 'live_training'
  AND "audience" <> 'selected_users';
--> statement-breakpoint

-- Restore missing historical deliveries for published tenant-wide manual announcements.
-- Backfilled rows are marked read so deployment does not create an artificial unread backlog.
INSERT INTO "user_announcements" (
  "user_id",
  "announcement_id",
  "is_read",
  "read_at",
  "tenant_id"
)
SELECT
  "users"."id",
  "announcements"."id",
  true,
  COALESCE("announcements"."published_at", "announcements"."created_at", now()),
  "announcements"."tenant_id"
FROM "announcements"
INNER JOIN "users"
  ON "users"."tenant_id" = "announcements"."tenant_id"
  AND "users"."id" <> "announcements"."author_id"
  AND "users"."deleted_at" IS NULL
WHERE "announcements"."source_type" = 'manual'
  AND "announcements"."audience" = 'all_users'
  AND "announcements"."status" = 'published'
  AND "announcements"."deleted_at" IS NULL
ON CONFLICT ("user_id", "announcement_id") DO NOTHING;
--> statement-breakpoint

-- Restore group deliveries for every active group member, including administrators.
INSERT INTO "user_announcements" (
  "user_id",
  "announcement_id",
  "is_read",
  "read_at",
  "tenant_id"
)
SELECT DISTINCT
  "group_users"."user_id",
  "announcements"."id",
  true,
  COALESCE("announcements"."published_at", "announcements"."created_at", now()),
  "announcements"."tenant_id"
FROM "announcements"
INNER JOIN "group_announcements"
  ON "group_announcements"."announcement_id" = "announcements"."id"
  AND "group_announcements"."tenant_id" = "announcements"."tenant_id"
INNER JOIN "group_users"
  ON "group_users"."group_id" = "group_announcements"."group_id"
  AND "group_users"."tenant_id" = "announcements"."tenant_id"
INNER JOIN "users"
  ON "users"."id" = "group_users"."user_id"
  AND "users"."tenant_id" = "announcements"."tenant_id"
  AND "users"."deleted_at" IS NULL
WHERE "announcements"."source_type" = 'manual'
  AND "announcements"."audience" = 'selected_users'
  AND "announcements"."status" = 'published'
  AND "announcements"."deleted_at" IS NULL
ON CONFLICT ("user_id", "announcement_id") DO NOTHING;
--> statement-breakpoint

-- Rebuild live-training recipients from enrolled users and the linked live lesson.
INSERT INTO "user_announcements" (
  "user_id",
  "announcement_id",
  "is_read",
  "read_at",
  "tenant_id"
)
SELECT DISTINCT
  "users"."id",
  "announcements"."id",
  true,
  COALESCE("announcements"."published_at", "announcements"."created_at", now()),
  "announcements"."tenant_id"
FROM "announcements"
INNER JOIN "live_training_links"
  ON "live_training_links"."live_training_id" = "announcements"."source_id"
  AND "live_training_links"."entity_type" = 'course'
  AND "live_training_links"."tenant_id" = "announcements"."tenant_id"
INNER JOIN "live_lessons"
  ON "live_lessons"."live_training_id" = "announcements"."source_id"
  AND "live_lessons"."live_training_link_id" = "live_training_links"."id"
  AND "live_lessons"."tenant_id" = "announcements"."tenant_id"
INNER JOIN "student_courses"
  ON "student_courses"."course_id" = "live_training_links"."entity_id"
  AND "student_courses"."status" = 'enrolled'
  AND "student_courses"."tenant_id" = "announcements"."tenant_id"
INNER JOIN "users"
  ON "users"."id" = "student_courses"."student_id"
  AND "users"."tenant_id" = "announcements"."tenant_id"
  AND "users"."deleted_at" IS NULL
WHERE "announcements"."source_type" = 'live_training'
  AND "announcements"."status" = 'published'
  AND "announcements"."deleted_at" IS NULL
ON CONFLICT ("user_id", "announcement_id") DO NOTHING;
--> statement-breakpoint

-- Remove published live-training announcements for which no recipient could be resolved.
-- Scheduled announcements are retained because their deliveries are created only after publication.
DELETE FROM "announcements"
WHERE "source_type" = 'live_training'
  AND "status" = 'published'
  AND "deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "user_announcements"
    WHERE "user_announcements"."announcement_id" = "announcements"."id"
      AND "user_announcements"."tenant_id" = "announcements"."tenant_id"
  );
--> statement-breakpoint

-- Normalize read timestamps without changing any existing read decision.
UPDATE "user_announcements"
SET "read_at" = COALESCE("updated_at", "created_at", now())
WHERE "is_read" = true
  AND "read_at" IS NULL;
--> statement-breakpoint

UPDATE "user_announcements"
SET "read_at" = NULL
WHERE "is_read" = false
  AND "read_at" IS NOT NULL;
