import { COURSE_STATUSES, PERMISSIONS } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { canUpdateCourseByAuthor, resolveCourseExperienceState } from "../CourseAccessProvider";

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
  it("uses read-only preview for a non-enrolled learner when public previews are enabled", () => {
    const state = resolveCourseExperienceState({
      course: createCourse({
        status: COURSE_STATUSES.PUBLISHED,
        priceInCents: 0,
        isArchived: false,
      }),
      forcePreviewMode: false,
      currentUserId: "student-1",
      canUseLearningMode: false,
      canUpdateLearningProgress: true,
      activeLearningModeCourseIds: [],
      publicCoursePreviewEnabled: true,
    });

    expect(state.isPreviewMode).toBe(true);
    expect(state.isEffectiveStudentExperience).toBe(false);
  });

  it.each([
    { name: "disabled setting", enabled: false, overrides: {} },
    { name: "enrolled learner", enabled: true, overrides: { enrolled: true } },
    { name: "paid course", enabled: true, overrides: { priceInCents: 1000 } },
    { name: "private course", enabled: true, overrides: { status: COURSE_STATUSES.PRIVATE } },
    { name: "draft course", enabled: true, overrides: { status: COURSE_STATUSES.DRAFT } },
    { name: "archived course", enabled: true, overrides: { isArchived: true } },
  ])("preserves existing learner behavior for $name", ({ enabled, overrides }) => {
    const state = resolveCourseExperienceState({
      course: createCourse({
        status: COURSE_STATUSES.PUBLISHED,
        priceInCents: 0,
        isArchived: false,
        ...overrides,
      }),
      forcePreviewMode: false,
      currentUserId: "student-1",
      canUseLearningMode: false,
      canUpdateLearningProgress: true,
      activeLearningModeCourseIds: [],
      publicCoursePreviewEnabled: enabled,
    });

    expect(state.isPreviewMode).toBe(false);
  });

  it("keeps admin Learn mode interactive when public previews are enabled", () => {
    const state = resolveCourseExperienceState({
      course: createCourse({
        status: COURSE_STATUSES.PUBLISHED,
        priceInCents: 0,
        isArchived: false,
      }),
      forcePreviewMode: false,
      currentUserId: "admin-1",
      canUseLearningMode: true,
      canUpdateLearningProgress: true,
      activeLearningModeCourseIds: ["course-1"],
      publicCoursePreviewEnabled: true,
    });

    expect(state.isPreviewMode).toBe(false);
    expect(state.isEffectiveStudentExperience).toBe(true);
  });

  it("uses preview mode for visitors without a user session", () => {
    const state = resolveCourseExperienceState({
      course: createCourse(),
      forcePreviewMode: false,
      currentUserId: undefined,
      canUseLearningMode: false,
      canUpdateLearningProgress: false,
      activeLearningModeCourseIds: [],
    });

    expect(state.isPreviewMode).toBe(true);
    expect(state.isEffectiveStudentExperience).toBe(false);
    expect(state.canEditCourse).toBe(false);
    expect(state.isAdminExperience).toBe(false);
  });

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
    expect(state.isAdminExperience).toBe(false);
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

  it("uses the admin experience for users who can update any course", () => {
    const state = resolveCourseExperienceState({
      course: createCourse(),
      forcePreviewMode: false,
      currentUserId: "admin-1",
      canUseLearningMode: true,
      canUpdateLearningProgress: true,
      canEditCourse: true,
      activeLearningModeCourseIds: [],
    });

    expect(state.canEditCourse).toBe(true);
    expect(state.isAdminExperience).toBe(true);
  });

  it("uses the admin experience for course authors with own-course update access", () => {
    const state = resolveCourseExperienceState({
      course: createCourse(),
      forcePreviewMode: false,
      currentUserId: "author-1",
      canUseLearningMode: true,
      canUpdateLearningProgress: true,
      canEditCourse: true,
      activeLearningModeCourseIds: [],
    });

    expect(state.canEditCourse).toBe(true);
    expect(state.isAdminExperience).toBe(true);
  });

  it("does not use the admin experience while learning mode is active", () => {
    const state = resolveCourseExperienceState({
      course: createCourse(),
      forcePreviewMode: false,
      currentUserId: "admin-1",
      canUseLearningMode: true,
      canUpdateLearningProgress: true,
      canEditCourse: true,
      activeLearningModeCourseIds: ["course-1"],
    });

    expect(state.canEditCourse).toBe(true);
    expect(state.isCourseStudentModeActive).toBe(true);
    expect(state.isAdminExperience).toBe(false);
  });
});

describe("canUpdateCourseByAuthor", () => {
  it("allows COURSE_UPDATE users to edit courses owned by someone else", () => {
    expect(
      canUpdateCourseByAuthor({
        authorId: "author-1",
        currentUserId: "admin-1",
        permissions: [PERMISSIONS.COURSE_UPDATE],
      }),
    ).toBe(true);
  });

  it("allows COURSE_UPDATE_OWN users to edit only their own courses", () => {
    expect(
      canUpdateCourseByAuthor({
        authorId: "author-1",
        currentUserId: "author-1",
        permissions: [PERMISSIONS.COURSE_UPDATE_OWN],
      }),
    ).toBe(true);
    expect(
      canUpdateCourseByAuthor({
        authorId: "author-1",
        currentUserId: "content-creator-2",
        permissions: [PERMISSIONS.COURSE_UPDATE_OWN],
      }),
    ).toBe(false);
  });

  it("does not treat USER_MANAGE as course update access", () => {
    expect(
      canUpdateCourseByAuthor({
        authorId: "author-1",
        currentUserId: "admin-1",
        permissions: [PERMISSIONS.USER_MANAGE],
      }),
    ).toBe(false);
  });

  it("does not grant own-course update access when the author is missing", () => {
    expect(
      canUpdateCourseByAuthor({
        authorId: undefined,
        currentUserId: "content-creator-1",
        permissions: [PERMISSIONS.COURSE_UPDATE_OWN],
      }),
    ).toBe(false);
  });
});
