DO $$ BEGIN
 CREATE TYPE "public"."automation_node_kind" AS ENUM('action', 'condition', 'trigger');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."automation_run_status" AS ENUM('pending', 'processing', 'succeeded', 'warnings', 'failed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."automation_status" AS ENUM('enabled', 'disabled', 'archived', 'draft');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "automation_email_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"step_id" text NOT NULL,
	"recipient_item_id" text NOT NULL,
	"step_order" integer DEFAULT 0 NOT NULL,
	"recipient_email" text NOT NULL,
	"language" text,
	"template" jsonb NOT NULL,
	"template_version" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"event_fields" jsonb,
	"account_action_intent_id" uuid,
	"claimed_at" timestamp(3) with time zone,
	"completed_at" timestamp(3) with time zone,
	"reason_code" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "automation_occurrences" (
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"occurrence_id" text NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "automation_occurrences_tenant_id_occurrence_id_pk" PRIMARY KEY("tenant_id","occurrence_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "automation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"automation_id" uuid NOT NULL,
	"automation_name" text DEFAULT '' NOT NULL,
	"failure_reason_code" text,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"email_addresses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"occurrence_id" text NOT NULL,
	"event_kind" text NOT NULL,
	"execution_version" integer NOT NULL,
	"status" "automation_run_status" DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp(3) with time zone,
	"succeeded_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"cancelled_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "automation_steps" (
	"id" uuid NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"automation_id" uuid NOT NULL,
	"definition_kind" text NOT NULL,
	"parent_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"node_kind" "automation_node_kind" NOT NULL,
	"configuration" jsonb NOT NULL,
	CONSTRAINT "automation_steps_automation_id_id_definition_kind_pk" PRIMARY KEY("automation_id","id","definition_kind")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "automations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"status" "automation_status" DEFAULT 'draft' NOT NULL,
	"name" jsonb NOT NULL,
	"description" jsonb NOT NULL,
	"applied_name" jsonb,
	"applied_description" jsonb,
	"draft_root_step_id" uuid,
	"applied_root_step_id" uuid,
	"base_language" text DEFAULT 'en' NOT NULL,
	"available_locales" text[] DEFAULT ARRAY['en']::text[] NOT NULL,
	"execution_version" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp(3) with time zone,
	"built_in_key" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_account_action_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"application_origin" text NOT NULL,
	"token_ttl_ms" bigint NOT NULL,
	"uses_calendar_year_expiry" boolean DEFAULT false NOT NULL,
	"reminder_count" integer DEFAULT 0 NOT NULL,
	"revoke_previous_password_setup_tokens" boolean DEFAULT false NOT NULL,
	"auth_token_id" uuid,
	"encrypted_token" jsonb,
	"token_created_at" timestamp(3) with time zone,
	"token_expires_at" timestamp(3) with time zone
);
--> statement-breakpoint
DROP INDEX IF EXISTS "email_templates_published_event_unique_idx";--> statement-breakpoint
ALTER TABLE "email_templates" ALTER COLUMN "event" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "email_templates" ADD COLUMN "trigger_event_kind" text;--> statement-breakpoint
ALTER TABLE "email_templates" ADD COLUMN "placeholders" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "email_templates" ADD COLUMN "publication" jsonb;--> statement-breakpoint
ALTER TABLE "email_templates" ADD COLUMN "publication_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "automation_email_deliveries" ADD CONSTRAINT "automation_email_deliveries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "automation_email_deliveries" ADD CONSTRAINT "automation_email_deliveries_run_id_automation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."automation_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "automation_occurrences" ADD CONSTRAINT "automation_occurrences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "automation_steps" ADD CONSTRAINT "automation_steps_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "automation_steps" ADD CONSTRAINT "automation_steps_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "automations" ADD CONSTRAINT "automations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_account_action_intents" ADD CONSTRAINT "notification_account_action_intents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_account_action_intents" ADD CONSTRAINT "notification_account_action_intents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "automation_email_deliveries_tenant_id_idx" ON "automation_email_deliveries" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "automation_email_deliveries_identity_idx" ON "automation_email_deliveries" USING btree ("tenant_id","run_id","step_id","recipient_item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "automation_email_deliveries_status_idx" ON "automation_email_deliveries" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "automation_occurrences_tenant_id_idx" ON "automation_occurrences" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "automation_runs_tenant_id_idx" ON "automation_runs" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "automation_runs_occurrence_idx" ON "automation_runs" USING btree ("tenant_id","automation_id","occurrence_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "automation_runs_retention_idx" ON "automation_runs" USING btree ("tenant_id","completed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "automation_steps_tenant_id_idx" ON "automation_steps" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "automations_tenant_id_idx" ON "automations" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "automations_built_in_key_unique_idx" ON "automations" USING btree ("tenant_id","built_in_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_account_action_intents_tenant_id_idx" ON "notification_account_action_intents" USING btree ("tenant_id");