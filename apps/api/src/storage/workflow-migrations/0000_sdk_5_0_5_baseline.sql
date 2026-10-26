CREATE SCHEMA "workflow_drizzle";
--> statement-breakpoint
CREATE SCHEMA "workflow";
--> statement-breakpoint
CREATE TYPE "workflow"."step_status" AS ENUM('pending', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "workflow"."wait_status" AS ENUM('waiting', 'completed');--> statement-breakpoint
CREATE TYPE "workflow"."status" AS ENUM('pending', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "workflow_drizzle"."workflow_migrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"hash" text NOT NULL,
	"created_at" bigint
);
--> statement-breakpoint
CREATE TABLE "workflow"."workflow_event_slots" (
	"run_id" varchar PRIMARY KEY NOT NULL,
	"seq_in_band" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow"."workflow_events" (
	"id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"correlation_id" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"run_id" varchar NOT NULL,
	"payload" jsonb,
	"payload_cbor" "bytea",
	"spec_version" integer,
	"resume_id" varchar,
	"resume_payload_digest" varchar,
	CONSTRAINT "workflow_events_run_id_id_pk" PRIMARY KEY("run_id","id")
);
--> statement-breakpoint
CREATE TABLE "workflow"."workflow_hooks" (
	"run_id" varchar NOT NULL,
	"hook_id" varchar PRIMARY KEY NOT NULL,
	"token" varchar NOT NULL,
	"owner_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"environment" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"token_retention_until" timestamp with time zone,
	"metadata" jsonb,
	"metadata_cbor" "bytea",
	"spec_version" integer,
	"is_webhook" boolean DEFAULT true,
	"is_system" boolean DEFAULT false,
	"resume_context" "bytea",
	"claimed_from" "bytea"
);
--> statement-breakpoint
CREATE TABLE "workflow"."workflow_invocations" (
	"sequence" bigserial NOT NULL,
	"run_id" varchar NOT NULL,
	"request_id" varchar NOT NULL,
	"payload" "bytea",
	"fingerprint" varchar,
	"result" "bytea",
	"result_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	CONSTRAINT "workflow_invocations_run_id_request_id_pk" PRIMARY KEY("run_id","request_id")
);
--> statement-breakpoint
CREATE TABLE "workflow"."workflow_runs" (
	"id" varchar PRIMARY KEY NOT NULL,
	"output" jsonb,
	"output_cbor" "bytea",
	"deployment_id" varchar NOT NULL,
	"status" "workflow"."status" NOT NULL,
	"name" varchar NOT NULL,
	"spec_version" integer,
	"execution_context" jsonb,
	"execution_context_cbor" "bytea",
	"input" jsonb,
	"input_cbor" "bytea",
	"error" text,
	"error_cbor" "bytea",
	"error_code" varchar,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"encryption_public_key" varchar,
	"dynamic_workflow_code_cbor" "bytea",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"expired_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workflow"."workflow_snapshots" (
	"run_id" varchar PRIMARY KEY NOT NULL,
	"data" "bytea" NOT NULL,
	"events_cursor" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow"."workflow_steps" (
	"run_id" varchar NOT NULL,
	"step_id" varchar PRIMARY KEY NOT NULL,
	"step_name" varchar NOT NULL,
	"status" "workflow"."step_status" NOT NULL,
	"input" jsonb,
	"input_cbor" "bytea",
	"output" jsonb,
	"output_cbor" "bytea",
	"error" text,
	"error_cbor" "bytea",
	"attempt" integer NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retry_after" timestamp with time zone,
	"spec_version" integer
);
--> statement-breakpoint
CREATE TABLE "workflow"."workflow_stream_chunks" (
	"id" varchar NOT NULL,
	"stream_id" varchar NOT NULL,
	"run_id" varchar,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"eof" boolean NOT NULL,
	CONSTRAINT "workflow_stream_chunks_stream_id_id_pk" PRIMARY KEY("stream_id","id")
);
--> statement-breakpoint
CREATE TABLE "workflow"."workflow_waits" (
	"wait_id" varchar PRIMARY KEY NOT NULL,
	"run_id" varchar NOT NULL,
	"status" "workflow"."wait_status" NOT NULL,
	"resume_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"spec_version" integer
);
--> statement-breakpoint
CREATE INDEX "workflow_events_correlation_id_index" ON "workflow"."workflow_events" USING btree ("correlation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_events_hook_resume_unique" ON "workflow"."workflow_events" USING btree ("run_id","resume_id") WHERE "workflow"."workflow_events"."type" = 'hook_received' AND "workflow"."workflow_events"."resume_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_events_entity_creation_unique" ON "workflow"."workflow_events" USING btree ("run_id","correlation_id","type") WHERE "workflow"."workflow_events"."type" IN ('step_created', 'hook_created', 'wait_created', 'attr_set');--> statement-breakpoint
CREATE INDEX "workflow_hooks_run_id_index" ON "workflow"."workflow_hooks" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "workflow_hooks_token_index" ON "workflow"."workflow_hooks" USING btree ("token");--> statement-breakpoint
CREATE INDEX "workflow_invocations_pending" ON "workflow"."workflow_invocations" USING btree ("run_id","sequence") WHERE "workflow"."workflow_invocations"."responded_at" IS NULL;--> statement-breakpoint
CREATE INDEX "workflow_runs_name_index" ON "workflow"."workflow_runs" USING btree ("name");--> statement-breakpoint
CREATE INDEX "workflow_runs_status_index" ON "workflow"."workflow_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workflow_steps_run_id_index" ON "workflow"."workflow_steps" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "workflow_steps_status_index" ON "workflow"."workflow_steps" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workflow_stream_chunks_run_id_index" ON "workflow"."workflow_stream_chunks" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "workflow_waits_run_id_index" ON "workflow"."workflow_waits" USING btree ("run_id");