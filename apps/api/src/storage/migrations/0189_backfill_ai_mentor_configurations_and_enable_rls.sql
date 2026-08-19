ALTER TABLE "ai_mentor_configurations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_mentor_teacher_configurations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_mentor_roleplay_configurations" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_mentor_configurations_tenant_isolation"
  ON "ai_mentor_configurations";
DROP POLICY IF EXISTS "ai_mentor_teacher_configurations_tenant_isolation"
  ON "ai_mentor_teacher_configurations";
DROP POLICY IF EXISTS "ai_mentor_roleplay_configurations_tenant_isolation"
  ON "ai_mentor_roleplay_configurations";
--> statement-breakpoint
CREATE POLICY "ai_mentor_configurations_tenant_isolation" ON "ai_mentor_configurations"
  USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
CREATE POLICY "ai_mentor_teacher_configurations_tenant_isolation"
  ON "ai_mentor_teacher_configurations"
  USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
CREATE POLICY "ai_mentor_roleplay_configurations_tenant_isolation"
  ON "ai_mentor_roleplay_configurations"
  USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
INSERT INTO "ai_mentor_configurations" (
	"ai_mentor_lesson_id",
	"type",
	"additional_instructions",
	"tenant_id"
)
SELECT
	"id",
	CASE
		WHEN "type" = 'roleplay' THEN 'roleplay'::"structured_ai_mentor_type"
		ELSE 'teacher'::"structured_ai_mentor_type"
	END,
	"ai_mentor_instructions",
	"tenant_id"
FROM "ai_mentor_lessons"
ON CONFLICT ("ai_mentor_lesson_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "ai_mentor_teacher_configurations" (
	"configuration_id",
	"teaching_style",
	"tenant_id"
)
SELECT
	"id",
	'explain_and_practice'::"ai_mentor_teaching_style",
	"tenant_id"
FROM "ai_mentor_configurations"
WHERE "type" = 'teacher'
ON CONFLICT ("configuration_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "ai_mentor_roleplay_configurations" (
	"configuration_id",
	"difficulty",
	"tenant_id"
)
SELECT
	"id",
	'realistic'::"ai_mentor_roleplay_difficulty",
	"tenant_id"
FROM "ai_mentor_configurations"
WHERE "type" = 'roleplay'
ON CONFLICT ("configuration_id") DO NOTHING;
--> statement-breakpoint
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
  ON practice_session."id" = configuration."practice_session_id";
--> statement-breakpoint
ALTER TABLE "ai_mentor_configurations"
  ADD CONSTRAINT "ai_mentor_configurations_exactly_one_source_check"
  CHECK (("ai_mentor_lesson_id" IS NOT NULL) <> ("practice_session_id" IS NOT NULL));
