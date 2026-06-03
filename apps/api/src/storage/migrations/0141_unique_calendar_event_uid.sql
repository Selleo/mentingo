DROP INDEX IF EXISTS "calendar_events_tenant_uid_idx";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "calendar_events_uid_unique_idx" ON "calendar_events" USING btree ("uid");