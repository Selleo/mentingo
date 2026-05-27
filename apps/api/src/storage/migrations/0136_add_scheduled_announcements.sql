ALTER TABLE "announcements" ADD COLUMN "status" text DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "scheduled_at" timestamp(3) with time zone;--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "published_at" timestamp(3) with time zone;--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "send_email" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "email_template" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "source_type" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "source_id" uuid;