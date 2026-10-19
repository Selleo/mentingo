CREATE TABLE IF NOT EXISTS "content_marketplace_course_lineages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"course_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"acquisition_id" uuid NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	CONSTRAINT "content_marketplace_course_lineages_course_id_unique" UNIQUE("course_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "native_archive_entity_map" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"course_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"source_entity_id" uuid NOT NULL,
	"target_entity_id" uuid NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "content_marketplace_course_lineages" ADD CONSTRAINT "content_marketplace_course_lineages_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "content_marketplace_course_lineages" ADD CONSTRAINT "content_marketplace_course_lineages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "native_archive_entity_map" ADD CONSTRAINT "native_archive_entity_map_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "native_archive_entity_map" ADD CONSTRAINT "native_archive_entity_map_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_marketplace_course_lineages_tenant_id_idx" ON "content_marketplace_course_lineages" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "native_archive_entity_map_tenant_id_idx" ON "native_archive_entity_map" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "native_archive_entity_map_source_unique_idx" ON "native_archive_entity_map" USING btree ("course_id","entity_type","source_entity_id");