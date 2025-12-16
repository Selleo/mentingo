import fs from "fs";

import { Test, type TestingModule } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { drizzle } from "drizzle-orm/postgres-js";
import * as express from "express";
import postgres from "postgres";

import { ActivityLogsService } from "src/activity-logs/activity-logs.service";
import { EmailAdapter } from "src/common/emails/adapters/email.adapter";

import { AppModule } from "../src/app.module";
import * as schema from "../src/storage/schema";

import { EmailTestingAdapter } from "./helpers/test-email.adapter";
import { truncateAllTables } from "./helpers/test-helpers";

import type { DatabasePg } from "../src/common";
import type { Provider } from "@nestjs/common";

const CONFIG_FILE = "/tmp/test-containers.json";

function getTestConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    throw new Error(`Test containers config not found at ${CONFIG_FILE}. Run globalSetup first.`);
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
}

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

  const config = getTestConfig();

  const sql = postgres(config.pgConnectionString, { max: 10 });
  const db = drizzle(sql, { schema }) as DatabasePg;

  await truncateAllTables(db);

  process.env.DATABASE_URL = config.pgConnectionString;
  process.env.REDIS_URL = config.redisUrl;
  process.env.NODE_ENV = "test";

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
