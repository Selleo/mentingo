DROP INDEX IF EXISTS "secrets_name_uq";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "secrets_tenant_secret_name_uq" ON "secrets" USING btree ("tenant_id","secret_name");