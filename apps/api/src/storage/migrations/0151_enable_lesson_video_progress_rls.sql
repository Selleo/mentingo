ALTER TABLE "lesson_video_progress" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$ BEGIN
  CREATE POLICY "lesson_video_progress_tenant_isolation"
  ON "lesson_video_progress"
  USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
