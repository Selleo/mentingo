CREATE TABLE IF NOT EXISTS "student_course_takeaways" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"student_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_course_takeaways" ADD CONSTRAINT "student_course_takeaways_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_course_takeaways" ADD CONSTRAINT "student_course_takeaways_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_course_takeaways" ADD CONSTRAINT "student_course_takeaways_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "student_course_takeaways_unique_idx" ON "student_course_takeaways" USING btree ("tenant_id","student_id","course_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_course_takeaways_course_idx" ON "student_course_takeaways" USING btree ("tenant_id","course_id");--> statement-breakpoint

