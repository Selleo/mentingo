ALTER TABLE "integration_api_keys" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "access_ends_at" timestamp(3) with time zone;