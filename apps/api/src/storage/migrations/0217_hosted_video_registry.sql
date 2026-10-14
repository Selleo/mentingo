CREATE TABLE IF NOT EXISTS "hosted_videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_video_id" text,
	"reference" text,
	"provider_configuration_signature" text NOT NULL,
	"status" text NOT NULL,
	"status_changed_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"copied_from_tenant_id" uuid,
	"copied_from_reference" text,
	"last_checked_at" timestamp(3) with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hosted_videos" ADD CONSTRAINT "hosted_videos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hosted_videos" ADD CONSTRAINT "hosted_videos_copied_from_tenant_id_tenants_id_fk" FOREIGN KEY ("copied_from_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "hosted_videos_provider_video_idx" ON "hosted_videos" USING btree ("provider","provider_video_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hosted_videos_tenant_reference_idx" ON "hosted_videos" USING btree ("tenant_id","reference");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hosted_videos_status_idx" ON "hosted_videos" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "hosted_videos_copy_idx" ON "hosted_videos" USING btree ("tenant_id","provider","provider_configuration_signature","copied_from_tenant_id","copied_from_reference") WHERE "hosted_videos"."copied_from_reference" IS NOT NULL;