import request from "supertest";

import { createE2ETest } from "../../../test/create-e2e-test";

import type { INestApplication } from "@nestjs/common";

describe("HealthController (e2e)", () => {
  let app: INestApplication;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const { app: testApp, cleanup: testCleanup } = await createE2ETest();
    app = testApp;
    cleanup = testCleanup;
  });

  afterAll(async () => {
    await app.close();
    await cleanup();
  });

  describe("GET /healthcheck", () => {
    it("should return 200 for healthy server", async () => {
      const response = await request(app.getHttpServer()).get("/api/healthcheck");

      expect(response.status).toBe(200);
    });
  });
});
