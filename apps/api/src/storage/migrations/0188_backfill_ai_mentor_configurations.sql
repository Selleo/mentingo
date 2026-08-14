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
