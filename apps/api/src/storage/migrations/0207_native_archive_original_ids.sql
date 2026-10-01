ALTER TABLE "courses" ADD COLUMN "original_id" uuid;--> statement-breakpoint
ALTER TABLE "learning_paths" ADD COLUMN "original_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "courses_tenant_original_id_unique_idx" ON "courses" USING btree ("tenant_id","original_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "learning_paths_tenant_original_id_unique_idx" ON "learning_paths" USING btree ("tenant_id","original_id");