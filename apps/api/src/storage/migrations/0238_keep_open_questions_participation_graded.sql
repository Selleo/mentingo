-- Open answers were always counted as correct; keep that for existing questions. Reviewer grading is opt-in per question.
UPDATE "assessment_questions"
SET "grading_mode" = 'participation'
WHERE "question_type" IN ('brief_response', 'detailed_response')
  AND "grading_mode" = 'manual';
