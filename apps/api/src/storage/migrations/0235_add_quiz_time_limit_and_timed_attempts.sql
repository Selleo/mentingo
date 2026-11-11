ALTER TABLE "assessment_attempts" ALTER COLUMN "submitted_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assessment_attempts" ADD COLUMN "expires_at" timestamp(3) with time zone;--> statement-breakpoint
ALTER TABLE "assessment_attempts" ADD COLUMN "draft_answers" jsonb;--> statement-breakpoint
ALTER TABLE "assessment_attempts" ADD COLUMN "draft_saved_at" timestamp(3) with time zone;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "time_limit_minutes" integer;