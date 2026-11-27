CREATE TABLE IF NOT EXISTS "directory_sync_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"provider" text NOT NULL,
	"status" text DEFAULT 'pending_verification' NOT NULL,
	"administrator_email" text NOT NULL,
	"directory_customer_id" text,
	"scope_type" text DEFAULT 'all_users' NOT NULL,
	"scope_external_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"default_role_id" uuid NOT NULL,
	"archive_users_outside_scope" boolean DEFAULT true NOT NULL,
	"archive_limit_percentage" integer,
	"send_welcome_email" boolean DEFAULT false NOT NULL,
	"created_by_user_id" uuid,
	"last_successful_sync_at" timestamp(3) with time zone,
	"missing_external_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "directory_sync_group_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"connection_id" uuid NOT NULL,
	"external_group_id" text NOT NULL,
	"external_group_email" text NOT NULL,
	"group_id" uuid NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "directory_sync_role_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"connection_id" uuid NOT NULL,
	"external_group_id" text NOT NULL,
	"external_group_email" text NOT NULL,
	"role_id" uuid NOT NULL,
	"priority" integer NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "directory_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"connection_id" uuid NOT NULL,
	"trigger" text NOT NULL,
	"triggered_by_user_id" uuid,
	"status" text DEFAULT 'queued' NOT NULL,
	"started_at" timestamp(3) with time zone,
	"finished_at" timestamp(3) with time zone,
	"created_users_count" integer DEFAULT 0 NOT NULL,
	"linked_users_count" integer DEFAULT 0 NOT NULL,
	"role_changed_users_count" integer DEFAULT 0 NOT NULL,
	"archived_users_count" integer DEFAULT 0 NOT NULL,
	"restored_users_count" integer DEFAULT 0 NOT NULL,
	"group_membership_changed_users_count" integer DEFAULT 0 NOT NULL,
	"skipped_users_count" integer DEFAULT 0 NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_external_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"user_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"archived_by_directory_sync" boolean DEFAULT false NOT NULL,
	"roles_overridden" boolean DEFAULT false NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "directory_sync_connections" ADD CONSTRAINT "directory_sync_connections_default_role_id_permission_roles_id_fk" FOREIGN KEY ("default_role_id") REFERENCES "public"."permission_roles"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "directory_sync_connections" ADD CONSTRAINT "directory_sync_connections_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "directory_sync_connections" ADD CONSTRAINT "directory_sync_connections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "directory_sync_group_mappings" ADD CONSTRAINT "directory_sync_group_mappings_connection_id_directory_sync_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."directory_sync_connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "directory_sync_group_mappings" ADD CONSTRAINT "directory_sync_group_mappings_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "directory_sync_group_mappings" ADD CONSTRAINT "directory_sync_group_mappings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "directory_sync_role_mappings" ADD CONSTRAINT "directory_sync_role_mappings_connection_id_directory_sync_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."directory_sync_connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "directory_sync_role_mappings" ADD CONSTRAINT "directory_sync_role_mappings_role_id_permission_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."permission_roles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "directory_sync_role_mappings" ADD CONSTRAINT "directory_sync_role_mappings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "directory_sync_runs" ADD CONSTRAINT "directory_sync_runs_connection_id_directory_sync_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."directory_sync_connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "directory_sync_runs" ADD CONSTRAINT "directory_sync_runs_triggered_by_user_id_users_id_fk" FOREIGN KEY ("triggered_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "directory_sync_runs" ADD CONSTRAINT "directory_sync_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_external_identities" ADD CONSTRAINT "user_external_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_external_identities" ADD CONSTRAINT "user_external_identities_connection_id_directory_sync_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."directory_sync_connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_external_identities" ADD CONSTRAINT "user_external_identities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "directory_sync_connections_tenant_id_idx" ON "directory_sync_connections" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "directory_sync_connections_tenant_provider_unique_idx" ON "directory_sync_connections" USING btree ("tenant_id","provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "directory_sync_group_mappings_tenant_id_idx" ON "directory_sync_group_mappings" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "directory_sync_group_mappings_connection_external_group_unique_idx" ON "directory_sync_group_mappings" USING btree ("connection_id","external_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "directory_sync_group_mappings_connection_group_unique_idx" ON "directory_sync_group_mappings" USING btree ("connection_id","group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "directory_sync_role_mappings_tenant_id_idx" ON "directory_sync_role_mappings" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "directory_sync_role_mappings_connection_group_unique_idx" ON "directory_sync_role_mappings" USING btree ("connection_id","external_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "directory_sync_role_mappings_connection_priority_unique_idx" ON "directory_sync_role_mappings" USING btree ("connection_id","priority");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "directory_sync_runs_tenant_id_idx" ON "directory_sync_runs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "directory_sync_runs_connection_created_at_idx" ON "directory_sync_runs" USING btree ("connection_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "directory_sync_runs_connection_unfinished_unique_idx" ON "directory_sync_runs" USING btree ("connection_id") WHERE "directory_sync_runs"."status" IN ('queued', 'running');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_external_identities_tenant_id_idx" ON "user_external_identities" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_external_identities_tenant_provider_external_id_unique_idx" ON "user_external_identities" USING btree ("tenant_id","provider","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_external_identities_tenant_user_provider_unique_idx" ON "user_external_identities" USING btree ("tenant_id","user_id","provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_external_identities_connection_idx" ON "user_external_identities" USING btree ("connection_id");