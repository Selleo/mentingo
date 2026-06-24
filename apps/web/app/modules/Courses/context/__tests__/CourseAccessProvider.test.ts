import { describe, expect, it } from "vitest";

import { resolveCourseExperienceState } from "../CourseAccessProvider";

import type { GetCourseResponse } from "~/api/generated-api";

const createCourse = (
  overrides: Partial<GetCourseResponse["data"]> = {},
): GetCourseResponse["data"] =>
  ({
    id: "course-1",
    authorId: "author-1",
    enrolled: false,
    ...overrides,
  }) as GetCourseResponse["data"];

describe("resolveCourseExperienceState", () => {
  it("uses preview mode for learning-mode users who are not actively learning the course", () => {
    const state = resolveCourseExperienceState({
      course: createCourse(),
      forcePreviewMode: false,
      currentUserId: "admin-1",
      canUseLearningMode: true,
      canUpdateLearningProgress: true,
      activeLearningModeCourseIds: [],
    });

    expect(state.isPreviewMode).toBe(true);
    expect(state.isCourseStudentModeActive).toBe(false);
  });

  it("uses the student experience when learning mode is active for the course", () => {
    const state = resolveCourseExperienceState({
      course: createCourse(),
      forcePreviewMode: false,
      currentUserId: "admin-1",
      canUseLearningMode: true,
      canUpdateLearningProgress: true,
      activeLearningModeCourseIds: ["course-1"],
    });

    expect(state.isPreviewMode).toBe(false);
    expect(state.isCourseStudentModeActive).toBe(true);
    expect(state.isEffectiveStudentExperience).toBe(true);
  });

  it("does not treat authors as enrolled learners", () => {
    const state = resolveCourseExperienceState({
      course: createCourse({ enrolled: true }),
      forcePreviewMode: false,
      currentUserId: "author-1",
      canUseLearningMode: true,
      canUpdateLearningProgress: true,
      activeLearningModeCourseIds: [],
    });

    expect(state.isPreviewMode).toBe(true);
    expect(state.isEffectiveStudentExperience).toBe(false);
  });
});
