ALTER TABLE "user_statistics" ADD COLUMN IF NOT EXISTS "total_points" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_statistics" ADD COLUMN IF NOT EXISTS "last_point_at" timestamp(3) with time zone;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "point_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"user_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"points" integer NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "point_events" ADD CONSTRAINT "point_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "point_events" ADD CONSTRAINT "point_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "point_events_user_event_entity_unique_idx" ON "point_events" USING btree ("user_id","event_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "point_events_tenant_created_at_idx" ON "point_events" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "point_events_tenant_id_idx" ON "point_events" USING btree ("tenant_id");--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE public.point_events ENABLE ROW LEVEL SECURITY;

  BEGIN
    CREATE POLICY point_events_tenant_isolation
      ON public.point_events
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;
