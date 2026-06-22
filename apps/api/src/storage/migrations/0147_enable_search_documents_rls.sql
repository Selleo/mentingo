ALTER TABLE "search_documents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'search_documents'
      AND policyname = 'tenant_isolation_search_documents'
  ) THEN
    CREATE POLICY "tenant_isolation_search_documents"
      ON "search_documents"
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
  END IF;
END $$;
