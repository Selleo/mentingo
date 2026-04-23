export const COURSE_STATUSES = {
  DRAFT: "draft",
  PUBLISHED: "published",
  PRIVATE: "private",
} as const;

export type CourseStatus = (typeof COURSE_STATUSES)[keyof typeof COURSE_STATUSES];
