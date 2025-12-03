ALTER TABLE "chapters" ALTER COLUMN "title" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "chapters" ALTER COLUMN "title" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "courses" ALTER COLUMN "title" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "courses" ALTER COLUMN "title" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "courses" ALTER COLUMN "description" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "courses" ALTER COLUMN "description" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "courses" ALTER COLUMN "description" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ALTER COLUMN "title" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "lessons" ALTER COLUMN "title" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "lessons" ALTER COLUMN "description" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "question_answer_options" ALTER COLUMN "option_text" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "question_answer_options" ALTER COLUMN "option_text" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "question_answer_options" ALTER COLUMN "matched_word" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "title" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "title" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "description" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "solution_explanation" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "base_language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "available_locales" text[] DEFAULT ARRAY['en']::text[] NOT NULL;