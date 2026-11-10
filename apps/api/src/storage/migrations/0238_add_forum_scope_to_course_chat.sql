ALTER TABLE "course_chat_message_reactions" ALTER COLUMN "course_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "course_chat_messages" ALTER COLUMN "course_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "course_chat_threads" ALTER COLUMN "course_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "course_chat_threads" ADD COLUMN "scope" text DEFAULT 'course' NOT NULL;--> statement-breakpoint
ALTER TABLE "course_chat_threads" ADD COLUMN "title" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_chat_threads_tenant_id_scope_updated_at_idx" ON "course_chat_threads" USING btree ("tenant_id","scope","updated_at");