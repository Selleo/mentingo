-- Custom: drizzle-kit 0.22 does not generate CHECK constraints; definitions mirror gamification.schema.ts.
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_event_type_check" CHECK ("event_type" IN ('login', 'lesson_completed', 'course_completed', 'quiz_completed'));
--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_requirement_type_check" CHECK ("requirement_type" IN ('first_time', 'count', 'streak'));
--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_visibility_check" CHECK ("visibility" IN ('visible', 'hidden'));
--> statement-breakpoint
ALTER TABLE "achievement_levels" ADD CONSTRAINT "achievement_levels_level_check" CHECK ("level" >= 1);
--> statement-breakpoint
ALTER TABLE "achievement_levels" ADD CONSTRAINT "achievement_levels_threshold_check" CHECK ("threshold" >= 1);
--> statement-breakpoint
ALTER TABLE "achievement_levels" ADD CONSTRAINT "achievement_levels_xp_reward_check" CHECK ("xp_reward" >= 0);
--> statement-breakpoint
ALTER TABLE "user_achievement_progress" ADD CONSTRAINT "user_achievement_progress_value_check" CHECK ("value" >= 0);
--> statement-breakpoint
ALTER TABLE "xp_transactions" ADD CONSTRAINT "xp_transactions_lifetime_delta_check" CHECK ("lifetime_delta" >= 0);
--> statement-breakpoint
ALTER TABLE "user_gamification_profiles" ADD CONSTRAINT "user_gamification_profiles_xp_check" CHECK ("spendable_xp" >= 0 AND "spendable_xp" <= "lifetime_xp");
--> statement-breakpoint
ALTER TABLE "user_gamification_profiles" ADD CONSTRAINT "user_gamification_profiles_level_check" CHECK ("level" >= 1);
