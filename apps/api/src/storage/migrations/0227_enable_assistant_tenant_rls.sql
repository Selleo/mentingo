-- Custom tenant-isolation policies; table definitions are generated in core_assistant.
ALTER TABLE "assistant_threads" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "assistant_threads_tenant_isolation" ON "assistant_threads" USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
ALTER TABLE "assistant_messages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "assistant_messages_tenant_isolation" ON "assistant_messages" USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
ALTER TABLE "assistant_runs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "assistant_runs_tenant_isolation" ON "assistant_runs" USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
