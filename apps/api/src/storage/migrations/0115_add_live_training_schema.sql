CREATE TABLE IF NOT EXISTS "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"uid" text NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"base_language" text DEFAULT 'en' NOT NULL,
	"available_locales" text[] DEFAULT ARRAY['en']::text[] NOT NULL,
	"title" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"description" jsonb,
	"starts_at" timestamp(3) with time zone NOT NULL,
	"ends_at" timestamp(3) with time zone NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"timezone" text NOT NULL,
	"location" text,
	"organizer_user_id" uuid,
	"rrule" text,
	"exdates" jsonb,
	"deleted_at" timestamp(3) with time zone,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "live_lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"live_training_id" uuid NOT NULL,
	"live_training_link_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "live_training_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"live_training_session_participant_id" uuid NOT NULL,
	"live_training_session_id" uuid NOT NULL,
	"live_training_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp(3) with time zone NOT NULL,
	"left_at" timestamp(3) with time zone,
	"livekit_participant_sid" text,
	"disconnect_reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "live_training_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"live_training_id" uuid NOT NULL,
	"entity_type" text DEFAULT 'course' NOT NULL,
	"entity_id" uuid NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "live_training_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"live_training_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'trainer' NOT NULL,
	"display_order" integer,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "live_training_session_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"live_training_session_id" uuid NOT NULL,
	"live_training_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"first_joined_at" timestamp(3) with time zone,
	"last_left_at" timestamp(3) with time zone,
	"total_seconds" integer DEFAULT 0 NOT NULL,
	"join_count" integer DEFAULT 0 NOT NULL,
	"livekit_identity" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "live_training_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"live_training_id" uuid NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"started_at" timestamp(3) with time zone,
	"ended_at" timestamp(3) with time zone,
	"started_by_user_id" uuid,
	"ended_by_user_id" uuid,
	"end_reason" text,
	"livekit_room_name" text,
	"livekit_room_sid" text,
	"peak_participant_count" integer DEFAULT 0 NOT NULL,
	"unique_participant_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "live_trainings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"calendar_event_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"base_language" text DEFAULT 'en' NOT NULL,
	"available_locales" text[] DEFAULT ARRAY['en']::text[] NOT NULL,
	"delivery_type" text DEFAULT 'online' NOT NULL,
	"visibility_scope" text DEFAULT 'linked_courses' NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"max_participants" integer DEFAULT 100 NOT NULL,
	"settings" jsonb DEFAULT '{"viewerPermissions":{"microphoneEnabled":false,"cameraEnabled":false}}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp(3) with time zone,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	CONSTRAINT "live_trainings_calendar_event_id_unique" UNIQUE("calendar_event_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_organizer_user_id_users_id_fk" FOREIGN KEY ("organizer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_lessons" ADD CONSTRAINT "live_lessons_live_training_id_live_trainings_id_fk" FOREIGN KEY ("live_training_id") REFERENCES "public"."live_trainings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_lessons" ADD CONSTRAINT "live_lessons_live_training_link_id_live_training_links_id_fk" FOREIGN KEY ("live_training_link_id") REFERENCES "public"."live_training_links"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_lessons" ADD CONSTRAINT "live_lessons_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_lessons" ADD CONSTRAINT "live_lessons_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_training_attendance" ADD CONSTRAINT "live_training_attendance_live_training_session_participant_id_live_training_session_participants_id_fk" FOREIGN KEY ("live_training_session_participant_id") REFERENCES "public"."live_training_session_participants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_training_attendance" ADD CONSTRAINT "live_training_attendance_live_training_session_id_live_training_sessions_id_fk" FOREIGN KEY ("live_training_session_id") REFERENCES "public"."live_training_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_training_attendance" ADD CONSTRAINT "live_training_attendance_live_training_id_live_trainings_id_fk" FOREIGN KEY ("live_training_id") REFERENCES "public"."live_trainings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_training_attendance" ADD CONSTRAINT "live_training_attendance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_training_attendance" ADD CONSTRAINT "live_training_attendance_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_training_links" ADD CONSTRAINT "live_training_links_live_training_id_live_trainings_id_fk" FOREIGN KEY ("live_training_id") REFERENCES "public"."live_trainings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_training_links" ADD CONSTRAINT "live_training_links_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_training_members" ADD CONSTRAINT "live_training_members_live_training_id_live_trainings_id_fk" FOREIGN KEY ("live_training_id") REFERENCES "public"."live_trainings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_training_members" ADD CONSTRAINT "live_training_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_training_members" ADD CONSTRAINT "live_training_members_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_training_session_participants" ADD CONSTRAINT "live_training_session_participants_live_training_session_id_live_training_sessions_id_fk" FOREIGN KEY ("live_training_session_id") REFERENCES "public"."live_training_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_training_session_participants" ADD CONSTRAINT "live_training_session_participants_live_training_id_live_trainings_id_fk" FOREIGN KEY ("live_training_id") REFERENCES "public"."live_trainings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_training_session_participants" ADD CONSTRAINT "live_training_session_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_training_session_participants" ADD CONSTRAINT "live_training_session_participants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_training_sessions" ADD CONSTRAINT "live_training_sessions_live_training_id_live_trainings_id_fk" FOREIGN KEY ("live_training_id") REFERENCES "public"."live_trainings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_training_sessions" ADD CONSTRAINT "live_training_sessions_started_by_user_id_users_id_fk" FOREIGN KEY ("started_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_training_sessions" ADD CONSTRAINT "live_training_sessions_ended_by_user_id_users_id_fk" FOREIGN KEY ("ended_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_training_sessions" ADD CONSTRAINT "live_training_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_trainings" ADD CONSTRAINT "live_trainings_calendar_event_id_calendar_events_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_trainings" ADD CONSTRAINT "live_trainings_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_trainings" ADD CONSTRAINT "live_trainings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_events_tenant_id_idx" ON "calendar_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_events_tenant_starts_ends_idx" ON "calendar_events" USING btree ("tenant_id","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_events_tenant_uid_idx" ON "calendar_events" USING btree ("tenant_id","uid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_lessons_tenant_id_idx" ON "live_lessons" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "live_lessons_training_link_unique_idx" ON "live_lessons" USING btree ("live_training_link_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "live_lessons_lesson_unique_idx" ON "live_lessons" USING btree ("lesson_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "live_lessons_training_lesson_unique_idx" ON "live_lessons" USING btree ("live_training_id","lesson_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_lessons_training_idx" ON "live_lessons" USING btree ("tenant_id","live_training_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_training_attendance_tenant_id_idx" ON "live_training_attendance" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_training_attendance_session_user_idx" ON "live_training_attendance" USING btree ("tenant_id","live_training_session_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_training_attendance_training_user_idx" ON "live_training_attendance" USING btree ("tenant_id","live_training_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_training_attendance_joined_at_idx" ON "live_training_attendance" USING btree ("tenant_id","joined_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_training_links_tenant_id_idx" ON "live_training_links" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "live_training_links_training_entity_unique_idx" ON "live_training_links" USING btree ("live_training_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_training_links_training_idx" ON "live_training_links" USING btree ("tenant_id","live_training_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_training_links_entity_idx" ON "live_training_links" USING btree ("tenant_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_training_members_tenant_id_idx" ON "live_training_members" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "live_training_members_training_user_unique_idx" ON "live_training_members" USING btree ("live_training_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_training_members_training_idx" ON "live_training_members" USING btree ("tenant_id","live_training_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_training_members_user_idx" ON "live_training_members" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_training_members_role_idx" ON "live_training_members" USING btree ("tenant_id","role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_training_session_participants_tenant_id_idx" ON "live_training_session_participants" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "live_training_session_participants_session_user_unique_idx" ON "live_training_session_participants" USING btree ("live_training_session_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_training_session_participants_session_idx" ON "live_training_session_participants" USING btree ("tenant_id","live_training_session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_training_session_participants_training_user_idx" ON "live_training_session_participants" USING btree ("tenant_id","live_training_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_training_session_participants_user_idx" ON "live_training_session_participants" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_training_sessions_tenant_id_idx" ON "live_training_sessions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_training_sessions_training_idx" ON "live_training_sessions" USING btree ("tenant_id","live_training_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_training_sessions_status_idx" ON "live_training_sessions" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_training_sessions_livekit_room_name_idx" ON "live_training_sessions" USING btree ("tenant_id","livekit_room_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_trainings_tenant_id_idx" ON "live_trainings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_trainings_tenant_status_idx" ON "live_trainings" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_trainings_author_idx" ON "live_trainings" USING btree ("author_id");