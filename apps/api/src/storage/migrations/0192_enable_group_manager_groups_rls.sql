ALTER TABLE "group_manager_groups" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "group_manager_groups_tenant_isolation" ON "group_manager_groups";
--> statement-breakpoint
CREATE POLICY "group_manager_groups_tenant_isolation"
  ON "group_manager_groups"
  USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
