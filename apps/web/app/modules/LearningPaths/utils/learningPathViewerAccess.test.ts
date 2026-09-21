import { PERMISSIONS } from "@repo/shared";

import { getLearningPathViewerAccess } from "./learningPathViewerAccess";

describe("getLearningPathViewerAccess", () => {
  it("hides self-enrollment and course progress for Group Managers", () => {
    expect(getLearningPathViewerAccess([PERMISSIONS.MANAGED_GROUP_RESULTS_READ])).toEqual({
      canSelfEnroll: false,
      showCourseProgress: false,
    });
  });

  it("keeps learner controls available without Group Manager access", () => {
    expect(getLearningPathViewerAccess([PERMISSIONS.LEARNING_PATH_READ])).toEqual({
      canSelfEnroll: true,
      showCourseProgress: true,
    });
  });

  it("uses the Group Manager view when combined with another role", () => {
    expect(
      getLearningPathViewerAccess([
        PERMISSIONS.LEARNING_PATH_READ,
        PERMISSIONS.MANAGED_GROUP_RESULTS_READ,
      ]),
    ).toEqual({
      canSelfEnroll: false,
      showCourseProgress: false,
    });
  });
});
