import type { GetCourseResponse } from "~/api/generated-api";

export type Course = GetCourseResponse["data"];
export type Chapter = Course["chapters"][number];
export type SidebarLesson = Chapter["lessons"][number];

// Test-only builders. The return-type annotations check defaults against the generated shape,
// so tests get fully-typed objects from overrides without casting.
export const makeLesson = (overrides: Partial<SidebarLesson> = {}): SidebarLesson => ({
  id: "lesson-1",
  title: "Getting started",
  type: "content",
  displayOrder: 1,
  status: "not_started",
  quizQuestionCount: null,
  ...overrides,
});

export const makeChapter = (overrides: Partial<Chapter> = {}): Chapter => ({
  id: "chapter-1",
  title: "Chapter one",
  lessonCount: 1,
  lessons: [makeLesson()],
  chapterProgress: "in_progress",
  displayOrder: 1,
  ...overrides,
});

export const makeCourse = (overrides: Partial<Course> = {}): Course => ({
  category: "General",
  chapters: [makeChapter()],
  courseChapterCount: 1,
  currency: "pln",
  description: "Course description",
  id: "course-1",
  status: "published",
  originType: "regular",
  isContentReadonly: false,
  courseType: "default",
  priceInCents: 0,
  thumbnailPositionY: 0,
  title: "Course title",
  slug: "course-slug",
  stripeProductId: null,
  stripePriceId: null,
  availableLocales: ["en"],
  baseLanguage: "en",
  dueDate: null,
  ...overrides,
});
