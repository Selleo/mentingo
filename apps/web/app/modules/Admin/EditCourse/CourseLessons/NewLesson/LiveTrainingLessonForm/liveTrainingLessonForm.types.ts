export const LIVE_TRAINING_LESSON_FORM_MODES = {
  CREATE_NEW: "create_new",
  LINK_EXISTING: "link_existing",
} as const;

export type LiveTrainingLessonFormMode =
  (typeof LIVE_TRAINING_LESSON_FORM_MODES)[keyof typeof LIVE_TRAINING_LESSON_FORM_MODES];
