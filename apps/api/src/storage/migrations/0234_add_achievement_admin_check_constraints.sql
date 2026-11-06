-- Custom: drizzle-kit 0.22 does not generate CHECK constraints; definitions mirror gamification.schema.ts.
ALTER TABLE "achievements" DROP CONSTRAINT "achievements_requirement_type_check";
--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_requirement_type_check" CHECK ("requirement_type" IN ('first_time', 'count', 'streak', 'time_window'));
--> statement-breakpoint
ALTER TABLE "achievement_levels" DROP CONSTRAINT "achievement_levels_level_check";
--> statement-breakpoint
ALTER TABLE "achievement_levels" ADD CONSTRAINT "achievement_levels_level_check" CHECK ("level" BETWEEN 1 AND 3);
--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_icon_check" CHECK ("icon" IN ('trophy', 'star', 'flame', 'zap', 'target', 'award', 'medal', 'crown', 'rocket', 'book_open', 'graduation_cap', 'log_in', 'calendar_check', 'clock', 'brain', 'lightbulb', 'puzzle', 'message_circle', 'heart', 'thumbs_up', 'sparkles', 'circle_check'));
--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_window_days_check" CHECK (("requirement_type" = 'time_window') = ("window_days" IS NOT NULL) AND ("window_days" IS NULL OR "window_days" BETWEEN 1 AND 365));
--> statement-breakpoint
ALTER TABLE "achievement_levels" DROP CONSTRAINT "achievement_levels_xp_reward_check";
--> statement-breakpoint
ALTER TABLE "achievement_levels" ADD CONSTRAINT "achievement_levels_xp_reward_check" CHECK ("xp_reward" BETWEEN 0 AND 100000);
