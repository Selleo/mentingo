INSERT INTO course_learning_states (tenant_id, student_id, course_id, kind, completed_at, finished_chapter_count)
SELECT p.tenant_id, p.student_id, p.course_id, 'current', sc.completed_at, COALESCE(sc.finished_chapter_count, 0)
FROM (
  SELECT tenant_id, student_id, course_id FROM student_courses
  UNION SELECT tenant_id, student_id, course_id FROM student_chapter_progress
  UNION SELECT p.tenant_id, p.student_id, ch.course_id FROM student_lesson_progress p JOIN chapters ch ON ch.id = p.chapter_id
  UNION SELECT p.tenant_id, p.student_id, ch.course_id FROM lesson_video_progress p JOIN lessons l ON l.id = p.lesson_id JOIN chapters ch ON ch.id = l.chapter_id
  UNION SELECT a.tenant_id, a.learner_id, ch.course_id FROM assessment_attempts a JOIN assessments q ON q.id = a.assessment_id JOIN lessons l ON l.id = q.lesson_id JOIN chapters ch ON ch.id = l.chapter_id
  UNION SELECT tenant_id, student_id, course_id FROM scorm_attempts
  UNION SELECT t.tenant_id, t.user_id, ch.course_id FROM ai_mentor_threads t JOIN ai_mentor_lessons a ON a.id = t.ai_mentor_lesson_id JOIN lessons l ON l.id = a.lesson_id JOIN chapters ch ON ch.id = l.chapter_id
) p LEFT JOIN student_courses sc ON sc.student_id = p.student_id AND sc.course_id = p.course_id AND sc.tenant_id = p.tenant_id
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE student_chapter_progress target SET learning_state_id = linked.state_id
FROM (SELECT p.id, cls.id AS state_id FROM student_chapter_progress p
  JOIN course_learning_states cls ON cls.course_id = p.course_id AND cls.student_id = p.student_id AND cls.tenant_id = p.tenant_id AND cls.kind = 'current'
) linked WHERE target.id = linked.id AND target.learning_state_id IS NULL;
--> statement-breakpoint
UPDATE student_lesson_progress target SET learning_state_id = linked.state_id
FROM (SELECT p.id, cls.id AS state_id FROM student_lesson_progress p JOIN chapters ch ON ch.id = p.chapter_id
  JOIN course_learning_states cls ON cls.course_id = ch.course_id AND cls.student_id = p.student_id AND cls.tenant_id = p.tenant_id AND cls.kind = 'current'
) linked WHERE target.id = linked.id AND target.learning_state_id IS NULL;
--> statement-breakpoint
UPDATE lesson_video_progress target SET learning_state_id = linked.state_id
FROM (SELECT p.id, cls.id AS state_id FROM lesson_video_progress p JOIN lessons l ON l.id = p.lesson_id JOIN chapters ch ON ch.id = l.chapter_id
  JOIN course_learning_states cls ON cls.course_id = ch.course_id AND cls.student_id = p.student_id AND cls.tenant_id = p.tenant_id AND cls.kind = 'current'
) linked WHERE target.id = linked.id AND target.learning_state_id IS NULL;
--> statement-breakpoint
UPDATE assessment_attempts target SET learning_state_id = linked.state_id
FROM (SELECT p.id, cls.id AS state_id FROM assessment_attempts p JOIN assessments q ON q.id = p.assessment_id JOIN lessons l ON l.id = q.lesson_id JOIN chapters ch ON ch.id = l.chapter_id
  JOIN course_learning_states cls ON cls.course_id = ch.course_id AND cls.student_id = p.learner_id AND cls.tenant_id = p.tenant_id AND cls.kind = 'current'
) linked WHERE target.id = linked.id AND target.learning_state_id IS NULL;
--> statement-breakpoint
UPDATE scorm_attempts target SET learning_state_id = linked.state_id
FROM (SELECT p.id, cls.id AS state_id FROM scorm_attempts p
  JOIN course_learning_states cls ON cls.course_id = p.course_id AND cls.student_id = p.student_id AND cls.tenant_id = p.tenant_id AND cls.kind = 'current'
) linked WHERE target.id = linked.id AND target.learning_state_id IS NULL;
--> statement-breakpoint
UPDATE ai_mentor_threads target SET learning_state_id = linked.state_id
FROM (SELECT p.id, cls.id AS state_id FROM ai_mentor_threads p JOIN ai_mentor_lessons a ON a.id = p.ai_mentor_lesson_id JOIN lessons l ON l.id = a.lesson_id JOIN chapters ch ON ch.id = l.chapter_id
  JOIN course_learning_states cls ON cls.course_id = ch.course_id AND cls.student_id = p.user_id AND cls.tenant_id = p.tenant_id AND cls.kind = 'current'
) linked WHERE target.id = linked.id AND target.learning_state_id IS NULL;
--> statement-breakpoint
ALTER TABLE course_learning_states ADD CONSTRAINT course_learning_states_kind_check CHECK (kind IN ('current', 'repetition'));
--> statement-breakpoint
ALTER TABLE course_learning_states ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY course_learning_states_tenant_isolation ON course_learning_states
USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
