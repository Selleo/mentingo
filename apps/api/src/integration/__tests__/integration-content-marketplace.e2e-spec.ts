import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

import { eq } from "drizzle-orm";
import request from "supertest";

import { EnvService } from "src/env/services/env.service";
import { secrets } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { prepareSharingTenants } from "../../../test/helpers/course-sharing";
import { issueIntegrationKey } from "../../../test/helpers/integration-keys";
import { truncateAllTables } from "../../../test/helpers/test-helpers";

import {
  CONFIGURATION_PATH,
  INVALID_ORIGIN_CASES,
  MARKETPLACE_CONNECTION,
  MARKETPLACE_ORIGIN,
  REACHABLE_PLUGIN_CASES,
  UNREACHABLE_PLUGIN_CASES,
} from "./integration-content-marketplace.scenarios";

import type { RunAsTenant, SharingTenant } from "../../../test/helpers/course-sharing";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";

type PluginRequest = { path?: string; authorization?: string; tenantId?: string };

describe("Integration content marketplace connection (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let runAsTenant: RunAsTenant;
  let managingTenant: SharingTenant;
  let connectedTenant: SharingTenant;

  beforeAll(async () => {
    const e2e = await createE2ETest({ useDbProxy: true });

    app = e2e.app;
    db = e2e.db;
    dbAdmin = e2e.dbAdmin;
    runAsTenant = e2e.runAsTenant;
    ({ source: managingTenant, target: connectedTenant } = await prepareSharingTenants(
      dbAdmin,
      e2e.defaultTenantId,
    ));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAllTables(dbAdmin, db);
  });

  afterEach(async () => {
    await truncateAllTables(dbAdmin, db);
  });

  const issueManagingKey = () => issueIntegrationKey({ app, dbAdmin, isManaging: true });

  const saveConnection = (apiKey: string, tenantId: UUIDType, baseUrl: string) =>
    request(app.getHttpServer())
      .put(`/api/integration/tenants/${tenantId}/plugins/content-marketplace`)
      .set("X-API-Key", apiKey)
      .send({ ...MARKETPLACE_CONNECTION, baseUrl });

  const checkConnection = (apiKey: string, tenantId: UUIDType) =>
    request(app.getHttpServer())
      .get(`/api/integration/tenants/${tenantId}/plugins/content-marketplace`)
      .set("X-API-Key", apiKey);

  const readSecretNames = async (tenantId: UUIDType) =>
    (await dbAdmin.select().from(secrets).where(eq(secrets.tenantId, tenantId)))
      .map((secret) => secret.secretName)
      .sort();

  /** Serves a fixed configuration response the way the plugin would, and records each request. */
  const withFakePlugin = async (
    response: { status: number; body: unknown },
    useFakePlugin: (origin: string, requests: PluginRequest[]) => Promise<void>,
  ) => {
    const requests: PluginRequest[] = [];
    const plugin = createServer((req, res) => {
      requests.push({
        path: req.url,
        authorization: req.headers.authorization,
        tenantId: String(req.headers["x-tenant-id"]),
      });
      res.writeHead(response.status, { "content-type": "application/json" });
      res.end(JSON.stringify(response.body));
    });

    await new Promise<void>((resolve) => plugin.listen(0, "127.0.0.1", resolve));

    try {
      const address = plugin.address();
      if (!address || typeof address === "string") throw new Error("Fake plugin has no address");

      await useFakePlugin(`http://127.0.0.1:${address.port}`, requests);
    } finally {
      await new Promise<void>((resolve, reject) =>
        plugin.close((error) => (error ? reject(error) : resolve())),
      );
    }
  };

  it("saves the plugin origin and API key encrypted for the path tenant", async () => {
    const { apiKey } = await issueManagingKey();

    const response = await saveConnection(
      apiKey,
      connectedTenant.id,
      MARKETPLACE_CONNECTION.baseUrl,
    ).expect(200);
    const stored = await dbAdmin
      .select()
      .from(secrets)
      .where(eq(secrets.tenantId, connectedTenant.id));
    const envService = app.get(EnvService);
    const savedSettings = await runAsTenant(connectedTenant.id, async () => ({
      baseUrl: await envService.getEnv("CONTENT_MARKETPLACE_BASE_URL"),
      apiKey: await envService.getEnv("CONTENT_MARKETPLACE_API_KEY"),
    }));

    expect(response.body).toEqual({ data: { tenantId: connectedTenant.id } });
    expect(await readSecretNames(connectedTenant.id)).toEqual([
      "CONTENT_MARKETPLACE_API_KEY",
      "CONTENT_MARKETPLACE_BASE_URL",
    ]);
    expect(JSON.stringify(stored)).not.toContain(MARKETPLACE_CONNECTION.apiKey);
    expect(savedSettings).toEqual({
      baseUrl: { name: "CONTENT_MARKETPLACE_BASE_URL", value: MARKETPLACE_ORIGIN },
      apiKey: { name: "CONTENT_MARKETPLACE_API_KEY", value: MARKETPLACE_CONNECTION.apiKey },
    });
    expect(await readSecretNames(managingTenant.id)).toEqual([]);
  });

  it.each(INVALID_ORIGIN_CASES)("rejects a plugin URL that $reason", async ({ baseUrl }) => {
    const { apiKey } = await issueManagingKey();

    const response = await saveConnection(apiKey, connectedTenant.id, baseUrl).expect(400);

    expect(response.body).toMatchObject({
      message: "integrationApiKey.errors.invalidPluginOrigin",
    });
    expect(await readSecretNames(connectedTenant.id)).toEqual([]);
  });

  it.each(REACHABLE_PLUGIN_CASES)(
    "reports a reachable plugin with the marketplace enabled: $enabled",
    async ({ enabled, body }) => {
      const { apiKey } = await issueManagingKey();

      await withFakePlugin({ status: 200, body }, async (origin, requests) => {
        await saveConnection(apiKey, connectedTenant.id, origin).expect(200);

        const status = await checkConnection(apiKey, connectedTenant.id).expect(200);

        expect(status.body.data).toEqual({
          tenantId: connectedTenant.id,
          reachable: true,
          enabled,
        });
        expect(requests).toEqual([
          {
            path: CONFIGURATION_PATH,
            authorization: `Bearer ${MARKETPLACE_CONNECTION.apiKey}`,
            tenantId: connectedTenant.id,
          },
        ]);
      });
    },
  );

  it.each(UNREACHABLE_PLUGIN_CASES)(
    "reports the plugin as unreachable when it $reason",
    async ({ status, body }) => {
      const { apiKey } = await issueManagingKey();

      await withFakePlugin({ status, body }, async (origin) => {
        await saveConnection(apiKey, connectedTenant.id, origin).expect(200);

        const response = await checkConnection(apiKey, connectedTenant.id).expect(200);

        expect(response.body.data).toEqual({
          tenantId: connectedTenant.id,
          reachable: false,
          enabled: false,
        });
      });
    },
  );

  it("reports a tenant without a saved connection as unreachable", async () => {
    const { apiKey } = await issueManagingKey();

    const response = await checkConnection(apiKey, connectedTenant.id).expect(200);

    expect(response.body.data).toEqual({
      tenantId: connectedTenant.id,
      reachable: false,
      enabled: false,
    });
  });

  it("refuses a key from a tenant that is not managing", async () => {
    const { apiKey, admin } = await issueIntegrationKey({ app, dbAdmin, isManaging: false });

    const response = await saveConnection(
      apiKey,
      admin.tenantId,
      MARKETPLACE_CONNECTION.baseUrl,
    ).expect(404);

    expect(response.body).toMatchObject({
      message: "superAdminTenants.error.managingTenantRequired",
    });
    expect(await readSecretNames(admin.tenantId)).toEqual([]);
  });

  it("answers an unknown tenant with 404", async () => {
    const { apiKey } = await issueManagingKey();

    const response = await checkConnection(apiKey, randomUUID()).expect(404);

    expect(response.body).toMatchObject({ message: "superAdminTenants.error.notFound" });
  });
});
