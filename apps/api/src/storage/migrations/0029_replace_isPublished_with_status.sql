DO $$ BEGIN
 CREATE TYPE "public"."status" AS ENUM('draft', 'published', 'private');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "status" "status" DEFAULT 'draft'::"public"."status" NOT NULL;--> statement-breakpoint
UPDATE "courses" SET "status" = CASE WHEN "is_published" THEN 'published'::"public"."status" ELSE 'draft'::"public"."status" END;
ALTER TABLE "courses" DROP COLUMN IF EXISTS "is_published";
