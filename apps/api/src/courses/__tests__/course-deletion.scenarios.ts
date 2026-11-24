import { COURSE_STATUSES } from "@repo/shared";

export const COURSE_DELETION_REQUESTS = {
  SINGLE: "DELETE /api/course/deleteCourse/:id",
  MANY: "DELETE /api/course/deleteManyCourses",
} as const;

export type CourseDeletionRequest =
  (typeof COURSE_DELETION_REQUESTS)[keyof typeof COURSE_DELETION_REQUESTS];

export const PROTECTED_COURSE_STATUSES = [
  { status: COURSE_STATUSES.PUBLISHED },
  { status: COURSE_STATUSES.PRIVATE },
];

export const PROTECTED_COURSE_DELETE_MESSAGE = "adminCoursesView.toast.deleteProtectedCourseFailed";
