CREATE TABLE IF NOT EXISTS "achievement_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"achievement_id" uuid NOT NULL,
	"level" integer NOT NULL,
	"threshold" integer NOT NULL,
	"xp_reward" integer NOT NULL,
	CONSTRAINT "achievement_levels_achievement_level_unique" UNIQUE("achievement_id","level")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"key" text,
	"title" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"description" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"event_type" text NOT NULL,
	"requirement_type" text NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"visibility" text DEFAULT 'visible' NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"base_language" text DEFAULT 'en' NOT NULL,
	"available_locales" text[] DEFAULT ARRAY['en']::text[] NOT NULL,
	CONSTRAINT "achievements_tenant_key_unique" UNIQUE("tenant_id","key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_achievement_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"achievement_level_id" uuid NOT NULL,
	"source_event_id" uuid,
	CONSTRAINT "user_achievement_levels_user_level_unique" UNIQUE("user_id","achievement_level_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_achievement_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"achievement_id" uuid NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "user_achievement_progress_user_achievement_unique" UNIQUE("user_id","achievement_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_gamification_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"lifetime_xp" integer DEFAULT 0 NOT NULL,
	"spendable_xp" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "user_gamification_profiles_user_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "xp_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"lifetime_delta" integer NOT NULL,
	"spendable_delta" integer NOT NULL,
	CONSTRAINT "xp_transactions_type_source_unique" UNIQUE("type","source_id")
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
 ALTER TABLE "user_achievement_progress" ADD CONSTRAINT "user_achievement_progress_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_achievement_progress" ADD CONSTRAINT "user_achievement_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_achievement_progress" ADD CONSTRAINT "user_achievement_progress_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_gamification_profiles" ADD CONSTRAINT "user_gamification_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_gamification_profiles" ADD CONSTRAINT "user_gamification_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
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
CREATE INDEX IF NOT EXISTS "achievements_tenant_id_idx" ON "achievements" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_achievement_levels_tenant_id_idx" ON "user_achievement_levels" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_achievement_progress_tenant_id_idx" ON "user_achievement_progress" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_gamification_profiles_tenant_id_idx" ON "user_gamification_profiles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "xp_transactions_tenant_id_idx" ON "xp_transactions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outbox_events_gamification_user_idx" ON "outbox_events" USING btree ("tenant_id",(COALESCE(payload #>> '{loginData,userId}', payload #>> '{lessonCompletionData,userId}', payload #>> '{courseFinishedData,userId}', payload ->> 'userId')),"event_type") WHERE event_type IN ('UserLoginEvent', 'LessonCompletedEvent', 'UserCourseFinishedEvent', 'QuizCompletedEvent');