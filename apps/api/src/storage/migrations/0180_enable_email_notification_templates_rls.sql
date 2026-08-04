DO $$
BEGIN
  ALTER TABLE public.email_notification_templates ENABLE ROW LEVEL SECURITY;

  BEGIN
    CREATE POLICY email_notification_templates_tenant_isolation
      ON public.email_notification_templates
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END
$$;
