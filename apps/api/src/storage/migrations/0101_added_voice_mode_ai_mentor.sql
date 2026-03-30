ALTER TABLE "ai_mentor_lessons" ADD COLUMN "voice_mode" text DEFAULT 'preset' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_mentor_lessons" ADD COLUMN "tts_preset" text DEFAULT 'male' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_mentor_lessons" ADD COLUMN "custom_tts_reference" jsonb;