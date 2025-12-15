export const COURSE_ENROLLMENT = {
  ENROLLED: "enrolled",
  NOT_ENROLLED: "not_enrolled",
  GROUP_ENROLLED: "group_enrolled",
} as const;

export type CourseEnrollment = (typeof COURSE_ENROLLMENT)[keyof typeof COURSE_ENROLLMENT];
