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
	"key" text NOT NULL,
	"visibility" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"trigger_event_type" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"key" text NOT NULL,
	"visibility" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"trigger_event_type" text NOT NULL,
	"period_type" text NOT NULL,
	"target_count" integer NOT NULL,
	"xp_reward" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_achievement_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"achievement_level_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"earned_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "achievement_levels" ADD CONSTRAINT "achievement_levels_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "achievement_levels" ADD CONSTRAINT "achievement_levels_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE cascade ON UPDATE no action;
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
CREATE INDEX IF NOT EXISTS "achievement_levels_tenant_id_idx" ON "achievement_levels" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "achievement_levels_achievement_idx" ON "achievement_levels" USING btree ("achievement_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "achievements_tenant_id_idx" ON "achievements" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "achievements_tenant_key_unique_idx" ON "achievements" USING btree ("tenant_id","key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "achievements_trigger_event_idx" ON "achievements" USING btree ("trigger_event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "challenges_tenant_id_idx" ON "challenges" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "challenges_tenant_key_unique_idx" ON "challenges" USING btree ("tenant_id","key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "challenges_trigger_event_idx" ON "challenges" USING btree ("trigger_event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_achievement_levels_tenant_id_idx" ON "user_achievement_levels" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_achievement_levels_user_level_unique_idx" ON "user_achievement_levels" USING btree ("user_id","achievement_level_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_achievement_levels_user_idx" ON "user_achievement_levels" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_achievement_levels_level_idx" ON "user_achievement_levels" USING btree ("achievement_level_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_achievement_levels_source_idx" ON "user_achievement_levels" USING btree ("source_type","source_id");