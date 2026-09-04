import { PERMISSIONS } from "@repo/shared";

import { canLoadLessonSequence } from "./useLessonsSequence";

describe("canLoadLessonSequence", () => {
  it("rejects Group Manager access without course read permission", () => {
    expect(canLoadLessonSequence([PERMISSIONS.MANAGED_GROUP_RESULTS_READ])).toBe(false);
  });

  it("allows access with course read permission", () => {
    expect(canLoadLessonSequence([PERMISSIONS.COURSE_READ])).toBe(true);
  });
});
