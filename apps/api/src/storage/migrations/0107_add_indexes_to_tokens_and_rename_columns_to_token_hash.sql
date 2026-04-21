ALTER TABLE "create_tokens" RENAME COLUMN "create_token" TO "token_hash";--> statement-breakpoint
ALTER TABLE "magic_link_tokens" RENAME COLUMN "token" TO "token_hash";--> statement-breakpoint
ALTER TABLE "reset_tokens" RENAME COLUMN "reset_token" TO "token_hash";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "create_tokens_token_hash_idx" ON "create_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magic_link_tokens_token_hash_idx" ON "magic_link_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reset_tokens_token_hash_idx" ON "reset_tokens" USING btree ("token_hash");