import { sql } from "drizzle-orm";

import type { DatabasePg } from "src/common";

export async function grantWorkflowRuntimeRole(db: DatabasePg, role: string) {
  const owner = `"${role.replace(/"/g, '""')}"`;

  await db.execute(
    sql.raw(
      `
        GRANT USAGE ON SCHEMA workflow, workflow_drizzle TO ${owner};

        GRANT SELECT, INSERT, UPDATE, DELETE
          ON ALL TABLES IN SCHEMA workflow, workflow_drizzle TO ${owner};

        GRANT USAGE, SELECT
          ON ALL SEQUENCES IN SCHEMA workflow, workflow_drizzle TO ${owner};

        CREATE SCHEMA IF NOT EXISTS graphile_worker AUTHORIZATION ${owner};
        ALTER SCHEMA graphile_worker OWNER TO ${owner};
      `,
    ),
  );

  // Only Graphile objects change owner: its private RLS tables require runtime ownership.
  const changes = await db.execute(sql`
    SELECT
      format(
        'ALTER %s graphile_worker.%I OWNER TO %I',
        CASE c.relkind
          WHEN 'S' THEN 'SEQUENCE'
          WHEN 'v' THEN 'VIEW'
          WHEN 'm' THEN 'MATERIALIZED VIEW'
          ELSE 'TABLE'
        END,
        c.relname,
        ${role}::text
      ) AS statement,
      CASE WHEN c.relkind = 'S' THEN 1 ELSE 0 END AS ordering
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'graphile_worker'
      AND c.relkind IN ('r', 'p', 'S', 'v', 'm')
      AND pg_get_userbyid(c.relowner) <> ${role}

    UNION ALL

    SELECT
      format(
        'ALTER %s graphile_worker.%I(%s) OWNER TO %I',
        CASE p.prokind WHEN 'p' THEN 'PROCEDURE' ELSE 'FUNCTION' END,
        p.proname,
        pg_get_function_identity_arguments(p.oid),
        ${role}::text
      ),
      2
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'graphile_worker'
      AND p.prokind IN ('f', 'p')
      AND pg_get_userbyid(p.proowner) <> ${role}

    UNION ALL

    SELECT
      format('ALTER TYPE graphile_worker.%I OWNER TO %I', t.typname, ${role}::text),
      3
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    LEFT JOIN pg_class c ON c.oid = t.typrelid
    WHERE n.nspname = 'graphile_worker'
      AND (t.typtype IN ('e', 'd') OR (t.typtype = 'c' AND c.relkind = 'c'))
      AND pg_get_userbyid(t.typowner) <> ${role}

    ORDER BY ordering
  `);

  for (const change of changes) {
    await db.execute(sql.raw(String(change.statement)));
  }
}
