ALTER TABLE "course_authoring_drafts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "course_authoring_drafts_tenant_isolation"
  ON "course_authoring_drafts"
  USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
ALTER TABLE "course_authoring_applications"
  ADD CONSTRAINT "course_authoring_applications_subject_required"
  CHECK ("course_id" IS NOT NULL OR "draft_course_id" IS NOT NULL);
