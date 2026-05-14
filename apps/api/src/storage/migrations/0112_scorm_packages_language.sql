DROP INDEX IF EXISTS "scorm_packages_entity_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "scorm_packages_entity_unique_idx";--> statement-breakpoint
ALTER TABLE "scorm_packages" ADD COLUMN "language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scorm_packages_entity_idx" ON "scorm_packages" USING btree ("entity_type","entity_id","language");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "scorm_packages_entity_unique_idx" ON "scorm_packages" USING btree ("entity_type","entity_id","language");
