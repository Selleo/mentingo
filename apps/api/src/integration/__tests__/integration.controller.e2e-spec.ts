import { randomUUID } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";
import request from "supertest";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { integrationApiKeys, tenants } from "src/storage/schema";
import { USER_ROLES } from "src/user/schemas/userRoles";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createGroupFactory } from "../../../test/factory/group.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateAllTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("IntegrationController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;
  let groupFactory: ReturnType<typeof createGroupFactory>;

  const password = "Password123@@";
  const uniqueTenantHost = (prefix: string) => `https://${prefix}-${randomUUID()}.local`;

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();

    app = testApp;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    userFactory = createUserFactory(db);
    settingsFactory = createSettingsFactory(db);
    groupFactory = createGroupFactory(db);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await settingsFactory.create({ userId: null });
  });

  afterEach(async () => {
    await truncateAllTables(dbAdmin, db);
  });

  describe("integration key management", () => {
    it("returns 401 for rotate key when user is not authenticated", async () => {
      await request(app.getHttpServer()).post("/api/integration/key").expect(401);
    });

    it("returns null current key for admin before first key generation", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: USER_ROLES.ADMIN });
      const cookies = await cookieFor(admin, app);

      const response = await request(app.getHttpServer())
        .get("/api/integration/key")
        .set("Cookie", cookies)
        .expect(200);

      expect(response.body.data.key).toBeNull();
    });

    it("generates raw key once and stores only hash/prefix in database", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: USER_ROLES.ADMIN });
      const cookies = await cookieFor(admin, app);

      const response = await request(app.getHttpServer())
        .post("/api/integration/key")
        .set("Cookie", cookies)
        .expect(201);

      const rawKey = response.body.data.key as string;
      expect(rawKey).toMatch(/^itgk_[A-Za-z0-9_-]+$/);
      expect(response.body.data.metadata.keyPrefix).toBe(rawKey.slice(0, 16));

      const [storedKey] = await db
        .select()
        .from(integrationApiKeys)
        .where(
          and(
            eq(integrationApiKeys.createdByUserId, admin.id),
            isNull(integrationApiKeys.revokedAt),
          ),
        )
        .limit(1);

      expect(storedKey).toBeDefined();
      expect(storedKey.keyPrefix).toBe(rawKey.slice(0, 16));
      expect(storedKey.keyHash).toHaveLength(64);
      expect(storedKey.keyHash).not.toBe(rawKey);
    });
  });

  describe("integration groups endpoint", () => {
    it("returns 401 when X-API-Key header is missing", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/integration/groups")
        .expect(401);

      expect(response.body.message).toBe("integrationApiKey.errors.missingApiKeyHeader");
    });

    it("returns paginated groups for valid key", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: USER_ROLES.ADMIN });
      const cookies = await cookieFor(admin, app);
      const group = await groupFactory.create();

      const rotateResponse = await request(app.getHttpServer())
        .post("/api/integration/key")
        .set("Cookie", cookies)
        .expect(201);

      const apiKey = rotateResponse.body.data.key as string;

      const response = await request(app.getHttpServer())
        .get("/api/integration/groups")
        .set("X-API-Key", apiKey)
        .set("X-Tenant-Id", admin.tenantId)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe(group.id);
      expect(response.body.data[0].name).toBe(group.name);
      expect(response.body.pagination.totalItems).toBe(1);
    });

    it("returns 401 when X-Tenant-Id header is missing for non-tenant-list endpoint", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: USER_ROLES.ADMIN });
      const cookies = await cookieFor(admin, app);

      const rotateResponse = await request(app.getHttpServer())
        .post("/api/integration/key")
        .set("Cookie", cookies)
        .expect(201);
      const apiKey = rotateResponse.body.data.key as string;

      const response = await request(app.getHttpServer())
        .get("/api/integration/groups")
        .set("X-API-Key", apiKey)
        .expect(401);

      expect(response.body.message).toBe("integrationApiKey.errors.missingTenantIdHeader");
    });

    it("rejects old key after rotation override", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: USER_ROLES.ADMIN });
      const cookies = await cookieFor(admin, app);

      const firstRotateResponse = await request(app.getHttpServer())
        .post("/api/integration/key")
        .set("Cookie", cookies)
        .expect(201);
      const oldKey = firstRotateResponse.body.data.key as string;

      await request(app.getHttpServer())
        .post("/api/integration/key")
        .set("Cookie", cookies)
        .expect(201);

      const response = await request(app.getHttpServer())
        .get("/api/integration/groups")
        .set("X-API-Key", oldKey)
        .set("X-Tenant-Id", admin.tenantId)
        .expect(401);

      expect(response.body.message).toBe("integrationApiKey.errors.invalidApiKey");
    });

    it("returns only own tenant for non-managing admin", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: USER_ROLES.ADMIN });
      const cookies = await cookieFor(admin, app);

      await dbAdmin
        .update(tenants)
        .set({ isManaging: false })
        .where(eq(tenants.id, admin.tenantId));

      await dbAdmin.insert(tenants).values({
        name: "Another Tenant",
        host: uniqueTenantHost("another-tenant"),
      });

      const rotateResponse = await request(app.getHttpServer())
        .post("/api/integration/key")
        .set("Cookie", cookies)
        .expect(201);
      const apiKey = rotateResponse.body.data.key as string;

      const response = await request(app.getHttpServer())
        .get("/api/integration/tenants")
        .set("X-API-Key", apiKey)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toEqual(
        expect.objectContaining({
          id: admin.tenantId,
          name: expect.any(String),
          host: expect.any(String),
        }),
      );
    });

    it("returns all tenants for managing admin", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: USER_ROLES.ADMIN });
      const cookies = await cookieFor(admin, app);

      await dbAdmin.update(tenants).set({ isManaging: true }).where(eq(tenants.id, admin.tenantId));

      await dbAdmin.insert(tenants).values({
        name: "Selectable Tenant",
        host: uniqueTenantHost("selectable-tenant"),
      });

      const rotateResponse = await request(app.getHttpServer())
        .post("/api/integration/key")
        .set("Cookie", cookies)
        .expect(201);
      const apiKey = rotateResponse.body.data.key as string;

      const response = await request(app.getHttpServer())
        .get("/api/integration/tenants")
        .set("X-API-Key", apiKey)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(1);
    });

    it("returns 403 when non-managing admin uses another tenant id", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: USER_ROLES.ADMIN });
      const cookies = await cookieFor(admin, app);

      await dbAdmin
        .update(tenants)
        .set({ isManaging: false })
        .where(eq(tenants.id, admin.tenantId));

      const [{ id: otherTenantId }] = await dbAdmin
        .insert(tenants)
        .values({
          name: "Other Tenant",
          host: uniqueTenantHost("other-tenant"),
        })
        .returning({ id: tenants.id });

      const rotateResponse = await request(app.getHttpServer())
        .post("/api/integration/key")
        .set("Cookie", cookies)
        .expect(201);
      const apiKey = rotateResponse.body.data.key as string;

      const response = await request(app.getHttpServer())
        .get("/api/integration/groups")
        .set("X-API-Key", apiKey)
        .set("X-Tenant-Id", otherTenantId)
        .expect(403);

      expect(response.body.message).toBe("integrationApiKey.errors.crossTenantAccessForbidden");
    });

    it("allows managing admin to use another tenant id", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: USER_ROLES.ADMIN });
      const cookies = await cookieFor(admin, app);

      await dbAdmin.update(tenants).set({ isManaging: true }).where(eq(tenants.id, admin.tenantId));

      const [{ id: otherTenantId }] = await dbAdmin
        .insert(tenants)
        .values({
          name: "Managed Target Tenant",
          host: uniqueTenantHost("managed-target-tenant"),
        })
        .returning({ id: tenants.id });

      const rotateResponse = await request(app.getHttpServer())
        .post("/api/integration/key")
        .set("Cookie", cookies)
        .expect(201);
      const apiKey = rotateResponse.body.data.key as string;

      await request(app.getHttpServer())
        .get("/api/integration/groups")
        .set("X-API-Key", apiKey)
        .set("X-Tenant-Id", otherTenantId)
        .expect(200);
    });
  });
});
