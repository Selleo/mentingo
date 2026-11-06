ALTER TABLE "achievement_levels" ADD COLUMN "badge_image_key" text;--> statement-breakpoint
ALTER TABLE "achievements" ADD COLUMN "window_days" integer;--> statement-breakpoint
ALTER TABLE "achievements" ADD COLUMN "icon" text DEFAULT 'trophy' NOT NULL;