DO $$ BEGIN
	ALTER TABLE "ai_judge_configurations"
		ADD CONSTRAINT "ai_judge_configurations_exactly_one_source_check"
		CHECK (("ai_mentor_lesson_id" IS NOT NULL) <> ("practice_session_id" IS NOT NULL));
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "ai_mentor_threads"
		ADD CONSTRAINT "ai_mentor_threads_exactly_one_source_check"
		CHECK (("ai_mentor_lesson_id" IS NOT NULL) <> ("practice_session_id" IS NOT NULL));
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "ai_mentor_practice_sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "ai_mentor_practice_sessions_tenant_isolation"
	ON "ai_mentor_practice_sessions";
--> statement-breakpoint
CREATE POLICY "ai_mentor_practice_sessions_tenant_isolation"
	ON "ai_mentor_practice_sessions"
	USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
	WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
