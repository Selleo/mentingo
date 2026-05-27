ALTER TABLE "announcements" ADD COLUMN "title_translations" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "content_translations" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "base_language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "available_locales" text[] DEFAULT ARRAY['en']::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "deleted_at" timestamp(3) with time zone;