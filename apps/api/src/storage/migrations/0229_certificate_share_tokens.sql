ALTER TABLE "certificates" ADD COLUMN "share_token" uuid;--> statement-breakpoint
ALTER TABLE "learning_path_certificates" ADD COLUMN "share_token" uuid;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_share_token_unique" UNIQUE("share_token");--> statement-breakpoint
ALTER TABLE "learning_path_certificates" ADD CONSTRAINT "learning_path_certificates_share_token_unique" UNIQUE("share_token");