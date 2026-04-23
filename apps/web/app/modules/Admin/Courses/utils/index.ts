import { COURSE_STATUSES } from "@repo/shared";

import type i18next from "i18next";
import type { CourseStatus } from "~/api/queries/useCourses";

export const getCourseStatus = (status: CourseStatus, t: typeof i18next.t) => {
  switch (status) {
    case COURSE_STATUSES.DRAFT:
      return t("common.other.draft");
    case COURSE_STATUSES.PUBLISHED:
      return t("common.other.published");
    case COURSE_STATUSES.PRIVATE:
      return t("common.other.private");
    default:
      return t("common.other.draft");
  }
};

export const getCourseBadgeVariant = (status: CourseStatus) => {
  switch (status) {
    case COURSE_STATUSES.DRAFT:
      return "draft";
    case COURSE_STATUSES.PUBLISHED:
      return "success";
    case COURSE_STATUSES.PRIVATE:
      return "secondary";
    default:
      return "draft";
  }
};
