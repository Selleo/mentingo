ALTER TABLE "scorm_metadata"
  DROP CONSTRAINT IF EXISTS "scorm_metadata_file_id_scorm_files_id_fk";
--> statement-breakpoint
ALTER TABLE "scorm_metadata"
  DROP CONSTRAINT IF EXISTS "scorm_metadata_course_id_courses_id_fk";
--> statement-breakpoint
ALTER TABLE "scorm_metadata"
  DROP CONSTRAINT IF EXISTS "scorm_metadata_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "scorm_files"
  DROP CONSTRAINT IF EXISTS "scorm_files_tenant_id_tenants_id_fk";
