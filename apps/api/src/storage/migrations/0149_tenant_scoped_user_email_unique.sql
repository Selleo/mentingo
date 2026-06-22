ALTER TABLE "users" DROP CONSTRAINT "users_email_unique";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_tenant_id_email_unique_idx" ON "users" USING btree ("tenant_id","email");
