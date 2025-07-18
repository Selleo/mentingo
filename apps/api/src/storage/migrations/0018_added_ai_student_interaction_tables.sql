CREATE TABLE IF NOT EXISTS "ai_mentor_lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"lesson_id" uuid NOT NULL,
	"ai_mentor_instructions" text NOT NULL,
	"completion_conditions" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_mentor_student_lesson_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"student_lesson_progress_id" uuid NOT NULL,
	"summary" text,
	"score" integer,
	"min_score" integer,
	"max_score" integer,
	"percentage" integer,
	"passed" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_mentor_thread_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"thread_id" uuid NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"token_count" integer DEFAULT 0 NOT NULL,
	"archived" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_mentor_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"user_id" uuid NOT NULL,
	"ai_mentor_lesson_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"user_language" varchar(20) DEFAULT 'en' NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_mentor_lessons" ADD CONSTRAINT "ai_mentor_lessons_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_mentor_student_lesson_progress" ADD CONSTRAINT "ai_mentor_student_lesson_progress_student_lesson_progress_id_student_lesson_progress_id_fk" FOREIGN KEY ("student_lesson_progress_id") REFERENCES "public"."student_lesson_progress"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_mentor_thread_messages" ADD CONSTRAINT "ai_mentor_thread_messages_thread_id_ai_mentor_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."ai_mentor_threads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_mentor_threads" ADD CONSTRAINT "ai_mentor_threads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_mentor_threads" ADD CONSTRAINT "ai_mentor_threads_ai_mentor_lesson_id_ai_mentor_lessons_id_fk" FOREIGN KEY ("ai_mentor_lesson_id") REFERENCES "public"."ai_mentor_lessons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
