import "dotenv/config";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const url = process.env.WORKFLOW_POSTGRES_URL;
if (!url)
  throw new Error("WORKFLOW_POSTGRES_URL must point to a dedicated assistant Workflow database");
const require = createRequire(import.meta.url);
const worldEntry = require.resolve("@workflow/world-postgres");
const { Pool } = createRequire(worldEntry)("pg");
const pool = new Pool({ connectionString: url, max: 1 });
try {
  const { rows } = await pool.query(`
    SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users', 'tenants')) AS application_tables,
      EXISTS(SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname IN ('status', 'step_status')) AS runtime_enums,
      EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='workflow_drizzle' AND table_name='workflow_migrations') AS bootstrapped
  `);
  if (rows[0].application_tables || (rows[0].runtime_enums && !rows[0].bootstrapped)) {
    throw new Error(
      "Workflow bootstrap refused: use a dedicated empty Workflow database; its upstream migrations own public enum types",
    );
  }
} finally {
  await pool.end();
}
const bootstrapPath = resolve(dirname(worldEntry), "../bin/setup.js");
const result = spawnSync(process.execPath, [bootstrapPath], { stdio: "inherit", env: process.env });
process.exitCode = result.status ?? 1;
