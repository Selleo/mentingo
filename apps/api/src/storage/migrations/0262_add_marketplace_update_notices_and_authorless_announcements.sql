ALTER TABLE "announcements" ALTER COLUMN "author_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "content_marketplace_course_lineages" ADD COLUMN "notified_update_version_id" uuid;