CREATE TABLE IF NOT EXISTS "group_courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"group_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"enrolled_by" uuid,
	CONSTRAINT "group_courses_group_id_course_id_unique" UNIQUE("group_id","course_id")
);
--> statement-breakpoint
ALTER TABLE "student_courses" ADD COLUMN "enrolled_by_group_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_courses" ADD CONSTRAINT "group_courses_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_courses" ADD CONSTRAINT "group_courses_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_courses" ADD CONSTRAINT "group_courses_enrolled_by_users_id_fk" FOREIGN KEY ("enrolled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_courses" ADD CONSTRAINT "student_courses_enrolled_by_group_id_groups_id_fk" FOREIGN KEY ("enrolled_by_group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
