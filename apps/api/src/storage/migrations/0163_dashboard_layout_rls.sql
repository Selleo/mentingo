ALTER TABLE "dashboard_layouts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "dashboard_layouts_tenant_isolation"
ON "dashboard_layouts"
USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
ALTER TABLE "dashboard_layout_widgets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "dashboard_layout_widgets_tenant_isolation"
ON "dashboard_layout_widgets"
USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
