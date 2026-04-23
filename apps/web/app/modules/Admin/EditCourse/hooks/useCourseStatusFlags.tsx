import { COURSE_STATUSES } from "@repo/shared";

import type { CourseStatus } from "~/api/queries/useCourses";

type CourseStatusFlags = {
  isPublished: boolean;
  isDraft: boolean;
  isPrivate: boolean;
};

export const useCourseStatusFlags = (status: CourseStatus): CourseStatusFlags => {
  const isPublished = status === COURSE_STATUSES.PUBLISHED;
  const isDraft = status === COURSE_STATUSES.DRAFT;
  const isPrivate = status === COURSE_STATUSES.PRIVATE;

  return { isPublished, isDraft, isPrivate };
};
