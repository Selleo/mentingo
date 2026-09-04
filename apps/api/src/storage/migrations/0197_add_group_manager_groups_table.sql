CREATE TABLE IF NOT EXISTS "group_manager_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"manager_user_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "courses" ALTER COLUMN "settings" SET DEFAULT '{"lessonSequenceEnabled":false,"quizFeedbackEnabled":true,"certificateSignature":null,"certificateFontColor":"#000000","certificateValidity":null,"videoCompletionTrackingEnabled":true}'::jsonb;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_manager_groups" ADD CONSTRAINT "group_manager_groups_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_manager_groups" ADD CONSTRAINT "group_manager_groups_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_manager_groups" ADD CONSTRAINT "group_manager_groups_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "group_manager_groups_tenant_id_idx" ON "group_manager_groups" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "group_manager_groups_manager_user_id_group_id_unique" ON "group_manager_groups" USING btree ("manager_user_id","group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "group_manager_groups_group_id_idx" ON "group_manager_groups" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "group_users_group_id_user_id_idx" ON "group_users" USING btree ("group_id","user_id");