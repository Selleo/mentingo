import { COURSE_STATUSES, type CourseStatus } from "@repo/shared";

export const COURSE_BULK_STATUS_UPDATE_BATCH_SIZE = 25;

export const PROTECTED_COURSE_DELETE_STATUSES: CourseStatus[] = [
  COURSE_STATUSES.PUBLISHED,
  COURSE_STATUSES.PRIVATE,
];
