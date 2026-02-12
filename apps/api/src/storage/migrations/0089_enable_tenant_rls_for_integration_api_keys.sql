-- Custom SQL migration file, put you code below! --

DO $$
BEGIN
  ALTER TABLE public.integration_api_keys ENABLE ROW LEVEL SECURITY;

  BEGIN
    CREATE POLICY integration_api_keys_tenant_isolation
      ON public.integration_api_keys
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END
$$;
