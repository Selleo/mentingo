CREATE TABLE IF NOT EXISTS "user_onboarding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"user_id" uuid NOT NULL,
	"dashboard" boolean DEFAULT false NOT NULL,
	"courses" boolean DEFAULT false NOT NULL,
	"announcements" boolean DEFAULT false NOT NULL,
	"profile" boolean DEFAULT false NOT NULL,
	"settings" boolean DEFAULT false NOT NULL,
	"provider_information" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_onboarding_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_onboarding" ADD CONSTRAINT "user_onboarding_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
