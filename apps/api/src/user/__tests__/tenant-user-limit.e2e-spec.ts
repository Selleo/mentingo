import { faker } from "@faker-js/faker";
import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { and, count, eq, inArray, isNull } from "drizzle-orm";
import request from "supertest";
import { match } from "ts-pattern";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { users } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import {
  arrangeStudents,
  arrangeTenantWithActiveUsers,
  resetTenantUserLimit,
  setTenantUserLimit,
  TENANT_USER_LIMIT_TEST_PASSWORD,
} from "../../../test/helpers/tenant-user-limit";
import { truncateAllTables } from "../../../test/helpers/test-helpers";

import {
  USER_ADDITION_METHOD_SCENARIOS,
  USER_ADDITION_METHODS,
  USER_ADDITION_OUTCOMES,
  USER_LIMIT_ERROR_MESSAGE,
  USER_LIMIT_SCENARIOS,
} from "./tenant-user-limit.scenarios";

import type {
  SignedInUser,
  TenantUserLimitTestContext,
} from "../../../test/helpers/tenant-user-limit";
import type { INestApplication } from "@nestjs/common";
import type { Response } from "supertest";

type UserAdditionMethod = (typeof USER_ADDITION_METHODS)[keyof typeof USER_ADDITION_METHODS];
type UserAdditionOutcome = (typeof USER_ADDITION_OUTCOMES)[keyof typeof USER_ADDITION_OUTCOMES];

describe("Tenant user limit (e2e)", () => {
  let app: INestApplication;
  let context: TenantUserLimitTestContext;

  const newUserDetails = () => ({
    email: faker.internet.email().toLowerCase(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
  });

  const buildUsersCsv = (emails: string[]) =>
    Buffer.from(
      [
        "email,firstName,lastName,role",
        ...emails.map((email) => `${email},Imported,User,${SYSTEM_ROLE_SLUGS.STUDENT}`),
      ].join("\n"),
    );

  const createUserAsAdmin = (admin: SignedInUser) =>
    request(app.getHttpServer())
      .post("/api/user")
      .set("Cookie", admin.cookie)
      .send({ ...newUserDetails(), roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT] });

  const importUsers = (admin: SignedInUser, emails: string[]) =>
    request(app.getHttpServer())
      .post("/api/user/import")
      .set("Cookie", admin.cookie)
      .attach("usersFile", buildUsersCsv(emails), {
        filename: "users.csv",
        contentType: "text/csv",
      });

  const registerUser = () =>
    request(app.getHttpServer())
      .post("/api/auth/register")
      .send({ ...newUserDetails(), password: TENANT_USER_LIMIT_TEST_PASSWORD, language: "en" });

  const unarchiveUser = async (admin: SignedInUser) => {
    const [archivedStudent] = await arrangeStudents(context, 1, { archived: true });

    return request(app.getHttpServer())
      .patch("/api/user/admin")
      .query({ id: archivedStudent.id })
      .set("Cookie", admin.cookie)
      .send({ archived: false });
  };

  const addUserThrough = (method: UserAdditionMethod, admin: SignedInUser): Promise<Response> =>
    match(method)
      .with(USER_ADDITION_METHODS.ADMIN_CREATE, () => createUserAsAdmin(admin))
      .with(USER_ADDITION_METHODS.REGISTRATION, () => registerUser())
      .with(USER_ADDITION_METHODS.IMPORT, () => importUsers(admin, [newUserDetails().email]))
      .with(USER_ADDITION_METHODS.UNARCHIVE, () => unarchiveUser(admin))
      .exhaustive();

  const countActiveUsers = async () => {
    const [{ activeUsersCount }] = await context.dbAdmin
      .select({ activeUsersCount: count() })
      .from(users)
      .where(
        and(
          eq(users.tenantId, context.tenantId),
          eq(users.archived, false),
          isNull(users.deletedAt),
        ),
      );

    return activeUsersCount;
  };

  const expectAdditionOutcome = (response: Response, outcome: UserAdditionOutcome) =>
    match(outcome)
      .with(USER_ADDITION_OUTCOMES.ACCEPTED, () => expect([200, 201]).toContain(response.status))
      .with(USER_ADDITION_OUTCOMES.REJECTED, () =>
        expect(response).toMatchObject({
          status: 409,
          body: { message: USER_LIMIT_ERROR_MESSAGE },
        }),
      )
      .exhaustive();

  const expectedActiveUsersCount = (activeUsersCount: number, outcome: UserAdditionOutcome) =>
    match(outcome)
      .with(USER_ADDITION_OUTCOMES.ACCEPTED, () => activeUsersCount + 1)
      .with(USER_ADDITION_OUTCOMES.REJECTED, () => activeUsersCount)
      .exhaustive();

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
  afterEach(resetTenant);

  it.each(USER_LIMIT_SCENARIOS)(
    "$behaviour",
    async ({ maxUsers, maxUsersOverflowPercentage, activeUsersCount, outcome }) => {
      const { admin } = await arrangeTenantWithActiveUsers(context, activeUsersCount);
      await setTenantUserLimit(context, { maxUsers, maxUsersOverflowPercentage });

      const response = await createUserAsAdmin(admin);

      expectAdditionOutcome(response, outcome);
      expect(await countActiveUsers()).toBe(expectedActiveUsersCount(activeUsersCount, outcome));
    },
  );

  it.each(USER_ADDITION_METHOD_SCENARIOS)(
    "$outcome a user added through $method with $activeUsersCount of $maxUsers slots taken",
    async ({ method, maxUsers, activeUsersCount, outcome }) => {
      const { admin } = await arrangeTenantWithActiveUsers(context, activeUsersCount);
      await setTenantUserLimit(context, { maxUsers, maxUsersOverflowPercentage: 0 });

      const response = await addUserThrough(method, admin);

      expectAdditionOutcome(response, outcome);
      expect(await countActiveUsers()).toBe(expectedActiveUsersCount(activeUsersCount, outcome));
    },
  );

  it("does not count archived or deleted users towards the limit", async () => {
    const { admin } = await arrangeTenantWithActiveUsers(context, 1);
    await arrangeStudents(context, 3, { archived: true });
    await arrangeStudents(context, 3, { deletedAt: new Date().toISOString() });
    await setTenantUserLimit(context, { maxUsers: 2, maxUsersOverflowPercentage: 0 });

    const response = await createUserAsAdmin(admin);

    expectAdditionOutcome(response, USER_ADDITION_OUTCOMES.ACCEPTED);
    expect(await countActiveUsers()).toBe(2);
  });

  it("adds none of an import that does not fit the remaining slots", async () => {
    const { admin } = await arrangeTenantWithActiveUsers(context, 1);
    await setTenantUserLimit(context, { maxUsers: 3, maxUsersOverflowPercentage: 0 });
    const importedEmails = [newUserDetails().email, newUserDetails().email, newUserDetails().email];

    const response = await importUsers(admin, importedEmails);

    expectAdditionOutcome(response, USER_ADDITION_OUTCOMES.REJECTED);
    expect(
      await context.dbAdmin
        .select({ email: users.email })
        .from(users)
        .where(inArray(users.email, importedEmails)),
    ).toEqual([]);
  });

  it("lets only one of two simultaneous users take the last slot", async () => {
    const { admin } = await arrangeTenantWithActiveUsers(context, 2);
    await setTenantUserLimit(context, { maxUsers: 3, maxUsersOverflowPercentage: 0 });

    const responses = await Promise.all([createUserAsAdmin(admin), createUserAsAdmin(admin)]);

    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(await countActiveUsers()).toBe(3);
  });
});
