ALTER TABLE "announcements" RENAME COLUMN "is_everyone" TO "audience";--> statement-breakpoint
ALTER TABLE "announcements" ALTER COLUMN "audience" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "announcements" ALTER COLUMN "audience" SET DEFAULT 'all_users';