ALTER TABLE "ai_mentor_lessons" ALTER COLUMN "avatar_reference" SET DATA TYPE varchar(500);--> statement-breakpoint
ALTER TABLE "courses" ALTER COLUMN "thumbnail_s3_key" SET DATA TYPE varchar(500);--> statement-breakpoint
ALTER TABLE "lessons" ALTER COLUMN "file_s3_key" SET DATA TYPE varchar(500);--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "photo_s3_key" SET DATA TYPE varchar(500);--> statement-breakpoint
ALTER TABLE "resources" ALTER COLUMN "reference" SET DATA TYPE varchar(500);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "avatar_reference" SET DATA TYPE varchar(500);