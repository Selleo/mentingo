ALTER TABLE "content_marketplace_course_lineages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "content_marketplace_course_lineages_tenant_isolation" ON "content_marketplace_course_lineages" USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
ALTER TABLE "native_archive_entity_map" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "native_archive_entity_map_tenant_isolation" ON "native_archive_entity_map" USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);