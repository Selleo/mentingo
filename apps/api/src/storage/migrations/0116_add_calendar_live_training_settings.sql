-- Custom SQL migration file, put you code below! --

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
        'calendar_events',
        'live_lessons',
        'live_training_attendance',
        'live_training_links',
        'live_training_members',
        'live_training_session_participants',
        'live_training_sessions',
        'live_trainings'
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

UPDATE settings
SET settings = jsonb_set(
  jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{calendarEnabled}',
    COALESCE(settings->'calendarEnabled', 'false'::jsonb),
    true
  ),
  '{liveTrainingEnabled}',
  COALESCE(settings->'liveTrainingEnabled', 'false'::jsonb),
  true
)
WHERE user_id IS NULL;
