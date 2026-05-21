ALTER TABLE "categories" ADD COLUMN "title_translations" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "base_language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "available_locales" text[] DEFAULT ARRAY['en']::text[] NOT NULL;