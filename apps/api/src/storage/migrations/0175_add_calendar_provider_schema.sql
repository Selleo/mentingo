CREATE TABLE IF NOT EXISTS "calendar_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"account_id" text NOT NULL,
	"account_email" text NOT NULL,
	"refresh_token_ciphertext" text NOT NULL,
	"refresh_token_iv" text NOT NULL,
	"refresh_token_tag" text NOT NULL,
	"refresh_token_encrypted_dek" text NOT NULL,
	"refresh_token_encrypted_dek_iv" text NOT NULL,
	"refresh_token_encrypted_dek_tag" text NOT NULL,
	"status" text DEFAULT 'syncing' NOT NULL,
	"error_code" text,
	"sync_cursor" text,
	"sync_window_start" timestamp(3) with time zone,
	"sync_window_end" timestamp(3) with time zone,
	"window_built_at" timestamp(3) with time zone,
	"last_successful_sync_at" timestamp(3) with time zone,
	"last_sync_completed_at" timestamp(3) with time zone,
	"subscription_id" text,
	"subscription_client_state" text,
	"subscription_expires_at" timestamp(3) with time zone,
	"outbound_sync_enabled" boolean DEFAULT false NOT NULL,
	"outbound_status" text DEFAULT 'disabled' NOT NULL,
	"outbound_calendar_id" text,
	"outbound_error_code" text,
	"last_outbound_sync_at" timestamp(3) with time zone,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calendar_external_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"connection_id" uuid NOT NULL,
	"calendar_event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"external_event_id" text NOT NULL,
	"web_link" text,
	"sensitivity" text NOT NULL,
	"availability" text NOT NULL,
	"is_cancelled" boolean DEFAULT false NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calendar_outbound_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"connection_id" uuid NOT NULL,
	"calendar_event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"external_event_id" text NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_external_events" ADD CONSTRAINT "calendar_external_events_connection_id_calendar_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."calendar_connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_external_events" ADD CONSTRAINT "calendar_external_events_calendar_event_id_calendar_events_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_external_events" ADD CONSTRAINT "calendar_external_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_external_events" ADD CONSTRAINT "calendar_external_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_outbound_events" ADD CONSTRAINT "calendar_outbound_events_connection_id_calendar_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."calendar_connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_outbound_events" ADD CONSTRAINT "calendar_outbound_events_calendar_event_id_calendar_events_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_outbound_events" ADD CONSTRAINT "calendar_outbound_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_outbound_events" ADD CONSTRAINT "calendar_outbound_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_connections_tenant_id_idx" ON "calendar_connections" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "calendar_connections_tenant_user_provider_unique_idx" ON "calendar_connections" USING btree ("tenant_id","user_id","provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_connections_subscription_idx" ON "calendar_connections" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_external_events_tenant_id_idx" ON "calendar_external_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "calendar_external_events_calendar_event_unique_idx" ON "calendar_external_events" USING btree ("calendar_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "calendar_external_events_tenant_connection_event_unique_idx" ON "calendar_external_events" USING btree ("tenant_id","connection_id","external_event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_external_events_tenant_user_idx" ON "calendar_external_events" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_outbound_events_tenant_id_idx" ON "calendar_outbound_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "calendar_outbound_events_connection_event_user_unique_idx" ON "calendar_outbound_events" USING btree ("tenant_id","connection_id","calendar_event_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "calendar_outbound_events_connection_external_event_unique_idx" ON "calendar_outbound_events" USING btree ("tenant_id","connection_id","external_event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_outbound_events_calendar_event_idx" ON "calendar_outbound_events" USING btree ("tenant_id","calendar_event_id");
