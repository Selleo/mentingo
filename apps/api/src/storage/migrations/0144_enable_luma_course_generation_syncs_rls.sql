-- Custom SQL migration file, put you code below! --
ALTER TABLE "luma_course_generation_syncs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "luma_course_generation_syncs_tenant_isolation"
  ON "luma_course_generation_syncs"
  USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
