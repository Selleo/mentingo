import { COURSE_STATUSES, COURSE_TYPE } from "@repo/shared";

import type { CourseType } from "@repo/shared";
import type i18next from "i18next";
import type { CourseStatus } from "~/api/queries/useCourses";
import type { IconName } from "~/types/shared";

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

export const getCourseBadgeIcon = (status: CourseStatus): IconName | undefined => {
  switch (status) {
    case COURSE_STATUSES.DRAFT:
      return "Warning";
    case COURSE_STATUSES.PUBLISHED:
      return "Success";
    case COURSE_STATUSES.PRIVATE:
      return "Private";
    default:
      return undefined;
  }
};

export const getCourseBadgeIconClasses = (status: CourseStatus): string | undefined => {
  switch (status) {
    case COURSE_STATUSES.DRAFT:
    case COURSE_STATUSES.PUBLISHED:
    case COURSE_STATUSES.PRIVATE:
      return "size-4";
    default:
      return undefined;
  }
};

export const getCourseTypeLabel = (courseType: CourseType, t: typeof i18next.t) => {
  switch (courseType) {
    case COURSE_TYPE.SCORM:
      return t("adminCourseTypeSelector.scorm.title");
    case COURSE_TYPE.DEFAULT:
    default:
      return t("adminCourseTypeSelector.standard.title");
  }
};
