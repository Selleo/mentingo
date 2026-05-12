export const LEARNING_PATH_GROUP_ACTIONS = {
  ENROLL: "enroll",
  UNENROLL: "unenroll",
} as const;

export type LearningPathGroupAction =
  (typeof LEARNING_PATH_GROUP_ACTIONS)[keyof typeof LEARNING_PATH_GROUP_ACTIONS];
