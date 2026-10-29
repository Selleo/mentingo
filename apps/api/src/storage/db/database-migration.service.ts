import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { makeWorkerUtils } from "graphile-worker";
import postgres from "postgres";

import { DATABASE_MIGRATION_LOCK } from "./db.constants";
import { WORKFLOW_BASELINE } from "./workflow-baseline.constants";
import { grantWorkflowRuntimeRole } from "./workflow-runtime-role";

@Injectable()
export class DatabaseMigrationService {
  private readonly logger = new Logger(DatabaseMigrationService.name);

  constructor(private readonly configService: ConfigService) {}

  async runMigrations() {
    const coreOnly = process.env.E2E === "true";
    this.logger.log(
      coreOnly
        ? "Running Core database migrations"
        : "Running Core and Workflow database migrations",
    );
    let admin: postgres.Sql | undefined;
    let closing = false;
    let connectionLost = false;
    try {
      const source = coreOnly ? undefined : this.readWorkflowSource();
      // Dedicated, nonrotating connection: Drizzle can use begin() while session locks
      // remain held. A lost connection terminates this client instead of reconnecting unlocked.
      admin = postgres(this.configService.getOrThrow<string>("database.urlAdmin"), {
        max: 1,
        idle_timeout: 0,
        max_lifetime: 0,
        onnotice: () => undefined,
        onclose: () => {
          if (!closing) {
            connectionLost = true;
            void admin?.end({ timeout: 0 });
          }
        },
      });
      await admin`SELECT pg_advisory_lock(${DATABASE_MIGRATION_LOCK[0]}, ${DATABASE_MIGRATION_LOCK[1]})`;
      if (!source) {
        await migrate(drizzle(admin), { migrationsFolder: join(__dirname, "../migrations") });
        this.logger.log("Core migrations completed; Workflow setup skipped for E2E");
        return;
      }
      await migrate(drizzle(admin), { migrationsFolder: join(__dirname, "../migrations") });
      await this.ensureWorkflow(admin, source);
      // Fresh Graphile installation requires database CREATE privileges. Use the migrator,
      // then transfer only its runtime objects to the restricted application role.
      const workerUtils = await makeWorkerUtils({
        connectionString: this.configService.getOrThrow<string>("database.urlAdmin"),
      });
      await workerUtils.release();
      const appUrl = this.configService.get<string>("database.urlApp");
      if (appUrl) {
        const parsed = new URL(appUrl);
        const role = parsed.searchParams.get("user") || decodeURIComponent(parsed.username);
        if (!role) throw new Error("Application database URL must specify its runtime role");
        const [account] = await admin`SELECT rolname FROM pg_roles WHERE rolname = ${role}`;
        if (account) {
          await grantWorkflowRuntimeRole(drizzle(admin), role);
        } else {
          this.logger.warn(
            "Workflow runtime grants skipped: application role does not exist yet; seed role setup or rerun migrations after provisioning it",
          );
        }
      }
      if (connectionLost) throw new Error("Migration lock connection was lost");
      this.logger.log("Database migrations completed");
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      const message = `Database migrations failed; check migration permissions and pinned Workflow baseline${
        /^[A-Z0-9]{5}$/.test(code) ? ` (${code})` : ""
      }`;
      this.logger.error(message);
      throw new Error(message);
    } finally {
      closing = true;
      // Closing the dedicated connection releases its advisory locks on every exit path.
      await admin?.end();
    }
  }

  private readWorkflowSource() {
    const sdkRoot = join(dirname(require.resolve("@workflow/world-postgres")), "..");
    const migrations = readMigrationFiles({
      migrationsFolder: join(sdkRoot, "src/drizzle/migrations"),
    });
    const payload = createHash("sha256")
      .update(JSON.stringify(migrations.map(({ hash, folderMillis }) => ({ hash, folderMillis }))))
      .digest("hex");
    const baseline = readMigrationFiles({
      migrationsFolder: join(__dirname, "../workflow-migrations"),
    });
    if (
      JSON.parse(readFileSync(join(sdkRoot, "package.json"), "utf8")).version !==
        WORKFLOW_BASELINE.version ||
      payload !== WORKFLOW_BASELINE.payloadHash ||
      baseline.length !== 1 ||
      baseline[0].hash !== WORKFLOW_BASELINE.schemaHash
    )
      throw new Error("Workflow source differs from the reviewed baseline");
    return {
      migrations,
      baseline: baseline[0],
      sdkFolder: join(sdkRoot, "src/drizzle/migrations"),
    };
  }

  private async ensureWorkflow(
    sql: postgres.Sql,
    source: ReturnType<DatabaseMigrationService["readWorkflowSource"]>,
  ) {
    const [state] =
      await sql`SELECT to_regclass('workflow_drizzle.workflow_migrations') AS tracker, EXISTS (SELECT 1 FROM pg_namespace WHERE nspname IN ('workflow', 'workflow_drizzle')) AS present`;
    if (state.tracker) {
      const history =
        await sql`SELECT hash, created_at FROM workflow_drizzle.workflow_migrations ORDER BY created_at`;
      const latest = history[history.length - 1];
      // Only recognize a journal prefix at or beyond the reviewed baseline.
      if (
        history.some(
          (row, index) => Number(row.created_at) !== source.migrations[index]?.folderMillis,
        ) ||
        !latest ||
        Number(latest.created_at) < WORKFLOW_BASELINE.minimumTrackedAt ||
        !source.migrations.some(
          (entry) => entry.folderMillis === Number(latest.created_at) && entry.hash === latest.hash,
        )
      )
        throw new Error("Unrecognized or incomplete Workflow history");
    } else {
      if (state.present) throw new Error("Refusing to baseline untracked Workflow objects");
      await sql.begin(async (tx) => {
        for (const statement of source.baseline.sql) await tx.unsafe(statement);
        for (const entry of source.migrations)
          await tx`INSERT INTO workflow_drizzle.workflow_migrations (hash, created_at) VALUES (${entry.hash}, ${entry.folderMillis})`;
      });
    }
    await migrate(drizzle(sql), {
      migrationsFolder: source.sdkFolder,
      migrationsSchema: "workflow_drizzle",
      migrationsTable: "workflow_migrations",
    });
    const snapshot = JSON.parse(
      readFileSync(join(__dirname, "../workflow-migrations/meta/0000_snapshot.json"), "utf8"),
    ) as {
      tables: Record<string, { schema: string; name: string }>;
      enums: Record<string, { schema: string; name: string; values: string[] }>;
    };
    for (const table of Object.values(snapshot.tables)) {
      const [found] = await sql`SELECT to_regclass(${`${table.schema}.${table.name}`}) AS name`;
      if (!found.name) throw new Error("Incomplete Workflow tables");
    }
    for (const expected of Object.values(snapshot.enums)) {
      const values =
        await sql`SELECT e.enumlabel FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid WHERE n.nspname=${expected.schema} AND t.typname=${expected.name} ORDER BY e.enumsortorder`;
      if (JSON.stringify(values.map((row) => row.enumlabel)) !== JSON.stringify(expected.values))
        throw new Error("Workflow enum mismatch");
    }
  }
}

/** Normal CLI and container migrations use the same service as startup maintenance. */
export async function runDatabaseMigrations() {
  await new DatabaseMigrationService(
    new ConfigService({
      database: {
        urlAdmin: process.env.MIGRATOR_DATABASE_URL || process.env.DATABASE_URL,
        urlApp: process.env.LMS_DATABASE_URL || process.env.DATABASE_URL,
      },
    }),
  ).runMigrations();
}
