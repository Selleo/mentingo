export const LESSON_LEARNERS = {
  ENROLLED_CONTENT_CREATOR: "an enrolled content creator in another author's course",
  ENROLLED_AUTHOR: "the enrolled course author outside learning mode",
  ADMIN: "an admin outside learning mode",
  ADMIN_IN_LEARNING_MODE: "an admin in learning mode",
} as const;

export type LessonLearner = (typeof LESSON_LEARNERS)[keyof typeof LESSON_LEARNERS];

export const LESSON_COMPLETION_CASES = [
  { learner: LESSON_LEARNERS.ENROLLED_CONTENT_CREATOR, expectedCompleted: true },
  { learner: LESSON_LEARNERS.ENROLLED_AUTHOR, expectedCompleted: false },
  { learner: LESSON_LEARNERS.ADMIN, expectedCompleted: false },
  { learner: LESSON_LEARNERS.ADMIN_IN_LEARNING_MODE, expectedCompleted: true },
];
