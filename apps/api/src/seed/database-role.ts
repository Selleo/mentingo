import { sql } from "drizzle-orm";

import { grantWorkflowRuntimeRole } from "../storage/db/workflow-runtime-role";

import type { DatabasePg } from "../common";

export const seedUserRoleGrantSql = async (db: DatabasePg) => {
  const forceManageDbRole = process.env.SEED_MANAGE_DB_ROLE === "true";

  const isCi = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
  const isNonLocalEnv = ["production", "staging", "test"].includes(process.env.NODE_ENV ?? "");

  const isLocal = !isCi && !isNonLocalEnv;

  if (!isLocal && !forceManageDbRole) {
    console.warn(
      "Skipping DB role management outside local env. Set SEED_MANAGE_DB_ROLE=true to enable.",
    );
    return;
  }

  await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lms_app_user') THEN
          CREATE ROLE lms_app_user
            LOGIN
            PASSWORD 'replace_with_strong_password'
            NOSUPERUSER
            NOCREATEDB
            NOCREATEROLE
            NOBYPASSRLS;
        END IF;
      END
      $$;
    `);

  await db.execute(sql`
      DO $$
      BEGIN
        EXECUTE format('GRANT CONNECT ON DATABASE %I TO lms_app_user', current_database());
      END
      $$;
    `);
  await db.execute(sql`GRANT USAGE ON SCHEMA public TO lms_app_user;`);
  await db.execute(
    sql`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO lms_app_user;`,
  );
  await db.execute(sql`
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lms_app_user;
    `);
  const [workflow] = await db.execute(sql`
    SELECT to_regclass('workflow.workflow_runs') IS NOT NULL
      AND to_regnamespace('graphile_worker') IS NOT NULL AS ready
  `);
  if (workflow.ready) await grantWorkflowRuntimeRole(db, "lms_app_user");
};
