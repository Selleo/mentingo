ALTER TABLE "assistant_messages" ADD COLUMN "external_message_id" text;--> statement-breakpoint
ALTER TABLE "assistant_messages" ADD COLUMN "slack_user_id" text;--> statement-breakpoint
ALTER TABLE "assistant_messages" ADD COLUMN "slack_user_name" text;--> statement-breakpoint
ALTER TABLE "assistant_threads" ADD COLUMN "source" text DEFAULT 'mentingo' NOT NULL;--> statement-breakpoint
ALTER TABLE "assistant_threads" ADD COLUMN "external_thread_key" text;--> statement-breakpoint
ALTER TABLE "assistant_threads" ADD COLUMN "external_client_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assistant_messages_external_unique" ON "assistant_messages" USING btree ("tenant_id","thread_id","external_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assistant_threads_external_unique" ON "assistant_threads" USING btree ("tenant_id","user_id","external_client_id","external_thread_key");