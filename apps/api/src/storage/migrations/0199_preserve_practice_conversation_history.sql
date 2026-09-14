DROP INDEX IF EXISTS "ai_mentor_threads_practice_session_unique_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_mentor_thread_messages_thread_created_at_idx" ON "ai_mentor_thread_messages" USING btree ("thread_id","created_at","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_mentor_threads_practice_session_idx" ON "ai_mentor_threads" USING btree ("practice_session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_mentor_threads_tenant_created_at_idx" ON "ai_mentor_threads" USING btree ("tenant_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_mentor_threads_practice_session_unique_idx" ON "ai_mentor_threads" USING btree ("practice_session_id") WHERE "ai_mentor_threads"."status" <> 'archived';