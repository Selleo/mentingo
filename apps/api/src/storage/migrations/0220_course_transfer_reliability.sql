CREATE TABLE IF NOT EXISTS "course_transfer_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"operation_id" uuid NOT NULL,
	"dependency_stream_id" uuid NOT NULL,
	"required_revision" integer NOT NULL,
	"source_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "course_transfer_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"stream_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payload" jsonb NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"completed_at" timestamp(3) with time zone,
	"target_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "course_transfer_streams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"kind" text NOT NULL,
	"export_id" uuid NOT NULL,
	"source_tenant_id" uuid NOT NULL,
	"target_tenant_id" uuid NOT NULL,
	"requested_revision" integer DEFAULT 0 NOT NULL,
	"applied_revision" integer DEFAULT 0 NOT NULL,
	"latest_operation_id" uuid,
	"claim_token" uuid,
	"lease_expires_at" timestamp(3) with time zone,
	"next_recovery_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"target_id" uuid
);
--> statement-breakpoint
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
 ALTER TABLE "course_transfer_dependencies" ADD CONSTRAINT "course_transfer_dependencies_operation_id_course_transfer_operations_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."course_transfer_operations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_transfer_dependencies" ADD CONSTRAINT "course_transfer_dependencies_dependency_stream_id_course_transfer_streams_id_fk" FOREIGN KEY ("dependency_stream_id") REFERENCES "public"."course_transfer_streams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_transfer_operations" ADD CONSTRAINT "course_transfer_operations_stream_id_course_transfer_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."course_transfer_streams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_transfer_streams" ADD CONSTRAINT "course_transfer_streams_source_tenant_id_tenants_id_fk" FOREIGN KEY ("source_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_transfer_streams" ADD CONSTRAINT "course_transfer_streams_target_tenant_id_tenants_id_fk" FOREIGN KEY ("target_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
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
CREATE UNIQUE INDEX IF NOT EXISTS "course_transfer_dependencies_operation_stream_idx" ON "course_transfer_dependencies" USING btree ("operation_id","dependency_stream_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_transfer_dependencies_stream_idx" ON "course_transfer_dependencies" USING btree ("dependency_stream_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "course_transfer_operations_revision_idx" ON "course_transfer_operations" USING btree ("stream_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "course_transfer_streams_relationship_idx" ON "course_transfer_streams" USING btree ("kind","export_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_transfer_streams_recovery_idx" ON "course_transfer_streams" USING btree ("next_recovery_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "hosted_videos_provider_video_idx" ON "hosted_videos" USING btree ("provider","provider_video_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hosted_videos_tenant_reference_idx" ON "hosted_videos" USING btree ("tenant_id","reference");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hosted_videos_status_idx" ON "hosted_videos" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "hosted_videos_copy_idx" ON "hosted_videos" USING btree ("tenant_id","provider","provider_configuration_signature","copied_from_tenant_id","copied_from_reference") WHERE "hosted_videos"."copied_from_reference" IS NOT NULL;