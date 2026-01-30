-- Custom SQL migration file, put you code below! --

-- Backfill tenant_id for existing data by assigning a legacy tenant everywhere it's null.
DO $$
DECLARE
  legacy_tenant_id constant uuid := gen_random_uuid();
BEGIN
  -- Ensure the legacy tenant exists (no dependency on a unique host constraint)
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = legacy_tenant_id) THEN
    INSERT INTO tenants (id, name, host, created_at, updated_at)
    VALUES (legacy_tenant_id, 'Legacy Tenant', 'legacy.local', now(), now());
  END IF;

  -- Backfill tenant_id across all tables
  UPDATE users SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE user_details SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE user_statistics SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE quiz_attempts SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE credentials SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE categories SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE create_tokens SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE reset_tokens SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE courses SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE course_slugs SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE chapters SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE lessons SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE ai_mentor_lessons SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE ai_mentor_threads SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE ai_mentor_thread_messages SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE questions SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE question_answer_options SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE student_question_answers SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE student_courses SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE student_lesson_progress SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE ai_mentor_student_lesson_progress SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE student_chapter_progress SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE courses_summary_stats SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE course_students_stats SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE lesson_learning_time SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE scorm_metadata SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE scorm_files SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE groups SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE group_users SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE group_courses SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE settings SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE certificates SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE announcements SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE user_announcements SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE group_announcements SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE documents SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE doc_chunks SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE document_to_ai_mentor_lesson SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE secrets SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE user_onboarding SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE activity_logs SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE questions_and_answers SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE resources SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE resource_entity SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE articles SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE article_sections SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE news SET tenant_id = legacy_tenant_id WHERE tenant_id IS NULL;
END $$;
