CREATE TABLE IF NOT EXISTS "support_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"original_user_id" uuid NOT NULL,
	"original_tenant_id" uuid NOT NULL,
	"target_tenant_id" uuid NOT NULL,
	"hashed_grant_token" text NOT NULL,
	"grant_expires_at" timestamp(3) with time zone NOT NULL,
	"activated_at" timestamp(3) with time zone,
	"expires_at" timestamp(3) with time zone NOT NULL,
	"revoked_at" timestamp(3) with time zone,
	"return_url" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_sessions" ADD CONSTRAINT "support_sessions_original_user_id_users_id_fk" FOREIGN KEY ("original_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_sessions" ADD CONSTRAINT "support_sessions_original_tenant_id_tenants_id_fk" FOREIGN KEY ("original_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_sessions" ADD CONSTRAINT "support_sessions_target_tenant_id_tenants_id_fk" FOREIGN KEY ("target_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "support_sessions_hashed_grant_token_unique" ON "support_sessions" USING btree ("hashed_grant_token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_sessions_status_idx" ON "support_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_sessions_original_user_idx" ON "support_sessions" USING btree ("original_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_sessions_target_tenant_idx" ON "support_sessions" USING btree ("target_tenant_id");