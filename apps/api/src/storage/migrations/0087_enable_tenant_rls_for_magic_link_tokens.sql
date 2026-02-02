-- Custom SQL migration file, put you code below! --

DO $$
BEGIN
  ALTER TABLE public.magic_link_tokens ENABLE ROW LEVEL SECURITY;

  BEGIN
    CREATE POLICY magic_link_tokens_tenant_isolation
      ON public.magic_link_tokens
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END
$$;
