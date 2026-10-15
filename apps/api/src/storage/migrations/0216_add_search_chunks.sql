CREATE TABLE IF NOT EXISTS "search_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"document_type" text NOT NULL,
	"language" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"search_vector" "tsvector" NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"source_hash" text NOT NULL,
	"source_revision" text DEFAULT '' NOT NULL,
	"embedding_model" text NOT NULL,
	"index_version" integer NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "search_chunks" ADD CONSTRAINT "search_chunks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "search_chunks_tenant_id_idx" ON "search_chunks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "search_chunks_vector_idx" ON "search_chunks" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "search_chunks_entity_idx" ON "search_chunks" USING btree ("tenant_id","entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "search_chunks_source_unique_idx" ON "search_chunks" USING btree ("tenant_id","entity_type","entity_id","document_type","language","chunk_index");