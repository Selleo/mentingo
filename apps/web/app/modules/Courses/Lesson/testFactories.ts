import type { GetCourseResponse, GetLessonByIdResponse } from "~/api/generated-api";

type Lesson = GetLessonByIdResponse["data"];
type Course = GetCourseResponse["data"];

export const makeLesson = (overrides: Partial<Lesson> = {}): Lesson => ({
  id: "lesson-1",
  title: "Lesson",
  type: "content",
  description: null,
  fileType: null,
  fileUrl: null,
  thresholdScore: null,
  attemptsLimit: null,
  quizCooldownInHours: null,
  isQuizPassed: null,
  attempts: null,
  updatedAt: null,
  displayOrder: 1,
  nextLessonId: null,
  ...overrides,
});

export const makeCourse = (overrides: Partial<Course> = {}): Course => ({
  id: "course-1",
  title: "Course",
  slug: "course",
  description: "",
  category: "General",
  chapters: [
    {
      id: "chapter-1",
      title: "Chapter",
      lessonCount: 1,
      displayOrder: 1,
      lessons: [
        {
          id: "lesson-1",
          title: "Lesson",
          type: "content",
          displayOrder: 1,
          status: "not_started",
          quizQuestionCount: null,
        },
      ],
    },
  ],
  courseChapterCount: 1,
  currency: "pln",
  status: "published",
  originType: "regular",
  isContentReadonly: false,
  courseType: "default",
  priceInCents: 0,
  thumbnailPositionY: 0,
  stripeProductId: null,
  stripePriceId: null,
  availableLocales: ["en"],
  baseLanguage: "en",
  dueDate: null,
  ...overrides,
});
