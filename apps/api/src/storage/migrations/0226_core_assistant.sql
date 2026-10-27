CREATE TABLE IF NOT EXISTS "assistant_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"role" text NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'complete' NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"client_message_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assistant_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"user_message_id" uuid NOT NULL,
	"assistant_message_id" uuid NOT NULL,
	"language" text NOT NULL,
	"origin" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"activity" text,
	"workflow_run_id" text,
	"error_code" text,
	"successful_tool_calls" integer DEFAULT 0 NOT NULL,
	"readable_tool_calls" integer DEFAULT 0 NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assistant_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text DEFAULT 'New conversation' NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"archived" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_thread_id_assistant_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."assistant_threads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assistant_runs" ADD CONSTRAINT "assistant_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assistant_runs" ADD CONSTRAINT "assistant_runs_thread_id_assistant_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."assistant_threads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assistant_runs" ADD CONSTRAINT "assistant_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assistant_runs" ADD CONSTRAINT "assistant_runs_user_message_id_assistant_messages_id_fk" FOREIGN KEY ("user_message_id") REFERENCES "public"."assistant_messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assistant_runs" ADD CONSTRAINT "assistant_runs_assistant_message_id_assistant_messages_id_fk" FOREIGN KEY ("assistant_message_id") REFERENCES "public"."assistant_messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assistant_threads" ADD CONSTRAINT "assistant_threads_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assistant_threads" ADD CONSTRAINT "assistant_threads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assistant_messages_tenant_id_idx" ON "assistant_messages" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assistant_messages_thread_created_idx" ON "assistant_messages" USING btree ("tenant_id","thread_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assistant_messages_client_id_unique" ON "assistant_messages" USING btree ("tenant_id","thread_id","client_message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assistant_runs_tenant_id_idx" ON "assistant_runs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assistant_runs_thread_created_idx" ON "assistant_runs" USING btree ("tenant_id","thread_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assistant_runs_user_message_unique" ON "assistant_runs" USING btree ("tenant_id","user_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assistant_runs_active_thread_unique" ON "assistant_runs" USING btree ("tenant_id","thread_id") WHERE "assistant_runs"."status" in ('pending', 'running');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assistant_threads_tenant_id_idx" ON "assistant_threads" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assistant_threads_owner_updated_idx" ON "assistant_threads" USING btree ("tenant_id","user_id","updated_at");