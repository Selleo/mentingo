import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { WORKFLOW_BASELINE } from "./workflow-baseline.constants";

import type {
  MigrationClient,
  MigrationPool,
  WorkflowMigrationRuntime,
} from "./database-migration.types";

const LOCK = [19283746, 50607080];
const quote = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;
class DatabaseSetupError extends Error {}

@Injectable()
export class DatabaseMigrationRepository {
  constructor(private readonly configService: ConfigService) {}

  async runMigrations() {
    let adminPool: MigrationPool | undefined;
    let appPool: MigrationPool | undefined;
    let lockClient: MigrationClient | undefined;
    let core: postgres.Sql | undefined;
    const probe = randomBytes(8);
    const identityLock = [probe.readInt32BE(0), probe.readInt32BE(4)];
    try {
      const sdkEntry = require.resolve("@workflow/world-postgres");
      const sdkRequire = createRequire(sdkEntry);
      const sdkRoot = join(dirname(sdkEntry), "..");
      const runtime: WorkflowMigrationRuntime = {
        Pool: sdkRequire("pg").Pool,
        drizzle: sdkRequire("drizzle-orm/node-postgres").drizzle,
        migrate: sdkRequire("drizzle-orm/node-postgres/migrator").migrate,
        makeWorkerUtils: sdkRequire("graphile-worker").makeWorkerUtils,
      };
      const sdkFolder = join(sdkRoot, "src/drizzle/migrations");
      const sdkMigrations = readMigrationFiles({ migrationsFolder: sdkFolder });
      const payload = createHash("sha256")
        .update(
          JSON.stringify(sdkMigrations.map(({ hash, folderMillis }) => ({ hash, folderMillis }))),
        )
        .digest("hex");
      const version: unknown = JSON.parse(
        readFileSync(join(sdkRoot, "package.json"), "utf8"),
      ).version;
      const baseline = readMigrationFiles({
        migrationsFolder: join(__dirname, "../workflow-migrations"),
      });
      if (
        version !== WORKFLOW_BASELINE.version ||
        payload !== WORKFLOW_BASELINE.payloadHash ||
        baseline.length !== 1 ||
        baseline[0].hash !== WORKFLOW_BASELINE.schemaHash
      )
        throw new DatabaseSetupError(
          "Workflow baseline does not match the installed SDK; regenerate and review before upgrading",
        );

      const adminUrl = this.configService.getOrThrow<string>("database.urlAdmin");
      const appUrl = this.configService.getOrThrow<string>("database.urlApp");
      adminPool = new runtime.Pool({ connectionString: adminUrl, max: 2 });
      appPool = new runtime.Pool({ connectionString: appUrl, max: 1 });
      // This reserved client holds the same database-scoped lock for CLI and startup.
      lockClient = await adminPool.connect();
      await lockClient.query("SELECT pg_advisory_lock($1, $2)", LOCK);
      await lockClient.query("SELECT pg_advisory_lock($1, $2)", identityLock);
      const identityClient = await appPool.connect();
      let appRole: string;
      try {
        const identity = await identityClient.query(
          "SELECT current_user AS role, pg_try_advisory_lock($1, $2) AS different_database",
          identityLock,
        );
        if (identity.rows[0].different_database) {
          await identityClient.query("SELECT pg_advisory_unlock($1, $2)", identityLock);
          throw new DatabaseSetupError(
            "Application and migrator connections must target the same PostgreSQL database",
          );
        }
        appRole = String(identity.rows[0].role);
      } finally {
        identityClient.release();
      }
      core = postgres(adminUrl, { max: 1, onnotice: () => undefined });
      await migrate(drizzle(core), { migrationsFolder: join(__dirname, "../migrations") });

      const state = await lockClient.query(
        "SELECT to_regclass('workflow_drizzle.workflow_migrations') AS tracker, EXISTS (SELECT 1 FROM pg_namespace WHERE nspname IN ('workflow', 'workflow_drizzle')) AS present",
      );
      if (state.rows[0].tracker) {
        const history = await lockClient.query(
          "SELECT hash, created_at FROM workflow_drizzle.workflow_migrations ORDER BY created_at ASC",
        );
        const latest = history.rows[history.rows.length - 1];
        if (
          history.rows.some(
            (row, index) => Number(row.created_at) !== sdkMigrations[index]?.folderMillis,
          ) ||
          !latest ||
          Number(latest.created_at) < WORKFLOW_BASELINE.minimumTrackedAt ||
          !sdkMigrations.some(
            (entry) =>
              entry.folderMillis === Number(latest.created_at) && entry.hash === latest.hash,
          )
        )
          throw new DatabaseSetupError(
            "Unrecognized or incomplete Workflow migration history; refusing to baseline existing objects",
          );
      } else {
        if (state.rows[0].present)
          throw new DatabaseSetupError(
            "Untracked Workflow schemas already exist; refusing to baseline existing objects",
          );
        await lockClient.query("BEGIN");
        try {
          for (const statement of baseline[0].sql) await lockClient.query(statement);
          // The generated latest schema and its exact upstream history commit together.
          for (const entry of sdkMigrations)
            await lockClient.query(
              "INSERT INTO workflow_drizzle.workflow_migrations (hash, created_at) VALUES ($1, $2)",
              [entry.hash, entry.folderMillis],
            );
          await lockClient.query("COMMIT");
        } catch (error) {
          await lockClient.query("ROLLBACK");
          throw error;
        }
      }
      await runtime.migrate(runtime.drizzle(adminPool), {
        migrationsFolder: sdkFolder,
        migrationsTable: "workflow_migrations",
        migrationsSchema: "workflow_drizzle",
      });
      const snapshot = JSON.parse(
        readFileSync(join(__dirname, "../workflow-migrations/meta/0000_snapshot.json"), "utf8"),
      ) as {
        tables: Record<string, { schema: string; name: string }>;
        enums: Record<string, { schema: string; name: string; values: string[] }>;
      };
      for (const table of Object.values(snapshot.tables)) {
        const found = await lockClient.query("SELECT to_regclass($1) AS name", [
          `${table.schema}.${table.name}`,
        ]);
        if (!found.rows[0].name)
          throw new DatabaseSetupError("Workflow schema is incomplete; refusing to start runtime");
      }
      for (const expected of Object.values(snapshot.enums)) {
        const found = await lockClient.query(
          "SELECT e.enumlabel FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid WHERE n.nspname=$1 AND t.typname=$2 ORDER BY e.enumsortorder",
          [expected.schema, expected.name],
        );
        if (
          JSON.stringify(found.rows.map((row) => row.enumlabel)) !== JSON.stringify(expected.values)
        )
          throw new DatabaseSetupError("Workflow enum schema does not match the installed SDK");
      }
      await this.configureRuntimeRole(lockClient, appRole);
      const workerUtils = await runtime.makeWorkerUtils({ pgPool: appPool });
      try {
        await workerUtils.migrate();
      } finally {
        await workerUtils.release();
      }
    } catch (error) {
      if (error instanceof DatabaseSetupError) throw error;
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      throw new Error(
        `Database migrations failed${/^[A-Z0-9]{5}$/.test(code) ? ` (${code})` : ""}`,
      );
    } finally {
      if (lockClient) {
        await lockClient
          .query("SELECT pg_advisory_unlock($1, $2)", identityLock)
          .catch(() => undefined);
        await lockClient.query("SELECT pg_advisory_unlock($1, $2)", LOCK).catch(() => undefined);
        lockClient.release();
      }
      await Promise.all([core?.end(), appPool?.end(), adminPool?.end()]);
    }
  }

  private async configureRuntimeRole(client: MigrationClient, role: string) {
    const owner = quote(role);
    await client.query(`GRANT USAGE ON SCHEMA workflow, workflow_drizzle TO ${owner}`);
    await client.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA workflow, workflow_drizzle TO ${owner}`,
    );
    await client.query(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA workflow, workflow_drizzle TO ${owner}`,
    );
    await client.query(`CREATE SCHEMA IF NOT EXISTS graphile_worker AUTHORIZATION ${owner}`);
    await client.query(`ALTER SCHEMA graphile_worker OWNER TO ${owner}`);
    // Graphile's private tables have RLS without policies: runtime ownership is required.
    // Existing SDK installations may have been created by the migrator role.
    const relations = await client.query(
      "SELECT c.relname, c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'graphile_worker' AND c.relkind IN ('r','p','S','v','m') AND pg_get_userbyid(c.relowner) <> $1 ORDER BY CASE WHEN c.relkind = 'S' THEN 1 ELSE 0 END",
      [role],
    );
    for (const row of relations.rows) {
      let kind = "TABLE";
      if (row.relkind === "S") kind = "SEQUENCE";
      if (row.relkind === "v") kind = "VIEW";
      if (row.relkind === "m") kind = "MATERIALIZED VIEW";
      await client.query(
        `ALTER ${kind} graphile_worker.${quote(String(row.relname))} OWNER TO ${owner}`,
      );
    }
    const functions = await client.query(
      "SELECT p.proname, p.prokind, pg_get_function_identity_arguments(p.oid) AS arguments FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'graphile_worker' AND p.prokind IN ('f','p') AND pg_get_userbyid(p.proowner) <> $1",
      [role],
    );
    for (const row of functions.rows)
      await client.query(
        `ALTER ${row.prokind === "p" ? "PROCEDURE" : "FUNCTION"} graphile_worker.${quote(
          String(row.proname),
        )}(${row.arguments}) OWNER TO ${owner}`,
      );
    const types = await client.query(
      "SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace LEFT JOIN pg_class c ON c.oid = t.typrelid WHERE n.nspname = 'graphile_worker' AND (t.typtype IN ('e','d') OR (t.typtype = 'c' AND c.relkind = 'c')) AND pg_get_userbyid(t.typowner) <> $1",
      [role],
    );
    for (const row of types.rows)
      await client.query(
        `ALTER TYPE graphile_worker.${quote(String(row.typname))} OWNER TO ${owner}`,
      );
  }
}
