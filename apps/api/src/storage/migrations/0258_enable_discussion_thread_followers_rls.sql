-- Custom SQL migration file, put you code below! --
ALTER TABLE "public"."discussion_thread_followers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "discussion_thread_followers_tenant_isolation" ON "public"."discussion_thread_followers"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
