ALTER TYPE "activity_log_action_type" ADD VALUE 'expire_certificate';--> statement-breakpoint
ALTER TYPE "activity_log_action_type" ADD VALUE 'reset_certificate';--> statement-breakpoint
ALTER TABLE "certificates" DROP CONSTRAINT "certificates_user_id_course_id_unique";--> statement-breakpoint
ALTER TABLE "courses" ALTER COLUMN "settings" SET DEFAULT '{"lessonSequenceEnabled":false,"quizFeedbackEnabled":true,"certificateSignature":null,"certificateFontColor":null,"certificateValidity":null}'::jsonb;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "issued_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "expires_at" timestamp(3) with time zone;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "archived_at" timestamp(3) with time zone;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "archive_reason" text;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "expiration_warning_sent_at" timestamp(3) with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "certificates_active_expiry_idx" ON "certificates" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "certificates_user_course_idx" ON "certificates" USING btree ("user_id","course_id");
