DO $$ BEGIN
 CREATE TYPE "public"."status" AS ENUM('draft', 'published', 'private');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "status" "status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
UPDATE "courses" SET "status" = CASE WHEN "is_published" THEN 'published' ELSE 'draft' END;
ALTER TABLE "courses" DROP COLUMN IF EXISTS "is_published";
