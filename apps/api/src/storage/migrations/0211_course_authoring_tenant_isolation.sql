ALTER TABLE "course_authoring_applications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "course_authoring_applications_tenant_isolation"
  ON "course_authoring_applications"
  USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
ALTER TABLE "course_authoring_context_bindings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "course_authoring_context_bindings_tenant_isolation"
  ON "course_authoring_context_bindings"
  USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
ALTER TABLE "course_authoring_context_requests" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "course_authoring_context_requests_tenant_isolation"
  ON "course_authoring_context_requests"
  USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
ALTER TABLE "course_authoring_staged_assets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "course_authoring_staged_assets_tenant_isolation"
  ON "course_authoring_staged_assets"
  USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
