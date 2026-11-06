-- Custom tenant-isolation policies; table definitions are generated in create_gamification_core.
ALTER TABLE "achievements" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "achievements_tenant_isolation" ON "achievements" USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
ALTER TABLE "achievement_levels" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "achievement_levels_tenant_isolation" ON "achievement_levels" USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
ALTER TABLE "user_achievement_progress" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "user_achievement_progress_tenant_isolation" ON "user_achievement_progress" USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
ALTER TABLE "user_achievement_levels" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "user_achievement_levels_tenant_isolation" ON "user_achievement_levels" USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
ALTER TABLE "xp_transactions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "xp_transactions_tenant_isolation" ON "xp_transactions" USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
ALTER TABLE "user_gamification_profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "user_gamification_profiles_tenant_isolation" ON "user_gamification_profiles" USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid) WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
