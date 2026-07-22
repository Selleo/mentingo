ALTER TABLE "automation_steps" ALTER COLUMN "type_context" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "automation_steps" ALTER COLUMN "type_context" SET NOT NULL;