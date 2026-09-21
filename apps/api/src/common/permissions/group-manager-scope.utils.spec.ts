import { PERMISSIONS, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { sql } from "drizzle-orm";

import {
  getGroupManagerGroupScopeCondition,
  getGroupManagerGroupCourseScopeCondition,
  getGroupManagerLiveTrainingScopeCondition,
  shouldApplyGroupManagerScope,
} from "./group-manager-scope.utils";

import type { CurrentUserType } from "src/common/types/current-user.type";

const manager: CurrentUserType = {
  userId: "00000000-0000-0000-0000-000000000001",
  tenantId: "00000000-0000-0000-0000-000000000002",
  email: "manager@example.com",
  roleSlugs: [SYSTEM_ROLE_SLUGS.GROUP_MANAGER],
  permissions: [PERMISSIONS.MANAGED_GROUP_RESULTS_READ],
};

describe("group manager scope", () => {
  it("scopes access derived only from the group manager role", () => {
    expect(shouldApplyGroupManagerScope(manager, [PERMISSIONS.COURSE_STATISTICS])).toBe(true);
  });

  it("scopes manager-only surfaces that have no broader permission", () => {
    expect(shouldApplyGroupManagerScope(manager, [])).toBe(true);
  });

  it("preserves broader access granted by another role", () => {
    expect(
      shouldApplyGroupManagerScope(
        { ...manager, permissions: [...manager.permissions, PERMISSIONS.COURSE_STATISTICS] },
        [PERMISSIONS.COURSE_STATISTICS],
      ),
    ).toBe(false);
  });

  it("does not scope users who do not hold the group manager permission", () => {
    expect(
      shouldApplyGroupManagerScope({ ...manager, permissions: [PERMISSIONS.COURSE_STATISTICS] }, [
        PERMISSIONS.COURSE_STATISTICS,
      ]),
    ).toBe(false);
  });

  it("builds reusable group-course and live-training scope conditions", () => {
    expect(getGroupManagerGroupScopeCondition(manager, sql.raw("group_id"), [])).toBeDefined();
    expect(
      getGroupManagerGroupCourseScopeCondition(
        manager,
        sql.raw("group_id"),
        sql.raw("course_id"),
        [],
      ),
    ).toBeDefined();
    expect(
      getGroupManagerLiveTrainingScopeCondition(manager, sql.raw("live_training_id"), []),
    ).toBeDefined();
  });

  it("does not build reusable scope conditions when broader access applies", () => {
    const managerWithBroadAccess = {
      ...manager,
      permissions: [...manager.permissions, PERMISSIONS.LIVE_TRAINING_READ],
    };

    expect(
      getGroupManagerLiveTrainingScopeCondition(
        managerWithBroadAccess,
        sql.raw("live_training_id"),
        [PERMISSIONS.LIVE_TRAINING_READ],
      ),
    ).toBeUndefined();
  });
});
