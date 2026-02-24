CREATE TABLE IF NOT EXISTS "master_course_entity_map" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"export_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"source_entity_id" uuid NOT NULL,
	"target_entity_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "master_course_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"source_tenant_id" uuid NOT NULL,
	"source_course_id" uuid NOT NULL,
	"target_tenant_id" uuid NOT NULL,
	"target_course_id" uuid,
	"sync_status" text DEFAULT 'active' NOT NULL,
	"last_synced_at" timestamp(3) with time zone
);
--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "origin_type" text DEFAULT 'regular' NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "source_course_id" uuid;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "source_tenant_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_course_entity_map" ADD CONSTRAINT "master_course_entity_map_export_id_master_course_exports_id_fk" FOREIGN KEY ("export_id") REFERENCES "public"."master_course_exports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_course_exports" ADD CONSTRAINT "master_course_exports_source_tenant_id_tenants_id_fk" FOREIGN KEY ("source_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_course_exports" ADD CONSTRAINT "master_course_exports_source_course_id_courses_id_fk" FOREIGN KEY ("source_course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_course_exports" ADD CONSTRAINT "master_course_exports_target_tenant_id_tenants_id_fk" FOREIGN KEY ("target_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "master_course_exports" ADD CONSTRAINT "master_course_exports_target_course_id_courses_id_fk" FOREIGN KEY ("target_course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "master_course_entity_map_export_idx" ON "master_course_entity_map" USING btree ("export_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "master_course_entity_map_source_entity_idx" ON "master_course_entity_map" USING btree ("entity_type","source_entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "master_course_entity_map_source_unique_idx" ON "master_course_entity_map" USING btree ("export_id","entity_type","source_entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "master_course_exports_source_course_idx" ON "master_course_exports" USING btree ("source_tenant_id","source_course_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "master_course_exports_target_course_idx" ON "master_course_exports" USING btree ("target_tenant_id","target_course_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "master_course_exports_source_target_unique_idx" ON "master_course_exports" USING btree ("source_tenant_id","source_course_id","target_tenant_id");