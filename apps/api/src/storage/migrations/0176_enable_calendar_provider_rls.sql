-- Custom SQL migration file, put you code below! --

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'calendar_connections',
    'calendar_external_events',
    'calendar_outbound_events'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (tenant_id = current_setting(''app.tenant_id'', true)::uuid) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true)::uuid)',
      concat(table_name, '_tenant_isolation'),
      table_name
    );
  END LOOP;
END
$$;
