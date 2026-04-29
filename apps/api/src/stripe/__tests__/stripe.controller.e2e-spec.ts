import request from "supertest";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { truncateAllTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("StripeController (e2e)", () => {
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

  it("returns 401 for protected stripe endpoints when unauthenticated", async () => {
    await request(app.getHttpServer())
      .post("/api/stripe?amount=100&currency=usd&customerId=00000000-0000-0000-0000-000000000000&courseId=00000000-0000-0000-0000-000000000000")
      .expect(401);

    await request(app.getHttpServer())
      .post("/api/stripe/checkout-session")
      .send({
        courseId: "00000000-0000-0000-0000-000000000000",
        promoCode: null,
      })
      .expect(401);

    await request(app.getHttpServer()).get("/api/stripe/promotion-codes").expect(401);
    await request(app.getHttpServer()).get("/api/stripe/promotion-code/test").expect(401);
    await request(app.getHttpServer()).post("/api/stripe/promotion-code").send({}).expect(401);
    await request(app.getHttpServer())
      .patch("/api/stripe/promotion-code/test")
      .send({})
      .expect(401);
  });

  it("reaches public webhook endpoint", async () => {
    const response = await request(app.getHttpServer()).post("/api/stripe/webhook").send({});

    expect(response.status).toBe(201);
    expect(response.body).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          clientSecret: 22,
        }),
      }),
    );
  });
});
