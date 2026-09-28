ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_verified_at" timestamp(3) with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_tenant_id_phone_unique_idx" ON "users" USING btree ("tenant_id","phone");