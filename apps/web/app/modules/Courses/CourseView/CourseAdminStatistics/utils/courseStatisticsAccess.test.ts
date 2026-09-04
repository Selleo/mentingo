import { PERMISSIONS } from "@repo/shared";

import { canViewCourseStatistics } from "./courseStatisticsAccess";

describe("canViewCourseStatistics", () => {
  it("allows Group Managers to load statistics", () => {
    expect(canViewCourseStatistics([PERMISSIONS.MANAGED_GROUP_RESULTS_READ])).toBe(true);
  });

  it("allows course managers and rejects unrelated permissions", () => {
    expect(canViewCourseStatistics([PERMISSIONS.COURSE_UPDATE_OWN])).toBe(true);
    expect(canViewCourseStatistics([PERMISSIONS.COURSE_READ])).toBe(false);
  });
});
