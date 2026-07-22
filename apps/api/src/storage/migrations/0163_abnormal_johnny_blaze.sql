ALTER TABLE "achievements" DROP CONSTRAINT "achievements_tenant_unique_idx";--> statement-breakpoint
ALTER TABLE "achievement_levels" DROP CONSTRAINT "achievement_levels_achievement_id_achievements_id_fk";
--> statement-breakpoint
ALTER TABLE "user_challenge_progress" DROP CONSTRAINT "user_challenge_progress_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "achievements_tenant_key_unique_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "challenges_tenant_key_unique_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "processed_source_events_source_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "user_achievement_levels_source_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "xp_transactions_source_idx";--> statement-breakpoint
ALTER TABLE "achievements"
ALTER COLUMN "key" SET DATA TYPE jsonb
USING jsonb_build_object('en', key);--> statement-breakpoint
ALTER TABLE "achievements" ALTER COLUMN "key" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "challenges"
ALTER COLUMN "key" SET DATA TYPE jsonb
USING jsonb_build_object('en', key);--> statement-breakpoint
ALTER TABLE "challenges" ALTER COLUMN "key" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "achievements" ADD COLUMN "base_language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "achievements" ADD COLUMN "available_locales" text[] DEFAULT ARRAY['en']::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "base_language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "available_locales" text[] DEFAULT ARRAY['en']::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "xp_transactions" ADD COLUMN "lifetime_delta" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "xp_transactions" ADD COLUMN "spendable_delta" integer NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_challenge_progress" ADD CONSTRAINT "user_challenge_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "achievements_tenant_id_unique_idx" ON "achievements" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "challenges_tenant_id_unique_idx" ON "challenges" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "processed_source_events_source_unique" ON "processed_source_events" USING btree ("tenant_id","source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_achievement_levels_source_idx" ON "user_achievement_levels" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "xp_transactions_source_idx" ON "xp_transactions" USING btree ("source_id");--> statement-breakpoint
ALTER TABLE "processed_source_events" DROP COLUMN IF EXISTS "source_type";--> statement-breakpoint
ALTER TABLE "user_achievement_levels" DROP COLUMN IF EXISTS "source_type";--> statement-breakpoint
ALTER TABLE "xp_transactions" DROP COLUMN IF EXISTS "amount";--> statement-breakpoint
ALTER TABLE "xp_transactions" DROP COLUMN IF EXISTS "affects_lifetime";--> statement-breakpoint
ALTER TABLE "xp_transactions" DROP COLUMN IF EXISTS "source_type";