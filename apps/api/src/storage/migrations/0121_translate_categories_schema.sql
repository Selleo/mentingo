DROP INDEX IF EXISTS "categories_tenant_id_title_unique";--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "title" SET DATA TYPE jsonb USING "title"::jsonb;--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "title" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "base_language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "available_locales" text[] DEFAULT ARRAY['en']::text[] NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "categories_tenant_id_base_title_unique" ON "categories" USING btree ("tenant_id",("title"->>"base_language"));
