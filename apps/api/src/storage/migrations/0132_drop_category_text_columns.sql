DROP INDEX IF EXISTS "categories_tenant_id_title_unique";--> statement-breakpoint
ALTER TABLE "categories" DROP COLUMN IF EXISTS "title";