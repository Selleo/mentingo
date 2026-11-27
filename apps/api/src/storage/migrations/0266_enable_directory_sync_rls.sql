-- Custom SQL migration file, put you code below! --
ALTER TABLE "public"."directory_sync_connections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "directory_sync_connections_tenant_isolation" ON "public"."directory_sync_connections"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);--> statement-breakpoint
ALTER TABLE "public"."directory_sync_role_mappings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "directory_sync_role_mappings_tenant_isolation" ON "public"."directory_sync_role_mappings"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);--> statement-breakpoint
ALTER TABLE "public"."directory_sync_group_mappings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "directory_sync_group_mappings_tenant_isolation" ON "public"."directory_sync_group_mappings"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);--> statement-breakpoint
ALTER TABLE "public"."user_external_identities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "user_external_identities_tenant_isolation" ON "public"."user_external_identities"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);--> statement-breakpoint
ALTER TABLE "public"."directory_sync_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "directory_sync_runs_tenant_isolation" ON "public"."directory_sync_runs"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
