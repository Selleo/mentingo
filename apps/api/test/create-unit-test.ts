import { Test, type TestingModule } from "@nestjs/testing";

import { EmailAdapter } from "src/common/emails/adapters/email.adapter";

import { AppModule } from "../src/app.module";

import { EmailTestingAdapter } from "./helpers/test-email.adapter";
import { truncateAllTables } from "./helpers/test-helpers";
import { setupTestDatabase } from "./test-database";

import type { DatabasePg } from "../src/common";
import type { Provider } from "@nestjs/common";

export interface TestContext {
  module: TestingModule;
  db: DatabasePg;
  teardown: () => Promise<void>;
}

export async function createUnitTest(customProviders: Provider[] = []): Promise<TestContext> {
  const { db, sql } = await setupTestDatabase();

  // Truncate all tables and recreate global settings to ensure clean state
  await truncateAllTables(db);

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
