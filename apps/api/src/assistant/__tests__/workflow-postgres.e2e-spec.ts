import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";

import postgres from "postgres";

// Run explicitly with test/jest-workflow-postgres.json. This owns its Docker
// container and never reads DATABASE_URL or connects to an existing database.
const execute = promisify(execFile);
const sdkEntry = require.resolve("@workflow/world-postgres");
const container = `mentingo-workflow-schema-${process.pid}`;

async function docker(...args: string[]) {
  return execute("docker", args, { timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
}

async function bootstrap(
  connectionString: string,
  appConnection = connectionString,
  environment: NodeJS.ProcessEnv = {},
  command = "db:migrate",
) {
  await execute("pnpm", [command], {
    cwd: resolve(__dirname, "../../.."),
    env: {
      ...process.env,
      DATABASE_URL: connectionString,
      MIGRATOR_DATABASE_URL: connectionString,
      LMS_DATABASE_URL: appConnection,
      ...environment,
    },
    timeout: 120000,
    maxBuffer: 4 * 1024 * 1024,
  });
}

async function provisionRuntimeRole(connectionString: string) {
  await execute(
    "pnpm",
    [
      "exec",
      "tsx",
      "-e",
      `
    const postgres = require('postgres');
    const { drizzle } = require('drizzle-orm/postgres-js');
    (async () => {
      const client = postgres(process.env.DATABASE_URL, { max: 1 });
      try {
        const db = drizzle(client);
        const { seedUserRoleGrantSql } = require('./src/seed/database-role');
        await seedUserRoleGrantSql(db);
      } finally { await client.end(); }
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `,
    ],
    {
      cwd: resolve(__dirname, "../../.."),
      env: {
        ...process.env,
        DATABASE_URL: connectionString,
        SEED_MANAGE_DB_ROLE: "true",
      },
      timeout: 30000,
    },
  );
}

async function referenceBootstrap(connectionString: string) {
  await execute(process.execPath, [resolve(dirname(sdkEntry), "../bin/setup.js")], {
    cwd: tmpdir(),
    env: { ...process.env, WORKFLOW_POSTGRES_URL: connectionString },
    timeout: 30000,
  });
}

async function workflowSignature(sql: postgres.Sql) {
  const columns = await sql`
    SELECT c.relname, a.attname, a.attnotnull,
      CASE WHEN t.typtype='e' THEN 'enum:' || t.typname ELSE format_type(a.atttypid,a.atttypmod) END AS type,
      pg_get_expr(d.adbin,d.adrelid) AS default_value
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
    JOIN pg_type t ON t.oid=a.atttypid
    LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
    WHERE n.nspname='workflow' AND c.relkind='r' ORDER BY c.relname,a.attname
  `;
  const indexes =
    await sql`SELECT c.relname AS table_name, i.relname AS index_name, pg_get_indexdef(i.oid) AS definition, x.indisprimary FROM pg_index x JOIN pg_class c ON c.oid=x.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_class i ON i.oid=x.indexrelid WHERE n.nspname='workflow' ORDER BY c.relname,i.relname`;
  const constraints =
    await sql`SELECT c.relname,p.contype,CASE WHEN c.relname='workflow_invocations' AND p.contype='p' THEN 'workflow_invocations_primary' ELSE p.conname END AS conname,pg_get_constraintdef(p.oid) AS definition FROM pg_constraint p JOIN pg_class c ON c.oid=p.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='workflow' ORDER BY c.relname,conname`;
  const enums =
    await sql`SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid WHERE t.typname IN ('status','step_status','wait_status') AND t.oid IN (SELECT a.atttypid FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='workflow') GROUP BY t.oid,t.typname ORDER BY t.typname`;
  return {
    columns: [...columns],
    // Only the invocations PK name differs between current model and historical SQL.
    // Compare their complete index definitions/columns with only that generated name normalized.
    indexes: indexes.map((row) => {
      const knownNamingDifference = row.table_name === "workflow_invocations" && row.indisprimary;
      return {
        table_name: row.table_name,
        index_name: knownNamingDifference ? "workflow_invocations_primary" : row.index_name,
        definition: knownNamingDifference
          ? row.definition.replace(row.index_name, "workflow_invocations_primary")
          : row.definition,
      };
    }),
    constraints: [...constraints],
    enums: [...enums],
  };
}

async function seedCore(sql: postgres.Sql) {
  await sql.unsafe(`
    CREATE TYPE public.status_new AS ENUM ('application_owned');
    CREATE TYPE public.step_status AS ENUM ('todo', 'done');
    CREATE TYPE public.wait_status AS ENUM ('waiting', 'finished');
    CREATE TABLE public.core_records (
      id serial PRIMARY KEY, status public.status NOT NULL DEFAULT 'draft',
      step public.step_status NOT NULL DEFAULT 'todo',
      waiting public.wait_status NOT NULL DEFAULT 'waiting',
      replacement public.status_new NOT NULL DEFAULT 'application_owned',
      payload jsonb NOT NULL
    );
    INSERT INTO public.core_records(status, payload) VALUES
      ('draft', '{"title":"Draft course"}'),
      ('published', '{"title":"Published course"}'),
      ('private', '{"title":"Private course"}');
    CREATE INDEX core_status_index ON public.core_records(status);
    CREATE VIEW public.published_records AS SELECT * FROM public.core_records WHERE status = 'published';
    CREATE SCHEMA core_other;
    CREATE TABLE core_other.references (id integer PRIMARY KEY REFERENCES public.core_records(id));
    INSERT INTO core_other.references VALUES (2);
  `);
}

async function outsideSnapshot(sql: postgres.Sql, database: string) {
  const { stdout } = await docker(
    "exec",
    container,
    "pg_dump",
    "-U",
    "postgres",
    "-d",
    database,
    "--schema-only",
    "--exclude-schema=workflow",
    "--exclude-schema=workflow_drizzle",
    "--exclude-schema=graphile_worker",
  );
  const catalog = await sql`
    SELECT n.nspname, t.oid::text, t.typname,
      COALESCE(array_agg(e.enumlabel ORDER BY e.enumsortorder) FILTER (WHERE e.enumlabel IS NOT NULL), '{}') AS labels
    FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    LEFT JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname IN ('public', 'core_other')
    GROUP BY n.nspname, t.oid, t.typname ORDER BY n.nspname, t.typname
  `;
  const relations = await sql`
    SELECT n.nspname, c.relname, c.oid::text, c.relkind,
      a.attnum, a.attname, a.atttypid::text
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0
    WHERE n.nspname IN ('public', 'core_other')
    ORDER BY n.nspname, c.relname, a.attnum
  `;
  return {
    // pg_dump randomizes only the \restrict token on recent PostgreSQL builds.
    schema: stdout.replace(/^\\(?:un)?restrict .*\n/gm, ""),
    catalog: [...catalog],
    relations: [...relations],
    records: [...(await sql`SELECT * FROM public.core_records ORDER BY id`)],
    references: [...(await sql`SELECT * FROM core_other.references ORDER BY id`)],
    sequence: [...(await sql`SELECT * FROM public.core_records_id_seq`)],
    namespaces: [
      ...(await sql`
      SELECT oid::text, nspname FROM pg_namespace
      WHERE nspname NOT IN ('workflow', 'workflow_drizzle', 'graphile_worker') ORDER BY nspname
    `),
    ],
  };
}

async function smokeQueue(connectionString: string) {
  const script = `
    const assert = require('node:assert/strict');
    (async () => {
      const { createWorld } = await import(${JSON.stringify(sdkEntry)});
      const world = createWorld({
        connectionString: process.env.WORKFLOW_POSTGRES_URL,
        queueConcurrency: 1, pollInterval: 50, applicationManagedShutdown: true
      });
      let timer;
      try {
        const received = new Promise((resolve, reject) => {
          timer = setTimeout(() => reject(new Error('Queue delivery timed out')), 10000);
          world.registerHandler('__wkf_workflow_', async request => {
            const body = await request.json();
            assert.equal(body.runId, 'schema-regression-run');
            assert.equal(request.headers.get('x-vqs-queue-name'), '__wkf_workflow_schema-regression');
            resolve(body);
            return new Response(null, { status: 200 });
          });
        });
        await world.start();
        await world.queue('__wkf_workflow_schema-regression', {
          runId: 'schema-regression-run', workflowName: 'schema-regression', deploymentId: 'test'
        });
        await received;
      } finally {
        clearTimeout(timer);
        await world.close();
      }
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    WORKFLOW_POSTGRES_URL: connectionString,
    PORT: "",
    WORKFLOW_LOCAL_BASE_URL: "http://workflow.test",
  };
  delete env.WORKFLOW_QUEUE_NAMESPACE;
  await execute(process.execPath, ["-e", script], {
    cwd: tmpdir(),
    env,
    timeout: 20000,
  });
}

describe("Workflow PostgreSQL migrations in the Core database", () => {
  let port: string;
  const connections: postgres.Sql[] = [];

  beforeAll(async () => {
    await docker(
      "run",
      "--detach",
      "--rm",
      "--name",
      container,
      "--publish",
      "127.0.0.1::5432",
      "--env",
      "POSTGRES_PASSWORD=workflow_schema_test",
      "pgvector/pgvector:pg16",
    );
    const published = await docker("port", container, "5432/tcp");
    port = published.stdout.trim().split(":").pop()!;
    const readiness = postgres(
      `postgres://postgres:workflow_schema_test@127.0.0.1:${port}/postgres`,
      { max: 1, connect_timeout: 1 },
    );
    try {
      for (let attempt = 0; attempt < 30; attempt++) {
        try {
          // Docker's initialization server can report Unix-socket readiness before
          // restarting; only the final server accepts the published TCP connection.
          await readiness`SELECT 1`;
          return;
        } catch {
          await sleep(200);
        }
      }
      throw new Error("Disposable PostgreSQL did not become ready");
    } finally {
      await readiness.end();
    }
  });

  afterAll(async () => {
    await Promise.all(connections.map((sql) => sql.end()));
    await docker("rm", "--force", container);
  });

  async function database(name: string) {
    await docker("exec", container, "createdb", "-U", "postgres", name);
    const connectionString = `postgres://postgres:workflow_schema_test@127.0.0.1:${port}/${name}`;
    const sql = postgres(connectionString, { max: 1, onnotice: () => undefined });
    connections.push(sql);
    return { connectionString, sql };
  }

  it("bootstraps and reruns without changing Core enums, OIDs, schema or records, then consumes SDK jobs", async () => {
    const { sql, connectionString } = await database("core_collision");
    await bootstrap(connectionString);
    await seedCore(sql);
    const before = await outsideSnapshot(sql, "core_collision");
    await bootstrap(connectionString);
    expect(await outsideSnapshot(sql, "core_collision")).toEqual(before);
    const history = [
      ...(await sql`SELECT * FROM workflow_drizzle.workflow_migrations ORDER BY id`),
    ];
    expect(history).toHaveLength(28);
    const enumNamespaces = await sql`
      SELECT t.typname, n.nspname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE t.oid IN (
        SELECT atttypid FROM pg_attribute
        WHERE attrelid IN ('workflow.workflow_runs'::regclass, 'workflow.workflow_steps'::regclass, 'workflow.workflow_waits'::regclass)
          AND attname = 'status'
      ) ORDER BY t.typname
    `;
    expect([...enumNamespaces]).toEqual([
      { typname: "status", nspname: "workflow" },
      { typname: "step_status", nspname: "workflow" },
      { typname: "wait_status", nspname: "workflow" },
    ]);
    await bootstrap(connectionString);
    expect([
      ...(await sql`SELECT * FROM workflow_drizzle.workflow_migrations ORDER BY id`),
    ]).toEqual(history);
    expect(await outsideSnapshot(sql, "core_collision")).toEqual(before);
    await sql.unsafe("CREATE ROLE workflow_runtime LOGIN PASSWORD 'workflow_runtime_test'");
    const runtimeUrl = new URL(connectionString);
    runtimeUrl.username = "workflow_runtime";
    runtimeUrl.password = "workflow_runtime_test";
    await Promise.all([
      bootstrap(connectionString, runtimeUrl.href),
      bootstrap(connectionString, runtimeUrl.href),
    ]);
    // The container entrypoint invokes this compiled command with production dependencies.
    await execute("pnpm", ["db:migrate:prod"], {
      cwd: resolve(__dirname, "../../.."),
      env: {
        ...process.env,
        DATABASE_URL: connectionString,
        MIGRATOR_DATABASE_URL: connectionString,
        LMS_DATABASE_URL: runtimeUrl.href,
      },
      timeout: 60000,
      maxBuffer: 4 * 1024 * 1024,
    });
    const runtimeSql = postgres(runtimeUrl.href, { max: 1 });
    connections.push(runtimeSql);
    await expect(runtimeSql`SELECT * FROM public.core_records`).rejects.toMatchObject({
      code: "42501",
    });
    await expect(
      runtimeSql.unsafe("ALTER TABLE public.core_records ADD COLUMN forbidden_runtime_write text"),
    ).rejects.toMatchObject({ code: "42501" });
    await smokeQueue(runtimeUrl.href);
    expect(await outsideSnapshot(sql, "core_collision")).toEqual(before);
  });
  it("initializes a fresh queue for a restricted app role without database CREATE privileges", async () => {
    const { sql, connectionString } = await database("restricted_first_boot");
    await sql.unsafe("CREATE ROLE fresh_workflow_runtime LOGIN PASSWORD 'fresh_workflow_test'");
    const runtimeUrl = new URL(connectionString);
    runtimeUrl.username = "fresh_workflow_runtime";
    runtimeUrl.password = "fresh_workflow_test";
    const runtimeSql = postgres(runtimeUrl.href, { max: 1 });
    connections.push(runtimeSql);
    const [privileges] = await runtimeSql`
      SELECT has_database_privilege(current_database(), 'CREATE') AS can_create
    `;
    expect(privileges.can_create).toBe(false);
    const invalidRuntimeUrl = new URL(runtimeUrl.href);
    invalidRuntimeUrl.password = "invalid-unused-password";
    await bootstrap(connectionString, invalidRuntimeUrl.href);
    await bootstrap(connectionString, invalidRuntimeUrl.href, {}, "db:migrate:prod");
    await smokeQueue(runtimeUrl.href);
    await bootstrap(connectionString, runtimeUrl.href);
    await smokeQueue(runtimeUrl.href);
  });

  it("repairs missing runtime permissions on an existing migrator-owned production queue", async () => {
    const { sql, connectionString } = await database("production_runtime_grants");
    await bootstrap(connectionString);
    await sql.unsafe("CREATE ROLE production_runtime LOGIN PASSWORD 'production_runtime_test'");
    const runtimeUrl = new URL(connectionString);
    runtimeUrl.username = "production_runtime";
    runtimeUrl.password = "production_runtime_test";
    const runtimeSql = postgres(runtimeUrl.href, { max: 1 });
    connections.push(runtimeSql);
    await expect(runtimeSql`SELECT * FROM graphile_worker._private_jobs`).rejects.toMatchObject({
      code: "42501",
    });
    const invalidRuntimeUrl = new URL(runtimeUrl.href);
    invalidRuntimeUrl.password = "invalid-unused-password";
    await bootstrap(connectionString, invalidRuntimeUrl.href, {}, "db:migrate:prod");
    await bootstrap(connectionString, invalidRuntimeUrl.href, {}, "db:migrate:prod");
    const [owner] = await sql`
      SELECT pg_get_userbyid(relowner) AS role FROM pg_class
      WHERE oid = 'graphile_worker._private_jobs'::regclass
    `;
    expect(owner.role).toBe("production_runtime");
    await smokeQueue(runtimeUrl.href);
    const [privileges] = await runtimeSql`
      SELECT rolsuper, rolcreatedb, rolbypassrls FROM pg_roles WHERE rolname = current_user
    `;
    expect(privileges).toEqual({ rolsuper: false, rolcreatedb: false, rolbypassrls: false });
    await expect(runtimeSql`SELECT * FROM public.users`).rejects.toMatchObject({ code: "42501" });
  });

  it("migrates before the app role exists, then grants access through seed setup and subsequent migrations", async () => {
    const { sql, connectionString } = await database("unseeded_runtime");
    const runtimeUrl = new URL(connectionString);
    runtimeUrl.username = "lms_app_user";
    runtimeUrl.password = "replace_with_strong_password";
    await bootstrap(connectionString, runtimeUrl.href);
    await bootstrap(connectionString, runtimeUrl.href, {}, "db:migrate:prod");
    const [state] = await sql`
      SELECT to_regclass('public.assistant_threads') IS NOT NULL AS core_ready,
        to_regclass('workflow.workflow_runs') IS NOT NULL AS workflow_ready,
        EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lms_app_user') AS app_role_exists
    `;
    expect(state).toEqual({ core_ready: true, workflow_ready: true, app_role_exists: false });
    await provisionRuntimeRole(connectionString);
    await provisionRuntimeRole(connectionString);
    await smokeQueue(runtimeUrl.href);
    const [owner] = await sql`
      SELECT pg_get_userbyid(relowner) AS role FROM pg_class
      WHERE oid = 'graphile_worker._private_jobs'::regclass
    `;
    expect(owner.role).toBe("lms_app_user");
    await bootstrap(connectionString, runtimeUrl.href);
    await smokeQueue(runtimeUrl.href);
  });

  it("supports migrator-only schema setup without an application URL", async () => {
    const { connectionString } = await database("migrator_only");
    const environment = { DATABASE_URL: undefined, LMS_DATABASE_URL: undefined };
    await bootstrap(connectionString, connectionString, environment);
    await bootstrap(connectionString, connectionString, environment, "db:migrate:prod");
  });

  it("runs only Core migrations in browser E2E mode without connecting as the unseeded app role", async () => {
    const { sql, connectionString } = await database("playwright_core_only");
    const runtimeUrl = new URL(connectionString);
    runtimeUrl.username = "unseeded_playwright_role";
    runtimeUrl.password = "not-created";
    await bootstrap(connectionString, runtimeUrl.href, { E2E: "true" });
    await execute("pnpm", ["db:migrate:prod"], {
      cwd: resolve(__dirname, "../../.."),
      env: {
        ...process.env,
        DATABASE_URL: connectionString,
        MIGRATOR_DATABASE_URL: connectionString,
        LMS_DATABASE_URL: runtimeUrl.href,
        E2E: "true",
      },
      timeout: 60000,
      maxBuffer: 4 * 1024 * 1024,
    });
    const [state] = await sql`
      SELECT to_regclass('public.assistant_threads') IS NOT NULL AS core_ready,
        EXISTS (SELECT 1 FROM pg_namespace WHERE nspname IN ('workflow', 'workflow_drizzle', 'graphile_worker')) AS workflow_present
    `;
    expect(state).toEqual({ core_ready: true, workflow_present: false });
    await provisionRuntimeRole(connectionString);
  });

  it("follows current SDK schema with explicitly checked historical SQL differences", async () => {
    const baseline = await database("schema_baseline");
    const reference = await database("schema_reference");
    await bootstrap(baseline.connectionString);
    // Upstream historical SQL is safe only in this empty disposable reference database.
    await referenceBootstrap(reference.connectionString);
    const generated = await workflowSignature(baseline.sql);
    const historical = await workflowSignature(reference.sql);
    const specVersion = (row: Record<string, unknown>) =>
      row.relname === "workflow_runs" && row.attname === "spec_version";
    // SDK 5.0.5 exports integer, but historical migration 0005 still creates varchar.
    // The generated current model is authoritative; assert this discrepancy explicitly.
    expect(generated.columns.find(specVersion)?.type).toBe("integer");
    expect(historical.columns.find(specVersion)?.type).toBe("character varying");
    historical.columns = historical.columns.map((row) =>
      specVersion(row) ? { ...row, type: "integer" } : row,
    );
    expect(generated).toEqual(historical);
  });

  it("refuses untracked or incomplete SDK schemas without blessing their tracker", async () => {
    const { sql, connectionString } = await database("schema_partial");
    await sql.unsafe("CREATE SCHEMA workflow; CREATE TABLE workflow.partial (id integer)");
    await expect(bootstrap(connectionString)).rejects.toThrow();
    expect([
      ...(await sql`SELECT to_regclass('workflow_drizzle.workflow_migrations') AS tracker`),
    ]).toEqual([{ tracker: null }]);
    expect([...(await sql`SELECT to_regclass('workflow.partial') AS preserved`)]).toEqual([
      { preserved: "workflow.partial" },
    ]);
  });
});
