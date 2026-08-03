CREATE TABLE IF NOT EXISTS "achievement_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"achievement_id" uuid NOT NULL,
	"level_number" integer NOT NULL,
	"threshold" integer NOT NULL,
	"xp_reward" integer NOT NULL,
	CONSTRAINT "achievement_levels_level_unique" UNIQUE("achievement_id","level_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"title" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"visibility" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"trigger_event_type" text NOT NULL,
	"base_language" text DEFAULT 'en' NOT NULL,
	"available_locales" text[] DEFAULT ARRAY['en']::text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"title" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"visibility" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"trigger_event_type" text NOT NULL,
	"period_type" text NOT NULL,
	"target_count" integer NOT NULL,
	"xp_reward" integer NOT NULL,
	"base_language" text DEFAULT 'en' NOT NULL,
	"available_locales" text[] DEFAULT ARRAY['en']::text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "processed_source_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"processed_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_achievement_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"achievement_level_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"earned_at" timestamp(3) with time zone DEFAULT now() NOT NULL
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
	"lifetime_delta" integer NOT NULL,
	"spendable_delta" integer NOT NULL,
	"type" text NOT NULL,
	"source_id" uuid NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "achievement_levels" ADD CONSTRAINT "achievement_levels_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "achievements" ADD CONSTRAINT "achievements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "challenges" ADD CONSTRAINT "challenges_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "processed_source_events" ADD CONSTRAINT "processed_source_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_achievement_levels" ADD CONSTRAINT "user_achievement_levels_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_achievement_levels" ADD CONSTRAINT "user_achievement_levels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_achievement_levels" ADD CONSTRAINT "user_achievement_levels_achievement_level_id_achievement_levels_id_fk" FOREIGN KEY ("achievement_level_id") REFERENCES "public"."achievement_levels"("id") ON DELETE cascade ON UPDATE no action;
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
 ALTER TABLE "user_challenge_progress" ADD CONSTRAINT "user_challenge_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
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
CREATE INDEX IF NOT EXISTS "achievement_levels_tenant_id_idx" ON "achievement_levels" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "achievement_levels_achievement_idx" ON "achievement_levels" USING btree ("achievement_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "achievements_tenant_id_idx" ON "achievements" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "achievements_tenant_id_unique_idx" ON "achievements" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "achievements_trigger_event_idx" ON "achievements" USING btree ("trigger_event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "challenges_tenant_id_idx" ON "challenges" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "challenges_tenant_id_unique_idx" ON "challenges" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "challenges_trigger_event_idx" ON "challenges" USING btree ("trigger_event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "processed_source_events_tenant_id_idx" ON "processed_source_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "processed_source_events_source_unique" ON "processed_source_events" USING btree ("tenant_id","source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "processed_source_events_processed_at_idx" ON "processed_source_events" USING btree ("processed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_achievement_levels_tenant_id_idx" ON "user_achievement_levels" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_achievement_levels_user_level_unique_idx" ON "user_achievement_levels" USING btree ("user_id","achievement_level_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_achievement_levels_user_idx" ON "user_achievement_levels" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_achievement_levels_level_idx" ON "user_achievement_levels" USING btree ("achievement_level_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_achievement_levels_source_idx" ON "user_achievement_levels" USING btree ("source_id");--> statement-breakpoint
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
CREATE INDEX IF NOT EXISTS "xp_transactions_source_idx" ON "xp_transactions" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "xp_transactions_type_idx" ON "xp_transactions" USING btree ("type");