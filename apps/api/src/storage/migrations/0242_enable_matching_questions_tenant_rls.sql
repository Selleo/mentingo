-- Custom tenant-isolation policies; table definitions are generated in add_matching_questions.
ALTER TABLE "assessment_question_matching_pairs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "assessment_question_matching_pairs_tenant_isolation" ON "assessment_question_matching_pairs" USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
ALTER TABLE "assessment_attempt_matching_answers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "assessment_attempt_matching_answers_tenant_isolation" ON "assessment_attempt_matching_answers" USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
