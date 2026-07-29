ALTER TABLE "student_chapter_progress" DROP CONSTRAINT "student_chapter_progress_chapter_id_chapters_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_chapter_progress" ADD CONSTRAINT "student_chapter_progress_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
