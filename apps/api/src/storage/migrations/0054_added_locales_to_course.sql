ALTER TABLE "courses" ADD COLUMN "base_language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "available_locales" text[] DEFAULT ARRAY['en']::text[] NOT NULL;