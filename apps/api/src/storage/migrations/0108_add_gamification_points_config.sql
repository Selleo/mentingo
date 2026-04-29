ALTER TABLE "courses" ADD COLUMN "points_override" integer;
ALTER TABLE "chapters" ADD COLUMN "points_override" integer;
ALTER TABLE "ai_mentor_lessons" ADD COLUMN "points_override" integer;

UPDATE "settings"
SET "settings" = "settings"
  || jsonb_build_object(
    'defaultChapterPoints', COALESCE(("settings"->>'defaultChapterPoints')::int, 10),
    'defaultCoursePoints', COALESCE(("settings"->>'defaultCoursePoints')::int, 50),
    'defaultAiPassPoints', COALESCE(("settings"->>'defaultAiPassPoints')::int, 30)
  )
WHERE "user_id" IS NULL;
