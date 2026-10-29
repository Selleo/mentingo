// Regenerate with drizzle-kit@0.31.9 (SDK-compatible tooling; Core uses 0.22):
// drizzle-kit generate --dialect=postgresql --schema=apps/api/src/storage/workflow-schema.ts --out=apps/api/src/storage/workflow-migrations --name=sdk_5_0_5_baseline
// Review the resulting schema and refresh WORKFLOW_BASELINE digests together.
// Never replay the SDK's historical public-schema enum migrations in Core.
export * from "@workflow/world-postgres/schema";

import { bigint, pgSchema, serial, text } from "drizzle-orm/pg-core";

// This is the SDK's configured Drizzle tracker (its CLI uses these exact columns).
export const migrationSchema = pgSchema("workflow_drizzle");
export const workflowMigrations = migrationSchema.table("workflow_migrations", {
  id: serial("id").primaryKey(),
  hash: text("hash").notNull(),
  createdAt: bigint("created_at", { mode: "number" }),
});
