import { describe, expect, it } from "vitest";

import {
  CourseAdminStatisticsTabs,
  getVisibleCourseStatisticsTabs,
} from "./courseAdminStatisticsTabs";

describe("getVisibleCourseStatisticsTabs", () => {
  it("hides AI mentor results when AI is not configured and no AI mentor results exist", () => {
    expect(
      getVisibleCourseStatisticsTabs({
        hasAiMentorResults: false,
        isAIConfigured: false,
      }),
    ).not.toContain(CourseAdminStatisticsTabs.aiMentorResults);
  });

  it("includes AI mentor results when AI is not configured but AI mentor results exist", () => {
    expect(
      getVisibleCourseStatisticsTabs({
        hasAiMentorResults: true,
        isAIConfigured: false,
      }),
    ).toContain(CourseAdminStatisticsTabs.aiMentorResults);
  });

  it("includes AI mentor results when AI is configured", () => {
    expect(
      getVisibleCourseStatisticsTabs({
        hasAiMentorResults: false,
        isAIConfigured: true,
      }),
    ).toContain(CourseAdminStatisticsTabs.aiMentorResults);
  });
});
