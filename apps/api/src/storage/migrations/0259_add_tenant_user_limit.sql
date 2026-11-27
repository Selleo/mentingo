ALTER TABLE "tenants" ADD COLUMN "max_users" integer;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "max_users_overflow_percentage" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "user_capacity_alert_level" text DEFAULT 'within_limit' NOT NULL;