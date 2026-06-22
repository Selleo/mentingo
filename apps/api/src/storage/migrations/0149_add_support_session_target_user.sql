ALTER TABLE "support_sessions" ADD COLUMN "target_user_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_sessions" ADD CONSTRAINT "support_sessions_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_sessions_target_user_idx" ON "support_sessions" USING btree ("target_user_id");