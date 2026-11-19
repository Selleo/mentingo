-- Custom SQL migration file, put you code below! --

ALTER TABLE "public"."discussion_reply_digests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "discussion_reply_digests_tenant_isolation" ON "public"."discussion_reply_digests"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
