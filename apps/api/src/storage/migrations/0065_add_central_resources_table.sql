CREATE TABLE IF NOT EXISTS "resource_entity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"resource_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"relationship_type" varchar(100) DEFAULT 'attachment' NOT NULL,
	CONSTRAINT "resource_entity_resource_id_entity_id_entity_type_relationship_type_unique" UNIQUE("resource_id","entity_id","entity_type","relationship_type")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"title" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"description" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reference" varchar(200) NOT NULL,
	"content_type" varchar(100) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"uploaded_by_id" uuid,
	"archived" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_entity" ADD CONSTRAINT "resource_entity_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resources" ADD CONSTRAINT "resources_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_entity_resource_idx" ON "resource_entity" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_entity_entity_idx" ON "resource_entity" USING btree ("entity_id","entity_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_entity_relationship_idx" ON "resource_entity" USING btree ("entity_id","entity_type","relationship_type");