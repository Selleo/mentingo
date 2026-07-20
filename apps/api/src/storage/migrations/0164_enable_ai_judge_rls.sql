ALTER TABLE "ai_judge_configurations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_judge_criteria" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_judge_score_guidance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_judge_blocking_errors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_mentor_judgements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_mentor_judgement_criteria" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_mentor_judgement_blocking_errors" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_judge_configurations_tenant_isolation" ON "ai_judge_configurations";
DROP POLICY IF EXISTS "ai_judge_criteria_tenant_isolation" ON "ai_judge_criteria";
DROP POLICY IF EXISTS "ai_judge_score_guidance_tenant_isolation" ON "ai_judge_score_guidance";
DROP POLICY IF EXISTS "ai_judge_blocking_errors_tenant_isolation" ON "ai_judge_blocking_errors";
DROP POLICY IF EXISTS "ai_mentor_judgements_tenant_isolation" ON "ai_mentor_judgements";
DROP POLICY IF EXISTS "ai_mentor_judgement_criteria_tenant_isolation" ON "ai_mentor_judgement_criteria";
DROP POLICY IF EXISTS "ai_mentor_judgement_blocking_errors_tenant_isolation"
  ON "ai_mentor_judgement_blocking_errors";
--> statement-breakpoint
CREATE POLICY "ai_judge_configurations_tenant_isolation" ON "ai_judge_configurations"
  USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
CREATE POLICY "ai_judge_criteria_tenant_isolation" ON "ai_judge_criteria"
  USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
CREATE POLICY "ai_judge_score_guidance_tenant_isolation" ON "ai_judge_score_guidance"
  USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
CREATE POLICY "ai_judge_blocking_errors_tenant_isolation" ON "ai_judge_blocking_errors"
  USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
CREATE POLICY "ai_mentor_judgements_tenant_isolation" ON "ai_mentor_judgements"
  USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
CREATE POLICY "ai_mentor_judgement_criteria_tenant_isolation" ON "ai_mentor_judgement_criteria"
  USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
CREATE POLICY "ai_mentor_judgement_blocking_errors_tenant_isolation"
  ON "ai_mentor_judgement_blocking_errors"
  USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
