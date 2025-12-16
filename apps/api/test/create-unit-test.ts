import fs from "fs";

import { Test, type TestingModule } from "@nestjs/testing";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { EmailAdapter } from "src/common/emails/adapters/email.adapter";

import { AppModule } from "../src/app.module";
import * as schema from "../src/storage/schema";

import { EmailTestingAdapter } from "./helpers/test-email.adapter";
import { truncateAllTables } from "./helpers/test-helpers";

import type { DatabasePg } from "../src/common";
import type { Provider } from "@nestjs/common";

const CONFIG_FILE = "/tmp/test-containers.json";

export interface TestContext {
  module: TestingModule;
  db: DatabasePg;
  teardown: () => Promise<void>;
}

function getTestConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    throw new Error(`Test containers config not found at ${CONFIG_FILE}. Run globalSetup first.`);
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
}

export async function createUnitTest(customProviders: Provider[] = []): Promise<TestContext> {
  const config = getTestConfig();

  const sql = postgres(config.pgConnectionString, { max: 10 });
  const db = drizzle(sql, { schema }) as DatabasePg;

  // Truncate all tables and recreate global settings to ensure clean state
  await truncateAllTables(db);

  process.env.DATABASE_URL = config.pgConnectionString;
  process.env.REDIS_URL = config.redisUrl;
  process.env.NODE_ENV = "test";

  const module: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
    providers: [...customProviders],
  })
    .overrideProvider("DB")
    .useValue(db)
    .overrideProvider(EmailAdapter)
    .useClass(EmailTestingAdapter)
    .compile();

  const teardown = async () => {
    await sql.end({ timeout: 5 });
  };

  return {
    module,
    db,
    teardown,
  };
}
