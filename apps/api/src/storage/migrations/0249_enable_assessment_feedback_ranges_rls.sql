-- Custom SQL migration file, put you code below! --

ALTER TABLE "public"."assessment_feedback_ranges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "assessment_feedback_ranges_tenant_isolation" ON "public"."assessment_feedback_ranges"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
