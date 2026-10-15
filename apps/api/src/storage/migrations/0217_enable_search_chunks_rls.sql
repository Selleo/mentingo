ALTER TABLE "search_chunks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "search_chunks_tenant_isolation" ON "search_chunks" USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
