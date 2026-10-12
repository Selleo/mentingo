export const COURSE_UNAVAILABLE_REASONS = {
  REQUIRES_AUTHENTICATION: "requiresAuthentication",
  NOT_FOUND: "notFound",
} as const;

export type CourseUnavailableReason =
  (typeof COURSE_UNAVAILABLE_REASONS)[keyof typeof COURSE_UNAVAILABLE_REASONS];
