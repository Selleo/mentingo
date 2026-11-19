CREATE TABLE IF NOT EXISTS "discussion_reply_digests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"user_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"send_after" timestamp(3) with time zone NOT NULL,
	"replies" jsonb NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discussion_reply_digests" ADD CONSTRAINT "discussion_reply_digests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discussion_reply_digests" ADD CONSTRAINT "discussion_reply_digests_thread_id_course_chat_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."course_chat_threads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discussion_reply_digests" ADD CONSTRAINT "discussion_reply_digests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "discussion_reply_digests_tenant_id_idx" ON "discussion_reply_digests" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "discussion_reply_digests_user_id_thread_id_unique_idx" ON "discussion_reply_digests" USING btree ("user_id","thread_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "discussion_reply_digests_send_after_idx" ON "discussion_reply_digests" USING btree ("send_after");