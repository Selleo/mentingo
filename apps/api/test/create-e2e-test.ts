import { Test, type TestingModule } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import * as express from "express";

import { EmailAdapter } from "src/common/emails/adapters/email.adapter";

import { AppModule } from "../src/app.module";

import { EmailTestingAdapter } from "./helpers/test-email.adapter";
import { setupTestDatabase } from "./test-database";

import type { Provider } from "@nestjs/common";

export async function createE2ETest(customProviders: Provider[] = []) {
  const { db, pgConnectionString } = await setupTestDatabase();

  process.env.DATABASE_URL = pgConnectionString;
  process.env.NODE_ENV = "test";

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
    providers: [
      ...customProviders,
      {
        provide: "DB",
        useValue: db,
      },
    ],
  })
    .overrideProvider(EmailAdapter)
    .useClass(EmailTestingAdapter)
    .compile();

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
  };
}
