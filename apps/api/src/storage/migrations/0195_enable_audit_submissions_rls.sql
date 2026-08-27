ALTER TABLE "audit_submissions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "audit_submissions_tenant_isolation" ON "audit_submissions";
--> statement-breakpoint
CREATE POLICY "audit_submissions_tenant_isolation"
  ON "audit_submissions"
  USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
