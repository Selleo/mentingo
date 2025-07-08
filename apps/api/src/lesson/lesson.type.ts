export const LESSON_TYPES = {
  TEXT: "text",
  PRESENTATION: "presentation",
  VIDEO: "video",
  QUIZ: "quiz",
  AI_MENTOR: "ai",
} as const;

export type LessonTypes = (typeof LESSON_TYPES)[keyof typeof LESSON_TYPES];
