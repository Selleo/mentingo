CREATE TABLE IF NOT EXISTS "questions_and_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"title" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"description" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"base_language" text DEFAULT 'en' NOT NULL,
	"available_locales" text[] DEFAULT ARRAY['en']::text[] NOT NULL
);
