export const LESSON_TYPES = {
  CONTENT: "content",
  QUIZ: "quiz",
  AI_MENTOR: "ai_mentor",
  EMBED: "embed",
  SCORM: "scorm",
  LIVE_TRAINING: "live_training",
} as const;

export type LessonTypes = (typeof LESSON_TYPES)[keyof typeof LESSON_TYPES];
