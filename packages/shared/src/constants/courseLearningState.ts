export const COURSE_LEARNING_STATE_KINDS = {
  CURRENT: "current",
  REPETITION: "repetition",
} as const;

export type CourseLearningStateKind =
  (typeof COURSE_LEARNING_STATE_KINDS)[keyof typeof COURSE_LEARNING_STATE_KINDS];

export const COURSE_LEARNING_STATE_HEADER = "x-course-learning-state-id";
