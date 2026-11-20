import {
  getTenantUserCapacityAlertLevel,
  isTenantUserLimitLowered,
} from "src/user/utils/tenant-user-capacity.utils";

import {
  ALERT_LEVEL_SCENARIOS,
  LIMIT_CHANGE_SCENARIOS,
  LIMIT_WITHOUT_OVERFLOW_SCENARIO,
} from "./tenant-user-capacity.utils.scenarios";

describe("getTenantUserCapacityAlertLevel", () => {
  it.each(ALERT_LEVEL_SCENARIOS)(
    "$behaviour",
    ({ activeUsersCount, maxUsers, allowedUsersCount, expectedLevel }) => {
      expect(
        getTenantUserCapacityAlertLevel({ activeUsersCount, maxUsers, allowedUsersCount }),
      ).toBe(expectedLevel);
    },
  );

  it("skips the reached limit when the plan has no overflow", () => {
    const { expectedLevel, ...tenantUserCapacity } = LIMIT_WITHOUT_OVERFLOW_SCENARIO;

    expect(getTenantUserCapacityAlertLevel(tenantUserCapacity)).toBe(expectedLevel);
  });
});

describe("isTenantUserLimitLowered", () => {
  it.each(LIMIT_CHANGE_SCENARIOS)(
    "$behaviour",
    ({ previousUserLimit, currentUserLimit, isLowered }) => {
      expect(isTenantUserLimitLowered(previousUserLimit, currentUserLimit)).toBe(isLowered);
    },
  );
});
