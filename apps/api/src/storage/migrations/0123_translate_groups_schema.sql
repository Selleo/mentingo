ALTER TABLE "groups" ALTER COLUMN "name" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "name" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "characteristic" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "base_language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "available_locales" text[] DEFAULT ARRAY['en']::text[] NOT NULL;