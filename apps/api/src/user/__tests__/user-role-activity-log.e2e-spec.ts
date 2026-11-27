import {
  ACTIVITY_LOG_ACTION_TYPES,
  PERMISSIONS,
  SYSTEM_ROLE_SLUGS,
  type SystemRoleSlug,
} from "@repo/shared";
import { eq } from "drizzle-orm";
import { match } from "ts-pattern";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { activityLogs } from "src/storage/schema";
import { UserService } from "src/user/user.service";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { truncateTables } from "../../../test/helpers/test-helpers";
import { waitForOutbox } from "../../../test/helpers/wait-for-outbox";

import {
  EXPECTED_ROLE_CHANGE_METADATA,
  ROLE_CHANGE_CASES,
  ROLE_CHANGE_METHODS,
  USER_ROLE_ACTIVITY_LOG_TABLES,
  type RoleChangeMethod,
} from "./user-role-activity-log.scenarios";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

describe("User role activity log (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let defaultTenantId: UUIDType;
  let runAsTenant: <T>(tenantId: string, callback: () => Promise<T>) => Promise<T>;
  let userService: UserService;

  beforeAll(async () => {
    const context = await createE2ETest({ useDbProxy: true, enableActivityLogs: true });
    app = context.app;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    defaultTenantId = context.defaultTenantId;
    runAsTenant = context.runAsTenant;
    userService = app.get(UserService);
  });

  beforeEach(async () => {
    await truncateTables(baseDb, [...USER_ROLE_ACTIVITY_LOG_TABLES]);
    await runAsTenant(defaultTenantId, () => createSettingsFactory(db).create());
  });

  afterEach(async () => {
    await truncateTables(baseDb, [...USER_ROLE_ACTIVITY_LOG_TABLES]);
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(ROLE_CHANGE_CASES)("$title", async ({ method, changedUserCount }) => {
    const admin = await arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN);
    const students = await Promise.all(
      Array.from({ length: changedUserCount }, () => arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT)),
    );

    await changeRolesToContentCreator(
      method,
      students.map((student) => student.id),
      buildActor(admin),
    );

    for (const student of students) {
      const [roleChangeLog] = await waitForUserLogs(student.id);
      expect(roleChangeLog).toMatchObject({
        actorId: admin.id,
        actionType: ACTIVITY_LOG_ACTION_TYPES.UPDATE,
        metadata: EXPECTED_ROLE_CHANGE_METADATA,
      });
    }
  });

  const arrangeUser = (roleSlug: SystemRoleSlug) =>
    runAsTenant(defaultTenantId, () =>
      createUserFactory(db).create({ tenantId: defaultTenantId, roleSlug }),
    );

  const changeRolesToContentCreator = (
    method: RoleChangeMethod,
    userIds: UUIDType[],
    actor: CurrentUserType,
  ) =>
    runAsTenant(defaultTenantId, () =>
      match(method)
        .with(ROLE_CHANGE_METHODS.SINGLE, async () => {
          for (const userId of userIds) {
            await userService.updateUser(
              userId,
              { roleSlugs: [SYSTEM_ROLE_SLUGS.CONTENT_CREATOR] },
              actor,
            );
          }
        })
        .with(ROLE_CHANGE_METHODS.BULK, () =>
          userService.updateUsersRoles(
            { userIds, roleSlugs: [SYSTEM_ROLE_SLUGS.CONTENT_CREATOR] },
            actor,
          ),
        )
        .exhaustive(),
    );

  const waitForUserLogs = (userId: UUIDType) =>
    waitForOutbox(
      app,
      () => baseDb.select().from(activityLogs).where(eq(activityLogs.resourceId, userId)),
      (logs) => logs.length > 0,
    );

  const buildActor = (user: { id: UUIDType; email: string }): CurrentUserType => ({
    userId: user.id,
    email: user.email,
    tenantId: defaultTenantId,
    roleSlugs: [SYSTEM_ROLE_SLUGS.ADMIN],
    permissions: Object.values(PERMISSIONS),
  });
});
