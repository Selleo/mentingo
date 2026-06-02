ALTER TABLE "group_courses" ADD COLUMN "calendar_event_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_courses" ADD CONSTRAINT "group_courses_calendar_event_id_calendar_events_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "group_courses" ADD CONSTRAINT "group_courses_calendar_event_id_unique" UNIQUE("calendar_event_id");