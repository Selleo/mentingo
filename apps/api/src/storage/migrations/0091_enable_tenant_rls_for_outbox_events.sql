-- Custom SQL migration file, put you code below! --

DO $$
BEGIN
  ALTER TABLE public.outbox_events ENABLE ROW LEVEL SECURITY;

  BEGIN
    CREATE POLICY outbox_events_tenant_isolation
      ON public.outbox_events
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END
$$;
