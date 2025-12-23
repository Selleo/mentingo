import { Test, type TestingModule } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import * as express from "express";

import { ActivityLogsService } from "src/activity-logs/activity-logs.service";
import { EmailAdapter } from "src/common/emails/adapters/email.adapter";

import { AppModule } from "../src/app.module";

import { EmailTestingAdapter } from "./helpers/test-email.adapter";
import { truncateAllTables } from "./helpers/test-helpers";
import { setupTestDatabase } from "./test-database";

import type { Provider } from "@nestjs/common";

type E2ETestOptions = {
  customProviders?: Provider[];
  enableActivityLogs?: boolean;
};

export async function createE2ETest(optionsOrProviders: E2ETestOptions | Provider[] = {}) {
  const options = Array.isArray(optionsOrProviders)
    ? { customProviders: optionsOrProviders }
    : optionsOrProviders;

  const customProviders = options.customProviders ?? [];
  const enableActivityLogs = options.enableActivityLogs ?? false;

  const { db, sql } = await setupTestDatabase();

  await truncateAllTables(db);

  let testModuleBuilder = Test.createTestingModule({
    imports: [AppModule],
    providers: [...customProviders],
  })
    .overrideProvider("DB")
    .useValue(db)
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

  const moduleFixture: TestingModule = await testModuleBuilder.compile();

  const app = moduleFixture.createNestApplication({
    bodyParser: false,
  });
  app.setGlobalPrefix("api");
  app.use(cookieParser());

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

  return {
    app,
    moduleFixture,
    db,
    cleanup: async () => {
      await sql.end();
    },
  };
}
