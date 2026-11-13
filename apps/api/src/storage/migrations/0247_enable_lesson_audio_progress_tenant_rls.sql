-- Custom tenant-isolation policy; table definition is generated in add_lesson_audio_progress.
ALTER TABLE "lesson_audio_progress" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "lesson_audio_progress_tenant_isolation" ON "lesson_audio_progress" USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
