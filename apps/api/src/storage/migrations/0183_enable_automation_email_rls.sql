-- Custom SQL migration file, put you code below! --
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'automation_logs',
    'automation_steps',
    'automations',
    'email_notification_templates'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);

    BEGIN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I USING (tenant_id = current_setting(''app.tenant_id'', true)::uuid) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true)::uuid)',
        table_name || '_tenant_isolation',
        table_name
      );
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END
$$;
