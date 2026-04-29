export const ALLOWED_COHORT_SETTINGS = {
  COHORT_LEARNING_ENABLED: "cohortLearningEnabled",
} as const;

export type AllowedCohortSettings =
  (typeof ALLOWED_COHORT_SETTINGS)[keyof typeof ALLOWED_COHORT_SETTINGS];
