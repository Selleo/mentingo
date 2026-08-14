ALTER TABLE "ai_mentor_configurations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_mentor_teacher_configurations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_mentor_roleplay_configurations" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_mentor_configurations_tenant_isolation"
  ON "ai_mentor_configurations";
DROP POLICY IF EXISTS "ai_mentor_teacher_configurations_tenant_isolation"
  ON "ai_mentor_teacher_configurations";
DROP POLICY IF EXISTS "ai_mentor_roleplay_configurations_tenant_isolation"
  ON "ai_mentor_roleplay_configurations";
--> statement-breakpoint
CREATE POLICY "ai_mentor_configurations_tenant_isolation" ON "ai_mentor_configurations"
  USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
CREATE POLICY "ai_mentor_teacher_configurations_tenant_isolation"
  ON "ai_mentor_teacher_configurations"
  USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
CREATE POLICY "ai_mentor_roleplay_configurations_tenant_isolation"
  ON "ai_mentor_roleplay_configurations"
  USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
