ALTER TABLE "groups" ADD COLUMN "name_translations" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "characteristic_translations" jsonb;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "base_language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "available_locales" text[] DEFAULT ARRAY['en']::text[] NOT NULL;