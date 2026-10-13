-- Custom SQL migration file, put you code below! --
ALTER TABLE "reports_configurations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "reports_configurations_tenant_isolation" ON "reports_configurations";
--> statement-breakpoint
CREATE POLICY "reports_configurations_tenant_isolation"
  ON "reports_configurations"
  USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
ALTER TABLE "reports_exports" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "reports_exports_tenant_isolation" ON "reports_exports";
--> statement-breakpoint
CREATE POLICY "reports_exports_tenant_isolation"
  ON "reports_exports"
  USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
