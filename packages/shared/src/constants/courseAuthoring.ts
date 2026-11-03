/** Selects which proposal approval steps the course author delegates to the assistant. */
export const COURSE_AUTHORING_EXECUTION_MODES = {
  REVIEW: "review",
  AUTONOMOUS: "autonomous",
} as const;

export type CourseAuthoringExecutionMode =
  (typeof COURSE_AUTHORING_EXECUTION_MODES)[keyof typeof COURSE_AUTHORING_EXECUTION_MODES];
