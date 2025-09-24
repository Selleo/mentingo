import { Test, type TestingModule } from "@nestjs/testing";

import { EmailAdapter } from "src/common/emails/adapters/email.adapter";

import { AppModule } from "../src/app.module";

import { EmailTestingAdapter } from "./helpers/test-email.adapter";
import { setupTestDatabase } from "./test-database";

import type { DatabasePg } from "../src/common";
import type { Provider } from "@nestjs/common";
import type { StartedTestContainer } from "testcontainers";

export interface TestContext {
  module: TestingModule;
  db: DatabasePg;
  pgContainer: StartedTestContainer;
  teardown: () => Promise<void>;
}

export async function createUnitTest(customProviders: Provider[] = []): Promise<TestContext> {
  const { db, pgContainer, pgConnectionString } = await setupTestDatabase();

  process.env.DATABASE_URL = pgConnectionString;

  const module: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
    providers: [...customProviders],
  })
    .overrideProvider(EmailAdapter)
    .useClass(EmailTestingAdapter)
    .compile();

  const teardown = async () => {
    if (pgContainer) {
      await pgContainer.stop();
    }
  };

  return {
    module,
    db,
    pgContainer,
    teardown,
  };
}
