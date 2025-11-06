ALTER TABLE "chapters" ALTER COLUMN "title" SET DATA TYPE varchar(250);--> statement-breakpoint
ALTER TABLE "courses" ALTER COLUMN "title" SET DATA TYPE varchar(250);--> statement-breakpoint
ALTER TABLE "courses" ALTER COLUMN "description" SET DATA TYPE varchar(20000);--> statement-breakpoint
ALTER TABLE "lessons" ALTER COLUMN "title" SET DATA TYPE varchar(250);--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "title" SET DATA TYPE varchar(250);