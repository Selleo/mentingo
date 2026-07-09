CREATE TABLE IF NOT EXISTS "processed_source_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"processed_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_challenge_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"challenge_id" uuid NOT NULL,
	"period_key" text NOT NULL,
	"current_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"completed_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"lifetime_xp" integer DEFAULT 0 NOT NULL,
	"spendable_xp" integer DEFAULT 0 NOT NULL,
	"current_level" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "xp_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"type" text NOT NULL,
	"affects_lifetime" boolean NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "processed_source_events" ADD CONSTRAINT "processed_source_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_challenge_progress" ADD CONSTRAINT "user_challenge_progress_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_challenge_progress" ADD CONSTRAINT "user_challenge_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_challenge_progress" ADD CONSTRAINT "user_challenge_progress_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "xp_transactions" ADD CONSTRAINT "xp_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "xp_transactions" ADD CONSTRAINT "xp_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "processed_source_events_tenant_id_idx" ON "processed_source_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "processed_source_events_source_unique" ON "processed_source_events" USING btree ("tenant_id","source_type","source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "processed_source_events_processed_at_idx" ON "processed_source_events" USING btree ("processed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_challenge_progress_tenant_id_idx" ON "user_challenge_progress" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_challenge_progress_user_challenge_period_unique_idx" ON "user_challenge_progress" USING btree ("user_id","challenge_id","period_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_challenge_progress_user_challenge_idx" ON "user_challenge_progress" USING btree ("user_id","challenge_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_challenge_progress_status_idx" ON "user_challenge_progress" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_progress_tenant_id_idx" ON "user_progress" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_progress_leaderboard_idx" ON "user_progress" USING btree ("tenant_id","lifetime_xp");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_progress_tenant_user_unique" ON "user_progress" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_progress_tenant_level_idx" ON "user_progress" USING btree ("tenant_id","current_level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "xp_transactions_tenant_id_idx" ON "xp_transactions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "xp_transactions_user_created_at_idx" ON "xp_transactions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "xp_transactions_source_idx" ON "xp_transactions" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "xp_transactions_type_idx" ON "xp_transactions" USING btree ("type");--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_tenant_unique_idx" UNIQUE("id","tenant_id");