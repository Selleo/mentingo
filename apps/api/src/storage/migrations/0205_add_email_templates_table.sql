CREATE TABLE IF NOT EXISTS "email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"name" jsonb NOT NULL,
	"subject" jsonb NOT NULL,
	"content" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"event" text NOT NULL,
	"base_language" text DEFAULT 'en' NOT NULL,
	"available_locales" text[] DEFAULT ARRAY['en']::text[] NOT NULL,
	"published_at" timestamp(3) with time zone,
	"archived_at" timestamp(3) with time zone,
	"deleted_at" timestamp(3) with time zone,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_templates_tenant_event_idx" ON "email_templates" USING btree ("tenant_id","event");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_templates_published_event_unique_idx" ON "email_templates" USING btree ("tenant_id","event") WHERE "email_templates"."status" = 'published';
