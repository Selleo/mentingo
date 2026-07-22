CREATE TABLE IF NOT EXISTS "microsoft_calendar_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"user_id" uuid NOT NULL,
	"microsoft_account_id" text NOT NULL,
	"microsoft_email" text NOT NULL,
	"refresh_token_ciphertext" text NOT NULL,
	"refresh_token_iv" text NOT NULL,
	"refresh_token_tag" text NOT NULL,
	"refresh_token_encrypted_dek" text NOT NULL,
	"refresh_token_encrypted_dek_iv" text NOT NULL,
	"refresh_token_encrypted_dek_tag" text NOT NULL,
	"status" text DEFAULT 'syncing' NOT NULL,
	"error_code" text,
	"delta_link" text,
	"sync_window_start" timestamp(3) with time zone,
	"sync_window_end" timestamp(3) with time zone,
	"window_built_at" timestamp(3) with time zone,
	"last_successful_sync_at" timestamp(3) with time zone,
	"last_sync_completed_at" timestamp(3) with time zone,
	"subscription_id" text,
	"subscription_client_state" text,
	"subscription_expires_at" timestamp(3) with time zone,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "microsoft_calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"connection_id" uuid NOT NULL,
	"calendar_event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"microsoft_event_id" text NOT NULL,
	"web_link" text,
	"sensitivity" text NOT NULL,
	"availability" text NOT NULL,
	"is_cancelled" boolean DEFAULT false NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "microsoft_calendar_connections" ADD CONSTRAINT "microsoft_calendar_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "microsoft_calendar_connections" ADD CONSTRAINT "microsoft_calendar_connections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "microsoft_calendar_events" ADD CONSTRAINT "microsoft_calendar_events_connection_id_microsoft_calendar_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."microsoft_calendar_connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "microsoft_calendar_events" ADD CONSTRAINT "microsoft_calendar_events_calendar_event_id_calendar_events_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "microsoft_calendar_events" ADD CONSTRAINT "microsoft_calendar_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "microsoft_calendar_events" ADD CONSTRAINT "microsoft_calendar_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "microsoft_calendar_connections_tenant_id_idx" ON "microsoft_calendar_connections" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "microsoft_calendar_connections_tenant_user_unique_idx" ON "microsoft_calendar_connections" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "microsoft_calendar_connections_subscription_idx" ON "microsoft_calendar_connections" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "microsoft_calendar_events_tenant_id_idx" ON "microsoft_calendar_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "microsoft_calendar_events_calendar_event_unique_idx" ON "microsoft_calendar_events" USING btree ("calendar_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "microsoft_calendar_events_tenant_connection_event_unique_idx" ON "microsoft_calendar_events" USING btree ("tenant_id","connection_id","microsoft_event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "microsoft_calendar_events_tenant_user_idx" ON "microsoft_calendar_events" USING btree ("tenant_id","user_id");