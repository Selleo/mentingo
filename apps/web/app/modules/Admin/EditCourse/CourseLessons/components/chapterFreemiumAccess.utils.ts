import { LessonType, type Chapter } from "../../EditCourse.types";

export const CHAPTER_FREEMIUM_DISABLED_REASON = {
  COURSE_LOCKED: "COURSE_LOCKED",
  REQUIRES_CONTENT_LESSONS: "REQUIRES_CONTENT_LESSONS",
  PUBLIC_REQUIRES_COURSE_ACCESS: "PUBLIC_REQUIRES_COURSE_ACCESS",
} as const;

export type ChapterFreemiumDisabledReason =
  (typeof CHAPTER_FREEMIUM_DISABLED_REASON)[keyof typeof CHAPTER_FREEMIUM_DISABLED_REASON];

type GetChapterFreemiumAccessStateParams = {
  chapter: Chapter;
  coursePriceInCents?: number;
  isCourseGenerationLocked: boolean;
  unregisteredUserCoursesAccessibility: boolean;
};

export const getChapterFreemiumAccessState = ({
  chapter,
  coursePriceInCents,
  isCourseGenerationLocked,
  unregisteredUserCoursesAccessibility,
}: GetChapterFreemiumAccessStateParams) => {
  const isPaidCourse = (coursePriceInCents ?? 0) > 0;
  const hasOnlyContentLessons =
    chapter.lessons.length > 0 &&
    chapter.lessons.every((lesson) => lesson.type === LessonType.CONTENT);

  if (isCourseGenerationLocked) {
    return {
      isPaidCourse,
      isDisabled: true,
      disabledReason: CHAPTER_FREEMIUM_DISABLED_REASON.COURSE_LOCKED,
    };
  }

  if (!isPaidCourse && !unregisteredUserCoursesAccessibility) {
    return {
      isPaidCourse,
      isDisabled: true,
      disabledReason: CHAPTER_FREEMIUM_DISABLED_REASON.PUBLIC_REQUIRES_COURSE_ACCESS,
    };
  }

  if (!hasOnlyContentLessons) {
    return {
      isPaidCourse,
      isDisabled: true,
      disabledReason: CHAPTER_FREEMIUM_DISABLED_REASON.REQUIRES_CONTENT_LESSONS,
    };
  }

  return {
    isPaidCourse,
    isDisabled: false,
    disabledReason: null,
  };
};
