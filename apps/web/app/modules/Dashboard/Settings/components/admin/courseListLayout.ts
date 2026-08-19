export const COURSE_LIST_LAYOUT_VARIANT = {
  CLASSIC: "classic",
  MODERN: "modern",
} as const;

export type CourseListLayoutVariant =
  (typeof COURSE_LIST_LAYOUT_VARIANT)[keyof typeof COURSE_LIST_LAYOUT_VARIANT];
