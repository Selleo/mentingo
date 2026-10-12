ALTER TABLE "automations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "automations_tenant_isolation" ON "automations" USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
ALTER TABLE "automation_steps" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "automation_steps_tenant_isolation" ON "automation_steps" USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
ALTER TABLE "automation_runs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "automation_runs_tenant_isolation" ON "automation_runs" USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
ALTER TABLE "automation_occurrences" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "automation_occurrences_tenant_isolation" ON "automation_occurrences" USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
ALTER TABLE "automation_email_deliveries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "automation_email_deliveries_tenant_isolation" ON "automation_email_deliveries" USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
ALTER TABLE "notification_account_action_intents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "notification_account_action_intents_tenant_isolation" ON "notification_account_action_intents" USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
