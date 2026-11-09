import { faker } from "@faker-js/faker";
import {
  PERMISSIONS,
  SYSTEM_ROLE_PERMISSIONS,
  SYSTEM_ROLE_SLUGS,
  SYSTEM_RULE_SET_SLUGS,
} from "@repo/shared";
import { and, eq, inArray, like } from "drizzle-orm";
import request from "supertest";

import { PermissionsBackfillService } from "src/permissions/permissions-backfill.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  permissionRoles,
  permissionRuleSetPermissions,
  permissionRuleSets,
} from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateAllTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("Reviewer role (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let tenantId: string;
  const password = "Password123@";

  beforeAll(async () => {
    const context = await createE2ETest();
    app = context.app;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    tenantId = context.defaultTenantId;
  });

  afterEach(async () => {
    await truncateAllTables(baseDb, db);
  });

  afterAll(async () => {
    await app.close();
  });

  const createUser = async (
    roleSlug: (typeof SYSTEM_ROLE_SLUGS)[keyof typeof SYSTEM_ROLE_SLUGS],
  ) => {
    const user = await createUserFactory(db)
      .withCredentials({ password })
      .create({ roleSlug, tenantId, email: `${roleSlug}-${faker.string.uuid()}@example.com` });
    await createSettingsFactory(db, user.id, roleSlug === SYSTEM_ROLE_SLUGS.ADMIN).create();
    return user;
  };

  it("grants only self-service and grading permissions", async () => {
    const reviewer = await createUser(SYSTEM_ROLE_SLUGS.REVIEWER);

    const response = await request(app.getHttpServer())
      .get("/api/auth/current-user")
      .set("Cookie", await cookieFor(reviewer, app))
      .expect(200);

    expect(response.body.data.roleSlugs).toEqual([SYSTEM_ROLE_SLUGS.REVIEWER]);
    expect([...response.body.data.permissions].sort()).toEqual(
      [
        PERMISSIONS.ACCOUNT_READ_SELF,
        PERMISSIONS.ACCOUNT_UPDATE_SELF,
        PERMISSIONS.USER_READ_SELF,
        PERMISSIONS.SETTINGS_READ_SELF,
        PERMISSIONS.SETTINGS_UPDATE_SELF,
        PERMISSIONS.ENV_READ_PUBLIC,
        PERMISSIONS.QUIZ_GRADING_READ,
        PERMISSIONS.QUIZ_GRADING_GRADE,
      ].sort(),
    );
  });

  it("gives admins the grading permissions", async () => {
    const admin = await createUser(SYSTEM_ROLE_SLUGS.ADMIN);

    const response = await request(app.getHttpServer())
      .get("/api/auth/current-user")
      .set("Cookie", await cookieFor(admin, app))
      .expect(200);

    expect(response.body.data.permissions).toEqual(
      expect.arrayContaining([PERMISSIONS.QUIZ_GRADING_READ, PERMISSIONS.QUIZ_GRADING_GRADE]),
    );
  });

  it("forbids reviewers from managing courses, users, enrollments and groups", async () => {
    const reviewer = await createUser(SYSTEM_ROLE_SLUGS.REVIEWER);
    const cookie = await cookieFor(reviewer, app);
    const server = app.getHttpServer();
    const courseId = faker.string.uuid();

    await request(server).get("/api/course/all").set("Cookie", cookie).expect(403);
    await request(server).post("/api/course").set("Cookie", cookie).send({}).expect(403);
    await request(server).get(`/api/course/${courseId}/students`).set("Cookie", cookie).expect(403);
    await request(server).get("/api/user/all").set("Cookie", cookie).expect(403);
    await request(server).get("/api/group/all").set("Cookie", cookie).expect(403);
    await request(server).post("/api/group").set("Cookie", cookie).send({}).expect(403);
  });

  it("lets admins assign and remove the reviewer role", async () => {
    const admin = await createUser(SYSTEM_ROLE_SLUGS.ADMIN);
    const user = await createUser(SYSTEM_ROLE_SLUGS.STUDENT);
    const cookie = await cookieFor(admin, app);
    const server = app.getHttpServer();

    const roles = await request(server).get("/api/user/roles").set("Cookie", cookie).expect(200);
    expect(roles.body.data.map((role: { slug: string }) => role.slug)).toContain(
      SYSTEM_ROLE_SLUGS.REVIEWER,
    );

    const setRoles = async (roleSlugs: string[]) => {
      await request(server)
        .patch("/api/user/bulk/roles")
        .set("Cookie", cookie)
        .send({ userIds: [user.id], roleSlugs })
        .expect(200);

      const response = await request(server)
        .get(`/api/user?id=${user.id}`)
        .set("Cookie", cookie)
        .expect(200);

      return response.body.data.roleSlugs;
    };

    expect(await setRoles([SYSTEM_ROLE_SLUGS.REVIEWER])).toEqual([SYSTEM_ROLE_SLUGS.REVIEWER]);
    expect(await setRoles([SYSTEM_ROLE_SLUGS.STUDENT])).toEqual([SYSTEM_ROLE_SLUGS.STUDENT]);
  });

  it("adds the reviewer role and admin grading permissions to existing tenants on backfill", async () => {
    const reviewerRuleSet = SYSTEM_RULE_SET_SLUGS[SYSTEM_ROLE_SLUGS.REVIEWER];
    const adminRuleSet = SYSTEM_RULE_SET_SLUGS[SYSTEM_ROLE_SLUGS.ADMIN];
    // Creating any user ensures the tenant's system roles exist before we strip them.
    await createUser(SYSTEM_ROLE_SLUGS.STUDENT);

    // Simulate a tenant created before the reviewer role existed.
    await baseDb
      .delete(permissionRoles)
      .where(
        and(
          eq(permissionRoles.tenantId, tenantId),
          eq(permissionRoles.slug, SYSTEM_ROLE_SLUGS.REVIEWER),
        ),
      );
    await baseDb
      .delete(permissionRuleSets)
      .where(
        and(
          eq(permissionRuleSets.tenantId, tenantId),
          eq(permissionRuleSets.slug, reviewerRuleSet),
        ),
      );
    await baseDb.delete(permissionRuleSetPermissions).where(
      and(
        inArray(
          permissionRuleSetPermissions.ruleSetId,
          baseDb
            .select({ id: permissionRuleSets.id })
            .from(permissionRuleSets)
            .where(
              and(
                eq(permissionRuleSets.tenantId, tenantId),
                eq(permissionRuleSets.slug, adminRuleSet),
              ),
            ),
        ),
        like(permissionRuleSetPermissions.permission, "quiz_grading.%"),
      ),
    );

    await app.get(PermissionsBackfillService).backfillMissingPermissionsForAllTenants();

    // Read the DB directly: creating users would re-seed roles through the test helper.
    const permissionsOf = async (ruleSetSlug: string) =>
      (
        await baseDb
          .select({ permission: permissionRuleSetPermissions.permission })
          .from(permissionRuleSetPermissions)
          .innerJoin(
            permissionRuleSets,
            eq(permissionRuleSets.id, permissionRuleSetPermissions.ruleSetId),
          )
          .where(
            and(
              eq(permissionRuleSets.tenantId, tenantId),
              eq(permissionRuleSets.slug, ruleSetSlug),
            ),
          )
      ).map(({ permission }) => permission);
    const [reviewerRole] = await baseDb
      .select({ id: permissionRoles.id })
      .from(permissionRoles)
      .where(
        and(
          eq(permissionRoles.tenantId, tenantId),
          eq(permissionRoles.slug, SYSTEM_ROLE_SLUGS.REVIEWER),
        ),
      );

    expect(reviewerRole).toBeDefined();
    expect((await permissionsOf(reviewerRuleSet)).sort()).toEqual(
      [...SYSTEM_ROLE_PERMISSIONS[SYSTEM_ROLE_SLUGS.REVIEWER]].sort(),
    );
    expect(await permissionsOf(adminRuleSet)).toEqual(
      expect.arrayContaining([PERMISSIONS.QUIZ_GRADING_READ, PERMISSIONS.QUIZ_GRADING_GRADE]),
    );
  });
});
