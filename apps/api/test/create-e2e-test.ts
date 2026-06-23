import { Test, type TestingModule } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { drizzle } from "drizzle-orm/postgres-js";
import * as express from "express";
import postgres from "postgres";

import { ActivityLogsService } from "src/activity-logs/activity-logs.service";
import { AppModule } from "src/app.module";
import { EmailAdapter } from "src/common/emails/adapters/email.adapter";
import { createDbProxy, DB, DB_ADMIN, DB_APP } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import * as schema from "src/storage/schema";

import { DEFAULT_TEST_TENANT_HOST, ensureTenant } from "./helpers/tenant-helpers";
import { EmailTestingAdapter } from "./helpers/test-email.adapter";
import { truncateAllTables } from "./helpers/test-helpers";
import { setupTestDatabase } from "./test-database";

import type { Provider } from "@nestjs/common";
import type { DatabasePg } from "src/common";

type E2ETestOptions = {
  customProviders?: Provider[];
  enableActivityLogs?: boolean;
  useDbProxy?: boolean;
};

const TEST_APP_ROLE = "lms_test_app_user";
const TEST_APP_ROLE_PASSWORD = "replace_with_strong_password";

const getAppDatabaseUrl = (databaseUrl: string) => {
  const url = new URL(databaseUrl);
  url.username = TEST_APP_ROLE;
  url.password = TEST_APP_ROLE_PASSWORD;

  return url.toString();
};

const ensureTestAppRole = async (pgSqlAdmin: ReturnType<typeof postgres>) => {
  await pgSqlAdmin.unsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${TEST_APP_ROLE}') THEN
        CREATE ROLE ${TEST_APP_ROLE} LOGIN;
      END IF;
    END
    $$;
  `);
  await pgSqlAdmin.unsafe(`
    ALTER ROLE ${TEST_APP_ROLE}
      WITH
      LOGIN
      PASSWORD '${TEST_APP_ROLE_PASSWORD}'
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOBYPASSRLS;
  `);
  await pgSqlAdmin.unsafe(`GRANT USAGE ON SCHEMA public TO ${TEST_APP_ROLE}`);
  await pgSqlAdmin.unsafe(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${TEST_APP_ROLE}`,
  );
  await pgSqlAdmin.unsafe(
    `GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${TEST_APP_ROLE}`,
  );
};

export async function createE2ETest(optionsOrProviders: E2ETestOptions | Provider[] = {}) {
  const options = Array.isArray(optionsOrProviders)
    ? { customProviders: optionsOrProviders }
    : optionsOrProviders;

  const customProviders = options.customProviders ?? [];
  const enableActivityLogs = options.enableActivityLogs ?? false;

  const {
    db,
    sql: pgSql,
    dbAdmin,
    sqlAdmin: pgSqlAdmin,
    pgConnectionString,
  } = await setupTestDatabase();

  const defaultTenantId = await ensureTenant(dbAdmin);

  const dbName = new URL(pgConnectionString).pathname.replace(/^\//, "");
  await pgSql.unsafe(`ALTER DATABASE "${dbName}" SET app.tenant_id = '${defaultTenantId}'`);

  await pgSql`SELECT set_config('app.tenant_id', ${defaultTenantId}, false)`;

  await truncateAllTables(dbAdmin, db);

  let pgSqlApp: ReturnType<typeof postgres> | null = null;
  let dbApp: DatabasePg = db;

  if (options.useDbProxy) {
    await ensureTestAppRole(pgSqlAdmin);
    pgSqlApp = postgres(getAppDatabaseUrl(pgConnectionString), { max: 10 });
    dbApp = drizzle(pgSqlApp, { schema }) as DatabasePg;
    await pgSqlApp`SELECT set_config('app.tenant_id', ${defaultTenantId}, false)`;
  }

  let testModuleBuilder = Test.createTestingModule({
    imports: [AppModule],
    providers: [...customProviders],
  })
    .overrideProvider(DB)
    .useValue(options.useDbProxy ? createDbProxy(dbApp) : db)
    .overrideProvider(DB_APP)
    .useValue(dbApp)
    .overrideProvider(DB_ADMIN)
    .useValue(dbAdmin)
    .overrideProvider(EmailAdapter)
    .useClass(EmailTestingAdapter);

  // Disable activity logging by default to prevent deadlocks between
  // async activity log INSERTs and TRUNCATE during test cleanup.
  // Only enable for activity-logs.e2e-spec.ts tests.
  if (!enableActivityLogs) {
    testModuleBuilder = testModuleBuilder.overrideProvider(ActivityLogsService).useValue({
      recordActivity: async () => {},
      persistActivityLog: async () => {},
    });
  }

  for (const provider of customProviders) {
    if (typeof provider !== "object" || provider === null || !("provide" in provider)) {
      continue;
    }

    if ("useValue" in provider) {
      testModuleBuilder = testModuleBuilder
        .overrideProvider(provider.provide)
        .useValue(provider.useValue);
    } else if ("useClass" in provider) {
      testModuleBuilder = testModuleBuilder
        .overrideProvider(provider.provide)
        .useClass(provider.useClass);
    } else if ("useFactory" in provider) {
      testModuleBuilder = testModuleBuilder.overrideProvider(provider.provide).useFactory({
        factory: provider.useFactory,
        inject: provider.inject,
      });
    }
  }

  const moduleFixture: TestingModule = await testModuleBuilder.compile();

  const app = moduleFixture.createNestApplication({
    bodyParser: false,
  });
  app.setGlobalPrefix("api");
  app.use(cookieParser());

  app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    if (!req.headers.referer) {
      req.headers.referer = `${DEFAULT_TEST_TENANT_HOST}/`;
    }

    next();
  });

  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith("/api/better-auth")) {
      next();
    } else {
      express.json({ limit: "5mb" })(req, res, (err) => {
        if (err) {
          next(err);
          return;
        }

        express.urlencoded({ extended: true, limit: "5mb" })(req, res, next);
      });
    }
  });

  await app.init();

  app.useLogger(false);

  const tenantRunner = app.get(TenantDbRunnerService);
  const closeApp = app.close.bind(app);

  let cleanupPromise: Promise<void> | null = null;

  const cleanup = async () => {
    cleanupPromise ??= Promise.all([
      pgSql.end(),
      pgSqlAdmin.end(),
      pgSqlApp?.end() ?? Promise.resolve(),
    ]).then(() => undefined);
    await cleanupPromise;
  };

  app.close = async () => {
    try {
      await closeApp();
    } finally {
      await cleanup();
    }
  };

  console.info("✅ App setup completed successfully");

  return {
    app,
    moduleFixture,
    db,
    dbAdmin: app.get(DB_ADMIN),
    defaultTenantId,
    tenantRunner,
    runAsTenant: <T>(tenantId: string, fn: () => Promise<T>) =>
      tenantRunner.runWithTenant(tenantId, fn),
    cleanup,
  };
}
