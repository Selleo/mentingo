import request from "supertest";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { truncateAllTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("FileController (e2e)", () => {
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

  it("returns 401 for protected file endpoints when unauthenticated", async () => {
    await request(app.getHttpServer()).post("/api/file").expect(401);
    await request(app.getHttpServer()).post("/api/file/videos/init").send({}).expect(401);
    await request(app.getHttpServer())
      .get("/api/file/videos/00000000-0000-0000-0000-000000000000")
      .expect(401);
    await request(app.getHttpServer()).delete("/api/file?fileKey=test-file").expect(401);
  });

  it("returns 400 for public validation paths", async () => {
    const tusResponse = await request(app.getHttpServer())
      .post("/api/file/videos/tus")
      .set("Upload-Length", "1")
      .expect(400);
    expect(tusResponse.body.message).toBe("Missing uploadId");

    const bunnyWebhookResponse = await request(app.getHttpServer())
      .post("/api/file/bunny/webhook")
      .send({})
      .expect(400);
    expect(
      typeof bunnyWebhookResponse.body.message === "string" ||
        (Array.isArray(bunnyWebhookResponse.body.message) &&
          bunnyWebhookResponse.body.message.length > 0),
    ).toBe(true);

    const thumbnailResponse = await request(app.getHttpServer())
      .get("/api/file/thumbnail")
      .expect(400);
    expect(
      typeof thumbnailResponse.body.message === "string" ||
        (Array.isArray(thumbnailResponse.body.message) &&
          thumbnailResponse.body.message.length > 0),
    ).toBe(true);
  });
});
