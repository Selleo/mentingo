CREATE TABLE IF NOT EXISTS "email_notification_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"name" text NOT NULL,
	"subject" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"blocks" jsonb DEFAULT '{"type":"doc","content":[]}'::jsonb NOT NULL,
	"strings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"base_language" text DEFAULT 'en' NOT NULL,
	"available_locales" text[] DEFAULT ARRAY['en']::text[] NOT NULL,
	"archived_at" timestamp(3) with time zone,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_notification_templates" ADD CONSTRAINT "email_notification_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_notification_templates_tenant_id_idx" ON "email_notification_templates" USING btree ("tenant_id");--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE public.email_notification_templates ENABLE ROW LEVEL SECURITY;

  BEGIN
    CREATE POLICY email_notification_templates_tenant_isolation
      ON public.email_notification_templates
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END
$$;