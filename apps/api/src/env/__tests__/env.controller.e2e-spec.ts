import request from "supertest";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { truncateAllTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("EnvController (e2e)", () => {
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

  it("returns 401 for protected env endpoints when unauthenticated", async () => {
    await request(app.getHttpServer()).post("/api/env/bulk").send({ data: [] }).expect(401);
    await request(app.getHttpServer()).get("/api/env/config/setup").expect(401);
    await request(app.getHttpServer()).get("/api/env/STRIPE_SECRET_KEY").expect(401);
  });

  it("returns 200 for public env endpoints", async () => {
    const sso = await request(app.getHttpServer()).get("/api/env/frontend/sso").expect(200);
    expect(typeof sso.body.data).toBe("object");
    for (const provider of ["google", "microsoft", "slack"] as const) {
      if (provider in sso.body.data) {
        expect(typeof sso.body.data[provider]).toBe("string");
      }
    }

    const stripePk = await request(app.getHttpServer())
      .get("/api/env/stripe/publishable-key")
      .expect(200);
    expect("publishableKey" in stripePk.body.data).toBe(true);
    expect(
      stripePk.body.data.publishableKey === null ||
        typeof stripePk.body.data.publishableKey === "string",
    ).toBe(true);

    const stripeConfigured = await request(app.getHttpServer())
      .get("/api/env/frontend/stripe")
      .expect(200);
    expect(typeof stripeConfigured.body.data.enabled).toBe("boolean");

    const aiConfigured = await request(app.getHttpServer()).get("/api/env/ai").expect(200);
    expect(typeof aiConfigured.body.data.enabled).toBe("boolean");

    const lumaConfigured = await request(app.getHttpServer()).get("/api/env/luma").expect(200);
    expect(lumaConfigured.body.data).toEqual(
      expect.objectContaining({
        enabled: expect.any(Boolean),
        courseGenerationEnabled: expect.any(Boolean),
        voiceMentorEnabled: expect.any(Boolean),
      }),
    );
  });
});
