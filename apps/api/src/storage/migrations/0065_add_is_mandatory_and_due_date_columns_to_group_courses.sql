ALTER TABLE "group_courses" ADD COLUMN "is_mandatory" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "group_courses" ADD COLUMN "due_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "group_courses" DROP COLUMN IF EXISTS "settings";