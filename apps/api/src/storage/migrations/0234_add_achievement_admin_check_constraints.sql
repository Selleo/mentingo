-- Custom: drizzle-kit 0.22 does not generate CHECK constraints; definitions mirror gamification.schema.ts.
ALTER TABLE "achievements" DROP CONSTRAINT "achievements_requirement_type_check";
--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_requirement_type_check" CHECK ("requirement_type" IN ('first_time', 'count', 'streak', 'time_window'));
--> statement-breakpoint
ALTER TABLE "achievement_levels" DROP CONSTRAINT "achievement_levels_level_check";
--> statement-breakpoint
ALTER TABLE "achievement_levels" ADD CONSTRAINT "achievement_levels_level_check" CHECK ("level" BETWEEN 1 AND 3);
--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_icon_check" CHECK ("icon" IN ('trophy', 'star', 'flame', 'zap', 'target', 'award', 'medal', 'crown', 'rocket', 'book_open', 'graduation_cap', 'log_in', 'door_open', 'calendar_check', 'clock', 'brain', 'lightbulb', 'puzzle', 'message_circle', 'heart', 'thumbs_up', 'sparkles', 'circle_check', 'gem', 'diamond', 'shield_check', 'badge_check', 'flag', 'mountain', 'footprints', 'gauge', 'timer', 'hourglass', 'alarm_clock', 'calendar_days', 'sunrise', 'sun', 'moon', 'coffee', 'book', 'library', 'notebook_pen', 'pencil', 'clipboard_check', 'list_checks', 'check_check', 'glasses', 'microscope', 'flask_conical', 'atom', 'calculator', 'languages', 'globe', 'compass', 'map', 'route', 'telescope', 'headphones', 'mic', 'palette', 'users', 'handshake', 'smile', 'party_popper', 'gift', 'sprout', 'leaf', 'infinity', 'repeat', 'trending_up', 'activity', 'dumbbell', 'gamepad_2', 'key', 'anchor', 'plane'));
--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_window_days_check" CHECK (("requirement_type" = 'time_window') = ("window_days" IS NOT NULL) AND ("window_days" IS NULL OR "window_days" BETWEEN 1 AND 365));
--> statement-breakpoint
ALTER TABLE "achievement_levels" DROP CONSTRAINT "achievement_levels_xp_reward_check";
--> statement-breakpoint
ALTER TABLE "achievement_levels" ADD CONSTRAINT "achievement_levels_xp_reward_check" CHECK ("xp_reward" BETWEEN 0 AND 100000);
