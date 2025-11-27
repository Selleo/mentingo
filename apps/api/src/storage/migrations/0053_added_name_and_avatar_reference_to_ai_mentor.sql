ALTER TABLE "ai_mentor_lessons" ADD COLUMN "name" text DEFAULT 'AI Mentor' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_mentor_lessons" ADD COLUMN "avatar_reference" varchar(200);