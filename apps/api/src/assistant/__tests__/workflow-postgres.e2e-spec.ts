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

async function bootstrap(connectionString: string) {
  await execute(process.execPath, [resolve(dirname(sdkEntry), "../bin/setup.js")], {
    // Running outside the repository also prevents the SDK from loading .env.
    cwd: tmpdir(),
    env: { ...process.env, WORKFLOW_POSTGRES_URL: connectionString },
    timeout: 30000,
  });
}

async function seedCore(sql: postgres.Sql) {
  await sql.unsafe(`
    CREATE TYPE public.status AS ENUM ('draft', 'published', 'private');
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
      "postgres:16-alpine",
    );
    const published = await docker("port", container, "5432/tcp");
    port = published.stdout.trim().split(":").pop()!;
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        await docker("exec", container, "pg_isready", "-U", "postgres");
        return;
      } catch {
        await sleep(200);
      }
    }
    throw new Error("Disposable PostgreSQL did not become ready");
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
    await sql.unsafe(`
      CREATE ROLE workflow_runtime LOGIN PASSWORD 'workflow_runtime_test';
      GRANT USAGE ON SCHEMA workflow, workflow_drizzle, graphile_worker TO workflow_runtime;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA workflow, workflow_drizzle, graphile_worker TO workflow_runtime;
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA workflow, workflow_drizzle, graphile_worker TO workflow_runtime;
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA workflow, workflow_drizzle, graphile_worker TO workflow_runtime;
      -- Graphile's private tables use RLS without policies. Its worker role
      -- must own its tables; ordinary DML grants alone cannot enqueue jobs.
      ALTER SCHEMA graphile_worker OWNER TO workflow_runtime;
      DO $$ DECLARE relation record; BEGIN
        FOR relation IN
          SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'graphile_worker' AND c.relkind IN ('r', 'p')
        LOOP
          EXECUTE format('ALTER TABLE graphile_worker.%I OWNER TO workflow_runtime', relation.relname);
        END LOOP;
      END $$;
    `);
    const runtimeUrl = new URL(connectionString);
    runtimeUrl.username = "workflow_runtime";
    runtimeUrl.password = "workflow_runtime_test";
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
});
