import { describe, expect, it } from "vitest";

import { LessonType, type Chapter } from "../../EditCourse.types";

import {
  CHAPTER_FREEMIUM_DISABLED_REASON,
  getChapterFreemiumAccessState,
} from "./chapterFreemiumAccess.utils";

const createChapter = (lessonTypes: LessonType[]): Chapter =>
  ({
    id: "chapter-id",
    title: "Chapter",
    updatedAt: "2026-01-01T00:00:00.000Z",
    displayOrder: 1,
    isFree: false,
    lessonCount: lessonTypes.length,
    lessons: lessonTypes.map((type, index) => ({
      id: `lesson-${index}`,
      updatedAt: "2026-01-01T00:00:00.000Z",
      type,
      displayOrder: index + 1,
      title: `Lesson ${index + 1}`,
      description: "",
    })),
  }) as Chapter;

describe("getChapterFreemiumAccessState", () => {
  it("enables paid course chapters with content lessons", () => {
    const state = getChapterFreemiumAccessState({
      chapter: createChapter([LessonType.CONTENT]),
      coursePriceInCents: 1200,
      isCourseGenerationLocked: false,
      unregisteredUserCoursesAccessibility: false,
    });

    expect(state).toEqual({
      isPaidCourse: true,
      isDisabled: false,
      disabledReason: null,
    });
  });

  it("disables chapters that include non-content lessons", () => {
    const state = getChapterFreemiumAccessState({
      chapter: createChapter([LessonType.CONTENT, LessonType.QUIZ]),
      coursePriceInCents: 1200,
      isCourseGenerationLocked: false,
      unregisteredUserCoursesAccessibility: true,
    });

    expect(state.disabledReason).toBe(CHAPTER_FREEMIUM_DISABLED_REASON.REQUIRES_CONTENT_LESSONS);
  });

  it("enables free course chapters when visitor course access is enabled", () => {
    const state = getChapterFreemiumAccessState({
      chapter: createChapter([LessonType.CONTENT]),
      coursePriceInCents: 0,
      isCourseGenerationLocked: false,
      unregisteredUserCoursesAccessibility: true,
    });

    expect(state).toEqual({
      isPaidCourse: false,
      isDisabled: false,
      disabledReason: null,
    });
  });

  it("disables free course chapters when visitor course access is disabled", () => {
    const state = getChapterFreemiumAccessState({
      chapter: createChapter([LessonType.CONTENT]),
      coursePriceInCents: 0,
      isCourseGenerationLocked: false,
      unregisteredUserCoursesAccessibility: false,
    });

    expect(state.disabledReason).toBe(
      CHAPTER_FREEMIUM_DISABLED_REASON.PUBLIC_REQUIRES_COURSE_ACCESS,
    );
  });

  it("prioritizes visitor course access for free course chapters", () => {
    const state = getChapterFreemiumAccessState({
      chapter: createChapter([LessonType.QUIZ]),
      coursePriceInCents: 0,
      isCourseGenerationLocked: false,
      unregisteredUserCoursesAccessibility: false,
    });

    expect(state.disabledReason).toBe(
      CHAPTER_FREEMIUM_DISABLED_REASON.PUBLIC_REQUIRES_COURSE_ACCESS,
    );
  });

  it("disables empty chapters", () => {
    const state = getChapterFreemiumAccessState({
      chapter: createChapter([]),
      coursePriceInCents: 1200,
      isCourseGenerationLocked: false,
      unregisteredUserCoursesAccessibility: true,
    });

    expect(state.disabledReason).toBe(CHAPTER_FREEMIUM_DISABLED_REASON.REQUIRES_CONTENT_LESSONS);
  });
});
