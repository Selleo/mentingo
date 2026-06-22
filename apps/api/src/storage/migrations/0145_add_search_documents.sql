CREATE TABLE IF NOT EXISTS "search_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"document_type" text NOT NULL,
	"language" text NOT NULL,
	"content" text NOT NULL,
	"search_vector" "tsvector" NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "search_documents" ADD CONSTRAINT "search_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "search_documents_tenant_id_idx" ON "search_documents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "search_documents_vector_idx" ON "search_documents" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "search_documents_language_entity_type_idx" ON "search_documents" USING btree ("tenant_id","language","entity_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "search_documents_entity_idx" ON "search_documents" USING btree ("tenant_id","entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "search_documents_document_unique_idx" ON "search_documents" USING btree ("tenant_id","entity_type","entity_id","document_type","language");