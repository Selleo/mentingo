-- Custom SQL migration file, put you code below! --
ALTER TABLE "student_lesson_progress" ADD COLUMN "is_started" boolean DEFAULT false;