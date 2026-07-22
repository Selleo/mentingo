ALTER TABLE "courses" ADD COLUMN "thumbnail_position_y" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "show_author_section" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "learning_outcomes" jsonb DEFAULT '{}'::jsonb NOT NULL;