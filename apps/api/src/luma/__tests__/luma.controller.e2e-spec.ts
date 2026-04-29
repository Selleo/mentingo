import request from "supertest";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { truncateAllTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("LumaController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();
    app = testApp;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    settingsFactory = createSettingsFactory(db);
  });

  beforeEach(async () => {
    await settingsFactory.create({ userId: null });
  });

  afterEach(async () => {
    await truncateAllTables(dbAdmin, db);
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 401 for luma endpoints when unauthenticated", async () => {
    await request(app.getHttpServer()).post("/api/luma/course-generation/chat").send({}).expect(401);
    await request(app.getHttpServer())
      .get("/api/luma/course-generation/messages?integrationId=00000000-0000-0000-0000-000000000000")
      .expect(401);
    await request(app.getHttpServer())
      .get("/api/luma/course-generation/draft?integrationId=00000000-0000-0000-0000-000000000000&draftName=test&courseLanguage=en")
      .expect(401);
    await request(app.getHttpServer())
      .post("/api/luma/course-generation/files/ingest")
      .send({ integrationId: "00000000-0000-0000-0000-000000000000" })
      .expect(401);
    await request(app.getHttpServer())
      .delete(
        "/api/luma/course-generation/files/00000000-0000-0000-0000-000000000000/00000000-0000-0000-0000-000000000000",
      )
      .expect(401);
    await request(app.getHttpServer())
      .get("/api/luma/course-generation/files/00000000-0000-0000-0000-000000000000")
      .expect(401);
  });
});
