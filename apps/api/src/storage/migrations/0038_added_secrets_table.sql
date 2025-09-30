CREATE TABLE IF NOT EXISTS "secrets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"secret_name" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"ciphertext" text NOT NULL,
	"iv" text NOT NULL,
	"tag" text NOT NULL,
	"encrypted_dek" text NOT NULL,
	"encrypted_dek_iv" text NOT NULL,
	"encrypted_dek_tag" text NOT NULL,
	"alg" text DEFAULT 'AES-256-GCM' NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "secrets_name_uq" ON "secrets" USING btree ("secret_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "secrets_name_idx" ON "secrets" USING btree ("secret_name");