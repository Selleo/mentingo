import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import request from "supertest";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory, type UserWithCredentials } from "../../../test/factory/user.factory";
import { cookieFor, truncateTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("Self-permission endpoints (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;
  let globalSettingsFactory: ReturnType<typeof createSettingsFactory>;
  let studentUser: UserWithCredentials;
  let trainerUser: UserWithCredentials;
  let studentCookies: string;
  let trainerCookies: string;

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();
    app = testApp;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    userFactory = createUserFactory(db);
    globalSettingsFactory = createSettingsFactory(db, null);

    await truncateTables(baseDb, ["settings"]);
    await globalSettingsFactory.create();

    studentUser = await userFactory
      .withCredentials({ password: "Password123@@" })
      .withUserSettings(db)
      .associations({ roleSlug: SYSTEM_ROLE_SLUGS.STUDENT })
      .create();
    trainerUser = await userFactory
      .withCredentials({ password: "Password123@@" })
      .withTrainerSettings(db)
      .associations({ roleSlug: SYSTEM_ROLE_SLUGS.TRAINER })
      .create();

    studentCookies = await cookieFor(studentUser, app);
    trainerCookies = await cookieFor(trainerUser, app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("allows a student to read and update their own settings", async () => {
    await request(app.getHttpServer())
      .get("/api/settings")
      .set("Cookie", studentCookies)
      .expect(200);

    await request(app.getHttpServer())
      .put("/api/settings")
      .set("Cookie", studentCookies)
      .send({ language: "pl" })
      .expect(200);
  });

  it("denies a trainer user statistics without statistics.read_self", async () => {
    await request(app.getHttpServer())
      .get("/api/statistics/user-stats?language=en")
      .set("Cookie", trainerCookies)
      .expect(403);
  });
});
