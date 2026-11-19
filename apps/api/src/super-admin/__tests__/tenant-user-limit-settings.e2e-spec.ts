import { faker } from "@faker-js/faker";
import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { inArray } from "drizzle-orm";
import request from "supertest";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { tenants } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { issueIntegrationKey } from "../../../test/helpers/integration-keys";
import {
  arrangeStudents,
  arrangeTenantWithActiveUsers,
  makeTenantManaging,
  resetTenantUserLimit,
  setTenantUserLimit,
} from "../../../test/helpers/tenant-user-limit";
import { truncateAllTables } from "../../../test/helpers/test-helpers";

import {
  INVALID_USER_LIMIT_SCENARIOS,
  STARTING_USER_LIMIT,
  USER_LIMIT_UPDATE_SCENARIOS,
} from "./tenant-user-limit-settings.scenarios";

import type {
  SignedInUser,
  TenantUserLimitTestContext,
} from "../../../test/helpers/tenant-user-limit";
import type { INestApplication } from "@nestjs/common";
import type { UUIDType } from "src/common";

describe("Tenant user limit settings (e2e)", () => {
  let app: INestApplication;
  let context: TenantUserLimitTestContext;
  let createdTenantIds: UUIDType[] = [];

  const arrangeSuperAdmin = async (): Promise<SignedInUser> => {
    const { admin } = await arrangeTenantWithActiveUsers(context, 1);
    await makeTenantManaging(context);

    return admin;
  };

  const updateTenant = (superAdmin: SignedInUser, payload: object) =>
    request(app.getHttpServer())
      .patch(`/api/super-admin/tenants/${context.tenantId}`)
      .set("Cookie", superAdmin.cookie)
      .send(payload);

  const getTenant = async (superAdmin: SignedInUser) => {
    const response = await request(app.getHttpServer())
      .get(`/api/super-admin/tenants/${context.tenantId}`)
      .set("Cookie", superAdmin.cookie)
      .expect(200);

    return response.body.data;
  };

  const resetTenant = async () => {
    await context.runAsTenant(context.tenantId, () =>
      truncateAllTables(context.dbAdmin, context.db),
    );
    await resetTenantUserLimit(context);
  };

  beforeAll(async () => {
    const e2eTest = await createE2ETest({ useDbProxy: true });
    app = e2eTest.app;
    context = {
      app,
      db: app.get(DB),
      dbAdmin: app.get(DB_ADMIN),
      tenantId: e2eTest.defaultTenantId,
      runAsTenant: e2eTest.runAsTenant,
    };
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(resetTenant);

  afterEach(async () => {
    if (createdTenantIds.length) {
      await context.dbAdmin.delete(tenants).where(inArray(tenants.id, createdTenantIds));
      createdTenantIds = [];
    }

    await resetTenant();
  });

  it("stores the user limit given when a tenant is created", async () => {
    const superAdmin = await arrangeSuperAdmin();

    const response = await request(app.getHttpServer())
      .post("/api/super-admin/tenants")
      .set("Cookie", superAdmin.cookie)
      .send({
        name: faker.company.name(),
        host: `https://${faker.string.alphanumeric(12).toLowerCase()}.tenant.local`,
        adminEmail: faker.internet.email().toLowerCase(),
        adminFirstName: "First",
        adminLastName: "Admin",
        adminLanguage: SUPPORTED_LANGUAGES.EN,
        ...STARTING_USER_LIMIT,
      })
      .expect(201);
    createdTenantIds.push(response.body.data.id);

    expect(response.body.data).toMatchObject(STARTING_USER_LIMIT);
  });

  it.each(USER_LIMIT_UPDATE_SCENARIOS)("$behaviour", async ({ payload, expectedUserLimit }) => {
    const superAdmin = await arrangeSuperAdmin();
    await setTenantUserLimit(context, STARTING_USER_LIMIT);

    await updateTenant(superAdmin, payload).expect(200);

    expect(await getTenant(superAdmin)).toMatchObject(expectedUserLimit);
  });

  it.each(INVALID_USER_LIMIT_SCENARIOS)("rejects $invalidValue", async ({ payload }) => {
    const superAdmin = await arrangeSuperAdmin();
    await setTenantUserLimit(context, STARTING_USER_LIMIT);

    await updateTenant(superAdmin, payload).expect(400);

    expect(await getTenant(superAdmin)).toMatchObject(STARTING_USER_LIMIT);
  });

  it("shows how many users count towards the limit", async () => {
    const superAdmin = await arrangeSuperAdmin();
    await arrangeStudents(context, 2);
    await arrangeStudents(context, 2, { archived: true });
    await arrangeStudents(context, 1, { deletedAt: new Date().toISOString() });

    expect(await getTenant(superAdmin)).toMatchObject({ activeUsersCount: 3 });
  });

  it("lists the tenant's user limit for integrations", async () => {
    const { apiKey } = await issueIntegrationKey({
      app,
      dbAdmin: context.dbAdmin,
      isManaging: false,
    });
    await setTenantUserLimit(context, STARTING_USER_LIMIT);

    const response = await request(app.getHttpServer())
      .get("/api/integration/tenants")
      .set("X-API-Key", apiKey)
      .expect(200);

    expect(response.body.data).toEqual([
      expect.objectContaining({ id: context.tenantId, ...STARTING_USER_LIMIT }),
    ]);
  });
});
