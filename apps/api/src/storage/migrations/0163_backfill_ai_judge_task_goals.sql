INSERT INTO "ai_judge_configurations" (
  "ai_mentor_lesson_id",
  "task_goal",
  "passing_threshold_percent",
  "tenant_id"
)
SELECT
  "id",
  "completion_conditions",
  100,
  "tenant_id"
FROM "ai_mentor_lessons"
ON CONFLICT ("ai_mentor_lesson_id") DO NOTHING;
