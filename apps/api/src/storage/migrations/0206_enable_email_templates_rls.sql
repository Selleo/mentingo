-- Custom SQL migration file, put you code below! --

ALTER TABLE "email_templates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "email_templates_tenant_isolation" ON "email_templates";
--> statement-breakpoint
CREATE POLICY "email_templates_tenant_isolation"
  ON "email_templates"
  USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
