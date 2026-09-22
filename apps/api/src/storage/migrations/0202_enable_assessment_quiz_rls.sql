-- Custom SQL migration file, put your code below! --

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT table_schema, table_name
    FROM information_schema.columns
    WHERE column_name = 'tenant_id'
      AND table_schema = 'public'
      AND table_name IN (
        'assessments',
        'assessment_questions',
        'assessment_question_choice_options',
        'assessment_question_true_false_statements',
        'assessment_question_scale_options',
        'assessment_question_open_text_settings',
        'assessment_question_blanks',
        'assessment_question_blank_answer_sets',
        'assessment_question_drag_and_drop_options',
        'assessment_attempts',
        'assessment_attempt_question_answers',
        'assessment_attempt_choice_selections',
        'assessment_attempt_statement_answers',
        'assessment_attempt_blank_answers',
        'assessment_attempt_open_text_answers',
        'assessment_attempt_scale_selections',
        'assessment_attempt_question_answer_reviews'
      )
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.table_schema, r.table_name);
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I USING (tenant_id = current_setting(''app.tenant_id'', true)::uuid) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true)::uuid)',
      concat(r.table_name, '_tenant_isolation'),
      r.table_schema,
      r.table_name
    );
  END LOOP;
END
$$;
