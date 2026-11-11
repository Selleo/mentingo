-- Custom: drizzle-kit 0.22 does not generate CHECK constraints; definitions mirror quiz.schema.ts.
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_time_limit_minutes_check" CHECK ("time_limit_minutes" IS NULL OR "time_limit_minutes" >= 1);
--> statement-breakpoint
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_submitted_at_check" CHECK ("submission_status" <> 'submitted' OR "submitted_at" IS NOT NULL);
--> statement-breakpoint
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_in_progress_expires_check" CHECK ("submission_status" <> 'in_progress' OR "expires_at" IS NOT NULL);
