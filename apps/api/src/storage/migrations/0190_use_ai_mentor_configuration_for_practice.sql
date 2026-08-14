ALTER TABLE "ai_mentor_practice_sessions" RENAME COLUMN "instructions" TO "scenario";--> statement-breakpoint
ALTER TABLE "ai_mentor_configurations" DROP CONSTRAINT "ai_mentor_configurations_ai_mentor_lesson_id_unique";--> statement-breakpoint
ALTER TABLE "ai_mentor_configurations" ALTER COLUMN "ai_mentor_lesson_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_mentor_configurations" ADD COLUMN "practice_session_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_mentor_configurations" ADD CONSTRAINT "ai_mentor_configurations_practice_session_id_ai_mentor_practice_sessions_id_fk" FOREIGN KEY ("practice_session_id") REFERENCES "public"."ai_mentor_practice_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_mentor_configurations_lesson_unique_idx" ON "ai_mentor_configurations" USING btree ("ai_mentor_lesson_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_mentor_configurations_practice_session_unique_idx" ON "ai_mentor_configurations" USING btree ("practice_session_id");--> statement-breakpoint
WITH inserted_configurations AS (
  INSERT INTO "ai_mentor_configurations" (
    "id",
    "practice_session_id",
    "type",
    "tenant_id"
  )
  SELECT
    gen_random_uuid(),
    practice_session."id",
    'roleplay'::"structured_ai_mentor_type",
    practice_session."tenant_id"
  FROM "ai_mentor_practice_sessions" practice_session
  WHERE NOT EXISTS (
    SELECT 1
    FROM "ai_mentor_configurations" configuration
    WHERE configuration."practice_session_id" = practice_session."id"
  )
  RETURNING "id", "practice_session_id", "tenant_id"
)
INSERT INTO "ai_mentor_roleplay_configurations" (
  "configuration_id",
  "scenario",
  "ai_role",
  "learner_role",
  "character_goal",
  "difficulty",
  "tenant_id"
)
SELECT
  configuration."id",
  jsonb_build_object(practice_session."language", practice_session."scenario"),
  jsonb_build_object(
    practice_session."language",
    COALESCE(practice_session."ai_mentor_name", 'AI Mentor')
  ),
  jsonb_build_object(practice_session."language", 'Learner'),
  jsonb_build_object(practice_session."language", practice_session."scenario"),
  'realistic'::"ai_mentor_roleplay_difficulty",
  configuration."tenant_id"
FROM inserted_configurations configuration
INNER JOIN "ai_mentor_practice_sessions" practice_session
  ON practice_session."id" = configuration."practice_session_id";--> statement-breakpoint
ALTER TABLE "ai_mentor_configurations"
  ADD CONSTRAINT "ai_mentor_configurations_exactly_one_source_check"
  CHECK (("ai_mentor_lesson_id" IS NOT NULL) <> ("practice_session_id" IS NOT NULL));
