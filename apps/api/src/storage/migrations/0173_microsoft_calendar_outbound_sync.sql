CREATE TABLE IF NOT EXISTS "microsoft_calendar_outbound_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"connection_id" uuid NOT NULL,
	"calendar_event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"microsoft_event_id" text NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "microsoft_calendar_connections" ADD COLUMN "outbound_sync_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "microsoft_calendar_connections" ADD COLUMN "outbound_status" text DEFAULT 'disabled' NOT NULL;--> statement-breakpoint
ALTER TABLE "microsoft_calendar_connections" ADD COLUMN "outbound_calendar_id" text;--> statement-breakpoint
ALTER TABLE "microsoft_calendar_connections" ADD COLUMN "outbound_error_code" text;--> statement-breakpoint
ALTER TABLE "microsoft_calendar_connections" ADD COLUMN "last_outbound_sync_at" timestamp(3) with time zone;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "microsoft_calendar_outbound_events" ADD CONSTRAINT "microsoft_calendar_outbound_events_connection_id_microsoft_calendar_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."microsoft_calendar_connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "microsoft_calendar_outbound_events" ADD CONSTRAINT "microsoft_calendar_outbound_events_calendar_event_id_calendar_events_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "microsoft_calendar_outbound_events" ADD CONSTRAINT "microsoft_calendar_outbound_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "microsoft_calendar_outbound_events" ADD CONSTRAINT "microsoft_calendar_outbound_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "microsoft_calendar_outbound_events_tenant_id_idx" ON "microsoft_calendar_outbound_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "microsoft_calendar_outbound_events_connection_event_user_unique_idx" ON "microsoft_calendar_outbound_events" USING btree ("tenant_id","connection_id","calendar_event_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "microsoft_calendar_outbound_events_connection_microsoft_event_unique_idx" ON "microsoft_calendar_outbound_events" USING btree ("tenant_id","connection_id","microsoft_event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "microsoft_calendar_outbound_events_calendar_event_idx" ON "microsoft_calendar_outbound_events" USING btree ("tenant_id","calendar_event_id");