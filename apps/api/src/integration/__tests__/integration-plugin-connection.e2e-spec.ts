import { randomUUID, createHmac } from "node:crypto";
import { createServer } from "node:http";

import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { eq } from "drizzle-orm";
import request from "supertest";

import { EnvService } from "src/env/services/env.service";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { tenants, secrets } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateAllTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("plugin connection (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;
  const password = "Password123@@";
  const uniqueTenantHost = (prefix: string) => `https://${prefix}-${randomUUID()}.local`;
  beforeAll(async () => {
    const context = await createE2ETest({ useDbProxy: true });
    app = context.app;
    db = context.db;
    dbAdmin = context.dbAdmin;
    userFactory = createUserFactory(dbAdmin);
    settingsFactory = createSettingsFactory(dbAdmin);
  });
  afterAll(async () => {
    if (app) await app.close();
  });
  beforeEach(async () => {
    await settingsFactory.create({ userId: null });
  });
  afterEach(async () => {
    await truncateAllTables(dbAdmin, db);
  });
  const createApiKey = async ({ isManaging }: { isManaging: boolean }) => {
    const admin = await userFactory
      .withCredentials({ password })
      .withAdminSettings(dbAdmin)
      .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
    const cookies = await cookieFor(admin, app);
    await dbAdmin.update(tenants).set({ isManaging }).where(eq(tenants.id, admin.tenantId));
    const response = await request(app.getHttpServer())
      .post("/api/integration/key")
      .set("Cookie", cookies)
      .expect(201);
    return { admin, apiKey: response.body.data.key as string };
  };
  describe("plugin connection", () => {
    const body = {
      baseUrl: "https://plugins.example.test",
      apiKey: "test-plugin-key-".repeat(4),
      webhookSecret: "test-webhook-secret-".repeat(3),
    };
    it("discovers tenants and permission, then atomically saves encrypted settings to the path tenant", async () => {
      const { apiKey, admin } = await createApiKey({ isManaging: true });
      const [{ id }] = await dbAdmin
        .insert(tenants)
        .values({ name: "Plugin tenant", host: uniqueTenantHost("plugin") })
        .returning({ id: tenants.id });
      const discovery = await request(app.getHttpServer())
        .get("/api/integration/plugins/connection")
        .set("X-API-Key", apiKey)
        .expect(200);
      expect(discovery.body.data.canConfigurePlugins).toBe(true);
      expect(discovery.body.data.tenants).toEqual(
        expect.arrayContaining([expect.objectContaining({ id })]),
      );
      const response = await request(app.getHttpServer())
        .put(`/api/integration/tenants/${id}/plugins/phishing`)
        .set("X-API-Key", apiKey)
        .set("X-Tenant-Id", admin.tenantId)
        .send(body)
        .expect(200);
      expect(response.body).toEqual({ data: { tenantId: id } });
      const stored = await dbAdmin.select().from(secrets).where(eq(secrets.tenantId, id));
      expect(stored.map((row) => row.secretName).sort()).toEqual([
        "PHISHING_API_KEY",
        "PHISHING_BASE_URL",
        "PHISHING_WEBHOOK_SECRET",
      ]);
      expect(JSON.stringify(stored)).not.toContain(body.apiKey);
      const env = app.get(EnvService),
        runner = app.get(TenantDbRunnerService);
      await expect(runner.runWithTenant(id, () => env.getEnv("PHISHING_API_KEY"))).resolves.toEqual(
        { name: "PHISHING_API_KEY", value: body.apiKey },
      );
      const ownerSecrets = await dbAdmin
        .select()
        .from(secrets)
        .where(eq(secrets.tenantId, admin.tenantId));
      expect(ownerSecrets.some((row) => row.secretName.startsWith("PHISHING_"))).toBe(false);
    });
    it("checks Mentingo-to-plugin authentication and validates a signed callback without enrollment", async () => {
      const { apiKey, admin } = await createApiKey({ isManaging: true });
      const [{ id }] = await dbAdmin
        .insert(tenants)
        .values({ name: "Verified plugin tenant", host: uniqueTenantHost("plugin-verify") })
        .returning({ id: tenants.id });
      const seen: { key?: string; tenant?: string }[] = [];
      const plugin = createServer((req, res) => {
        seen.push({ key: req.headers.authorization, tenant: String(req.headers["x-tenant-id"]) });
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ capabilities: { phishingSimulation: { enabled: true } } }));
      });
      await new Promise<void>((resolve) => plugin.listen(0, "127.0.0.1", resolve));
      try {
        const address = plugin.address();
        if (!address || typeof address === "string") throw new Error("Test server has no address");
        await request(app.getHttpServer())
          .put(`/api/integration/tenants/${id}/plugins/phishing`)
          .set("X-API-Key", apiKey)
          .send({ ...body, baseUrl: `http://127.0.0.1:${address.port}` })
          .expect(200);
        const status = await request(app.getHttpServer())
          .get(`/api/integration/tenants/${id}/plugins/phishing`)
          .set("X-API-Key", apiKey)
          .set("X-Tenant-Id", admin.tenantId)
          .expect(200);
        expect(status.body.data).toEqual({ tenantId: id, reachable: true, enabled: true });
        expect(seen).toEqual([{ key: `Bearer ${body.apiKey}`, tenant: id }]);
        const nonce = "a".repeat(32),
          timestamp = String(Math.floor(Date.now() / 1000));
        const payload = JSON.stringify({ tenantId: id, nonce });
        const signature = createHmac("sha256", body.webhookSecret)
          .update(timestamp + ".")
          .update(payload)
          .digest("hex");
        const probe = await request(app.getHttpServer())
          .post("/api/phishing/webhook/probe")
          .set("Content-Type", "application/json")
          .set("X-Phishing-Timestamp", timestamp)
          .set("X-Phishing-Signature", signature)
          .send(payload)
          .expect(201);
        expect(probe.body.data).toEqual({ nonce });
        await request(app.getHttpServer())
          .post("/api/phishing/webhook/probe")
          .set("Content-Type", "application/json")
          .set("X-Phishing-Timestamp", timestamp)
          .set("X-Phishing-Signature", "0".repeat(64))
          .send(payload)
          .expect(401);
        expect(seen).toHaveLength(1);
      } finally {
        await new Promise<void>((resolve, reject) =>
          plugin.close((error) => (error ? reject(error) : resolve())),
        );
      }
    });

    it("rolls back all three settings if publishing the configuration event fails", async () => {
      const { apiKey } = await createApiKey({ isManaging: true });
      const [{ id }] = await dbAdmin
        .insert(tenants)
        .values({ name: "Rollback plugin tenant", host: uniqueTenantHost("plugin-rollback") })
        .returning({ id: tenants.id });
      const publisher = app.get(OutboxPublisher);
      const failure = jest
        .spyOn(publisher, "publish")
        .mockRejectedValueOnce(new Error("test-only outbox failure"));
      try {
        await request(app.getHttpServer())
          .put(`/api/integration/tenants/${id}/plugins/phishing`)
          .set("X-API-Key", apiKey)
          .send(body)
          .expect(500);
        expect(await dbAdmin.select().from(secrets).where(eq(secrets.tenantId, id))).toHaveLength(
          0,
        );
      } finally {
        failure.mockRestore();
      }
    });
    it("lists only the owner's tenant and refuses configuration for a non-managing key", async () => {
      const { apiKey, admin } = await createApiKey({ isManaging: false });
      const discovery = await request(app.getHttpServer())
        .get("/api/integration/plugins/connection")
        .set("X-API-Key", apiKey)
        .expect(200);
      expect(discovery.body.data.canConfigurePlugins).toBe(false);
      expect(discovery.body.data.tenants.map((tenant: { id: string }) => tenant.id)).toEqual([
        admin.tenantId,
      ]);
      await request(app.getHttpServer())
        .put(`/api/integration/tenants/${admin.tenantId}/plugins/phishing`)
        .set("X-API-Key", apiKey)
        .send(body)
        .expect(404);
    });
  });
});
