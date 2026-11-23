CREATE TABLE IF NOT EXISTS "course_authoring_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"creation_command_id" uuid NOT NULL,
	"luma_session_id" uuid,
	"cursor_sequence" integer DEFAULT 0 NOT NULL,
	"last_polled_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"course_id" uuid,
	"last_activity_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"expired_at" timestamp(3) with time zone,
	"discarded_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "course_authoring_applications" ALTER COLUMN "course_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "course_authoring_applications" ADD COLUMN "draft_course_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_authoring_drafts" ADD CONSTRAINT "course_authoring_drafts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_authoring_drafts" ADD CONSTRAINT "course_authoring_drafts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_authoring_drafts" ADD CONSTRAINT "course_authoring_drafts_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_authoring_drafts_tenant_id_idx" ON "course_authoring_drafts" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "course_authoring_drafts_creation_unique" ON "course_authoring_drafts" USING btree ("tenant_id","owner_id","creation_command_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "course_authoring_drafts_luma_session_unique" ON "course_authoring_drafts" USING btree ("tenant_id","luma_session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_authoring_drafts_poll_idx" ON "course_authoring_drafts" USING btree ("tenant_id","last_polled_at") WHERE "course_authoring_drafts"."luma_session_id" is not null and "course_authoring_drafts"."course_id" is null and "course_authoring_drafts"."expired_at" is null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_authoring_drafts_expiration_idx" ON "course_authoring_drafts" USING btree ("tenant_id","last_activity_at") WHERE "course_authoring_drafts"."course_id" is null and "course_authoring_drafts"."discarded_at" is null;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_authoring_applications" ADD CONSTRAINT "course_authoring_applications_draft_course_id_course_authoring_drafts_id_fk" FOREIGN KEY ("draft_course_id") REFERENCES "public"."course_authoring_drafts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_authoring_applications_draft_idx" ON "course_authoring_applications" USING btree ("draft_course_id");