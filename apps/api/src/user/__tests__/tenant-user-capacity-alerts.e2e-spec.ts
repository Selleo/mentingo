import { faker } from "@faker-js/faker";
import { ANNOUNCEMENT_SOURCE_TYPES, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { eq } from "drizzle-orm";
import request from "supertest";
import { match } from "ts-pattern";

import { EmailAdapter } from "src/common/emails/adapters/email.adapter";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { announcements, userAnnouncements } from "src/storage/schema";
import { ADMIN_USERS_PAGE_PATH } from "src/user/user.constants";
import { REALTIME_PUBLISHER } from "src/websocket/realtime.publisher";

import { createE2ETest } from "../../../test/create-e2e-test";
import { deliverPendingAutomationEmails } from "../../../test/helpers/automation-emails";
import {
  arrangeAdmin,
  arrangeTenantAdmin,
  arrangeTenantWithActiveUsers,
  makeTenantManaging,
  resetTenantUserLimit,
  setTenantUserLimit,
} from "../../../test/helpers/tenant-user-limit";
import { truncateAllTables } from "../../../test/helpers/test-helpers";
import { dispatchOutbox } from "../../../test/helpers/wait-for-outbox";

import {
  ALERT_TEST_USER_LIMIT,
  CAPACITY_ALERT_TITLES,
  CAPACITY_THRESHOLD_SCENARIOS,
  LIMIT_CHANGE_SCENARIOS,
  USER_REMOVAL_METHODS,
  USER_REMOVAL_SCENARIOS,
} from "./tenant-user-capacity-alerts.scenarios";

import type { UserWithCredentials } from "../../../test/factory/user.factory";
import type {
  SignedInUser,
  TenantUserLimit,
  TenantUserLimitTestContext,
} from "../../../test/helpers/tenant-user-limit";
import type { EmailTestingAdapter } from "../../../test/helpers/test-email.adapter";
import type { INestApplication } from "@nestjs/common";

type CapacityAlert = { id: string; title: string; content: string; linkPath: string | null };
type ExpectedCapacityAlert = { title: string; message: string };
type UserRemovalMethod = (typeof USER_REMOVAL_METHODS)[keyof typeof USER_REMOVAL_METHODS];

describe("Tenant user capacity alerts (e2e)", () => {
  let app: INestApplication;
  let context: TenantUserLimitTestContext;
  let emailAdapter: EmailTestingAdapter;

  const newUserDetails = () => ({
    email: faker.internet.email().toLowerCase(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
  });

  const createUsersAsAdmin = async (admin: SignedInUser, count: number) => {
    for (let index = 0; index < count; index++) {
      await request(app.getHttpServer())
        .post("/api/user")
        .set("Cookie", admin.cookie)
        .send({ ...newUserDetails(), roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT] })
        .expect(201);
    }

    await dispatchOutbox(app);
  };

  const importUsers = async (admin: SignedInUser, count: number) => {
    const rows = Array.from(
      { length: count },
      () => `${newUserDetails().email},Imported,User,${SYSTEM_ROLE_SLUGS.STUDENT}`,
    );

    await request(app.getHttpServer())
      .post("/api/user/import")
      .set("Cookie", admin.cookie)
      .attach("usersFile", Buffer.from(["email,firstName,lastName,role", ...rows].join("\n")), {
        filename: "users.csv",
        contentType: "text/csv",
      })
      .expect(201);

    await dispatchOutbox(app);
  };

  const removeUser = (admin: SignedInUser, user: UserWithCredentials, method: UserRemovalMethod) =>
    match(method)
      .with(USER_REMOVAL_METHODS.ARCHIVE, () =>
        request(app.getHttpServer())
          .patch("/api/user/bulk/archive")
          .set("Cookie", admin.cookie)
          .send({ userIds: [user.id] })
          .expect(200),
      )
      .with(USER_REMOVAL_METHODS.DELETE, () =>
        request(app.getHttpServer())
          .delete("/api/user")
          .set("Cookie", admin.cookie)
          .send({ userIds: [user.id] })
          .expect(200),
      )
      .exhaustive();

  const changeUserLimitAsSuperAdmin = async (admin: SignedInUser, userLimit: TenantUserLimit) => {
    await makeTenantManaging(context);

    await request(app.getHttpServer())
      .patch(`/api/super-admin/tenants/${context.tenantId}`)
      .set("Cookie", admin.cookie)
      .send(userLimit)
      .expect(200);

    await dispatchOutbox(app);
  };

  const getCapacityAlerts = async (admin: SignedInUser): Promise<CapacityAlert[]> => {
    const response = await request(app.getHttpServer())
      .get("/api/announcements/user/me")
      .query({ language: "en", perPage: 50 })
      .set("Cookie", admin.cookie)
      .expect(200);

    return (response.body.data as (CapacityAlert & { sourceType: string })[])
      .filter(({ sourceType }) => sourceType === ANNOUNCEMENT_SOURCE_TYPES.TENANT_USER_CAPACITY)
      .map(({ id, title, content, linkPath }) => ({ id, title, content, linkPath }));
  };

  const capacityAlertMatching = ({ title, message }: ExpectedCapacityAlert) => ({
    title,
    content: expect.stringContaining(message),
    linkPath: ADMIN_USERS_PAGE_PATH,
  });

  const findCapacityAlertRecipientIds = async () => {
    const recipients = await context.dbAdmin
      .select({ userId: userAnnouncements.userId })
      .from(userAnnouncements)
      .innerJoin(announcements, eq(announcements.id, userAnnouncements.announcementId))
      .where(eq(announcements.sourceType, ANNOUNCEMENT_SOURCE_TYPES.TENANT_USER_CAPACITY));

    return recipients.map(({ userId }) => userId).sort();
  };

  /** Leaves the tenant at 8 of 12 users, right after the "approaching" alert. */
  const arrangeTenantAfterApproachingAlert = async () => {
    const { admin, students } = await arrangeTenantWithActiveUsers(context, 7);
    await setTenantUserLimit(context, ALERT_TEST_USER_LIMIT);
    await createUsersAsAdmin(admin, 1);

    return { admin, students };
  };

  const resetTenant = async () => {
    await context.runAsTenant(context.tenantId, () =>
      truncateAllTables(context.dbAdmin, context.db),
    );
    await resetTenantUserLimit(context);
    emailAdapter.clearEmails();
  };

  beforeAll(async () => {
    const e2eTest = await createE2ETest({
      useDbProxy: true,
      manualAutomationEmails: true,
      customProviders: [{ provide: REALTIME_PUBLISHER, useValue: { emitToRoom: jest.fn() } }],
    });
    app = e2eTest.app;
    context = {
      app,
      db: app.get(DB),
      dbAdmin: app.get(DB_ADMIN),
      tenantId: e2eTest.defaultTenantId,
      runAsTenant: e2eTest.runAsTenant,
    };
    emailAdapter = app.get(EmailAdapter) as EmailTestingAdapter;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(resetTenant);
  afterEach(resetTenant);

  it.each(CAPACITY_THRESHOLD_SCENARIOS)(
    "$behaviour",
    async ({ activeUsersCount, expectedAlert }) => {
      const { admin } = await arrangeTenantWithActiveUsers(context, activeUsersCount);
      await setTenantUserLimit(context, ALERT_TEST_USER_LIMIT);

      await createUsersAsAdmin(admin, 1);

      expect(await getCapacityAlerts(admin)).toEqual(
        expectedAlert ? [expect.objectContaining(capacityAlertMatching(expectedAlert))] : [],
      );
    },
  );

  it.each(LIMIT_CHANGE_SCENARIOS)("$behaviour", async ({ newUserLimit, expectedAlert }) => {
    const { admin } = await arrangeTenantAfterApproachingAlert();
    const alertIdsBeforeChange = new Set((await getCapacityAlerts(admin)).map(({ id }) => id));

    await changeUserLimitAsSuperAdmin(admin, newUserLimit);

    const newAlerts = (await getCapacityAlerts(admin)).filter(
      ({ id }) => !alertIdsBeforeChange.has(id),
    );
    expect(newAlerts).toEqual(
      expectedAlert ? [expect.objectContaining(capacityAlertMatching(expectedAlert))] : [],
    );
  });

  it("alerts only once while the tenant stays at the same level", async () => {
    const { admin } = await arrangeTenantAfterApproachingAlert();

    await createUsersAsAdmin(admin, 1);

    expect((await getCapacityAlerts(admin)).map(({ title }) => title)).toEqual([
      CAPACITY_ALERT_TITLES.APPROACHING_LIMIT,
    ]);
  });

  it("sends only the highest alert when one import crosses several levels", async () => {
    const { admin } = await arrangeTenantWithActiveUsers(context, 6);
    await setTenantUserLimit(context, ALERT_TEST_USER_LIMIT);

    await importUsers(admin, 6);

    expect((await getCapacityAlerts(admin)).map(({ title }) => title)).toEqual([
      CAPACITY_ALERT_TITLES.CAPACITY_FULL,
    ]);
  });

  it.each(USER_REMOVAL_SCENARIOS)(
    "alerts again when the level is reached after users were removed by $removalMethod",
    async ({ removalMethod }) => {
      const {
        admin,
        students: [removedStudent],
      } = await arrangeTenantAfterApproachingAlert();

      await removeUser(admin, removedStudent, removalMethod);
      await createUsersAsAdmin(admin, 1);

      expect((await getCapacityAlerts(admin)).map(({ title }) => title)).toEqual([
        CAPACITY_ALERT_TITLES.APPROACHING_LIMIT,
        CAPACITY_ALERT_TITLES.APPROACHING_LIMIT,
      ]);
    },
  );

  it("notifies only the tenant's active admins", async () => {
    const { admin } = await arrangeTenantWithActiveUsers(context, 5);
    const secondAdmin = await arrangeTenantAdmin(context);
    await arrangeAdmin(context, { archived: true });
    await setTenantUserLimit(context, ALERT_TEST_USER_LIMIT);

    await createUsersAsAdmin(admin, 2);

    expect(await findCapacityAlertRecipientIds()).toEqual(
      [admin.user.id, secondAdmin.user.id].sort(),
    );
  });

  it("emails the alert to each tenant admin with a link to the users page", async () => {
    const { admin } = await arrangeTenantWithActiveUsers(context, 6);
    const secondAdmin = await arrangeTenantAdmin(context);
    await setTenantUserLimit(context, ALERT_TEST_USER_LIMIT);

    await createUsersAsAdmin(admin, 1);
    await deliverPendingAutomationEmails(app, context.tenantId);

    const emails = emailAdapter
      .getAllEmails()
      .filter(({ subject }) => subject === CAPACITY_ALERT_TITLES.APPROACHING_LIMIT);

    expect(emails.map(({ to }) => to).sort()).toEqual(
      [admin.user.email, secondAdmin.user.email].sort(),
    );
    expect(emails[0]).toMatchObject({
      text: expect.stringContaining("8 of the 10 users in your plan are active."),
      html: expect.stringContaining(ADMIN_USERS_PAGE_PATH),
    });
  });
});
