CREATE TABLE IF NOT EXISTS "course_authoring_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"export_id" uuid NOT NULL,
	"export_hash" text NOT NULL,
	"receipt_delivered_at" timestamp(3) with time zone,
	"actor_id" uuid NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "course_authoring_context_bindings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"language" text NOT NULL,
	"cursor_sequence" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "course_authoring_context_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"binding_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"context_request_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"task_fence" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"fulfilled_at" timestamp(3) with time zone,
	"failure_code" text,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "course_authoring_staged_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"export_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"applied_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_authoring_applications" ADD CONSTRAINT "course_authoring_applications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_authoring_applications" ADD CONSTRAINT "course_authoring_applications_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_authoring_context_bindings" ADD CONSTRAINT "course_authoring_context_bindings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_authoring_context_bindings" ADD CONSTRAINT "course_authoring_context_bindings_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_authoring_context_requests" ADD CONSTRAINT "course_authoring_context_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_authoring_context_requests" ADD CONSTRAINT "course_authoring_context_requests_binding_id_course_authoring_context_bindings_id_fk" FOREIGN KEY ("binding_id") REFERENCES "public"."course_authoring_context_bindings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course_authoring_staged_assets" ADD CONSTRAINT "course_authoring_staged_assets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_authoring_applications_tenant_id_idx" ON "course_authoring_applications" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "course_authoring_applications_export_unique" ON "course_authoring_applications" USING btree ("tenant_id","export_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_authoring_applications_course_idx" ON "course_authoring_applications" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_authoring_context_bindings_tenant_id_idx" ON "course_authoring_context_bindings" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "course_authoring_context_bindings_session_unique" ON "course_authoring_context_bindings" USING btree ("tenant_id","session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_authoring_context_bindings_poll_idx" ON "course_authoring_context_bindings" USING btree ("tenant_id","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_authoring_context_bindings_course_idx" ON "course_authoring_context_bindings" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_authoring_context_requests_tenant_id_idx" ON "course_authoring_context_requests" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "course_authoring_context_requests_identity_unique" ON "course_authoring_context_requests" USING btree ("tenant_id","context_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "course_authoring_context_requests_sequence_unique" ON "course_authoring_context_requests" USING btree ("tenant_id","binding_id","sequence");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_authoring_context_requests_pending_idx" ON "course_authoring_context_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_authoring_staged_assets_tenant_id_idx" ON "course_authoring_staged_assets" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "course_authoring_staged_assets_key_unique" ON "course_authoring_staged_assets" USING btree ("tenant_id","storage_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "course_authoring_staged_assets_cleanup_idx" ON "course_authoring_staged_assets" USING btree ("tenant_id","applied_at","updated_at");