CREATE TABLE IF NOT EXISTS "course_chat_message_reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"message_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"reaction" text NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_chat_message_reactions" ADD CONSTRAINT "course_chat_message_reactions_message_id_course_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."course_chat_messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_chat_message_reactions" ADD CONSTRAINT "course_chat_message_reactions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_chat_message_reactions" ADD CONSTRAINT "course_chat_message_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_chat_message_reactions" ADD CONSTRAINT "course_chat_message_reactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_chat_message_reactions_tenant_id_idx" ON "course_chat_message_reactions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_chat_message_reactions_message_id_reaction_idx" ON "course_chat_message_reactions" USING btree ("message_id","reaction");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "course_chat_message_reactions_user_message_reaction_unique_idx" ON "course_chat_message_reactions" USING btree ("user_id","message_id","reaction");--> statement-breakpoint
ALTER TABLE "course_chat_message_reactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
 CREATE POLICY "course_chat_message_reactions_tenant_isolation" ON "course_chat_message_reactions" USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
