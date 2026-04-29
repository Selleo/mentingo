import request from "supertest";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { truncateAllTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("ChapterController (e2e)", () => {
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

  it("returns 401 for GET /api/chapter when unauthenticated", async () => {
    await request(app.getHttpServer())
      .get("/api/chapter?id=00000000-0000-0000-0000-000000000000&language=en")
      .expect(401);
  });

  it("returns 401 for POST /api/chapter/beta-create-chapter when unauthenticated", async () => {
    await request(app.getHttpServer()).post("/api/chapter/beta-create-chapter").send({}).expect(401);
  });

  it("returns 401 for PATCH /api/chapter when unauthenticated", async () => {
    await request(app.getHttpServer())
      .patch("/api/chapter?id=00000000-0000-0000-0000-000000000000")
      .send({ title: "Updated chapter" })
      .expect(401);
  });

  it("returns 401 for PATCH /api/chapter/chapter-display-order when unauthenticated", async () => {
    await request(app.getHttpServer())
      .patch("/api/chapter/chapter-display-order")
      .send({ chapterId: "00000000-0000-0000-0000-000000000000", displayOrder: 1 })
      .expect(401);
  });

  it("returns 401 for DELETE /api/chapter when unauthenticated", async () => {
    await request(app.getHttpServer())
      .delete("/api/chapter?chapterId=00000000-0000-0000-0000-000000000000")
      .expect(401);
  });

  it("returns 401 for PATCH /api/chapter/freemium-status when unauthenticated", async () => {
    await request(app.getHttpServer())
      .patch("/api/chapter/freemium-status?chapterId=00000000-0000-0000-0000-000000000000")
      .send({ isFreemium: true })
      .expect(401);
  });
});
