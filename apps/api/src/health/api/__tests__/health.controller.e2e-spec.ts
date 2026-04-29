import request from "supertest";

import { createE2ETest } from "../../../../test/create-e2e-test";

import type { INestApplication } from "@nestjs/common";

describe("HealthController (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();
    app = testApp;
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 200 for healthy server", async () => {
    await request(app.getHttpServer()).get("/api/healthcheck").expect(200);
  });
});
