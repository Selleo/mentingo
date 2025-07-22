CREATE TABLE IF NOT EXISTS "settings" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid () NOT NULL,
    "created_at" timestamp(3)
    with
        time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_at" timestamp(3)
    with
        time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "user_id" uuid,
        "settings" jsonb NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

INSERT INTO settings (user_id, settings)
SELECT NULL, '{}'::JSONB
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE user_id IS NULL);

INSERT INTO settings (user_id, settings)
SELECT u.id, 
       CASE 
           WHEN u.role = 'admin' THEN '{"language": "en","adminNewUserNotification": true}'::JSONB
           ELSE '{"language": "en"}'::JSONB
       END as settings
FROM users u
LEFT JOIN settings s ON u.id = s.user_id
WHERE s.user_id IS NULL;