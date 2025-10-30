import type i18next from "i18next";
import type { CourseStatus } from "~/api/queries/useCourses";

export const getCourseStatus = (status: CourseStatus, t: typeof i18next.t) => {
  switch (status) {
    case "draft":
      return t("common.other.draft");
    case "published":
      return t("common.other.published");
    case "private":
      return t("common.other.private");
    default:
      return t("common.other.draft");
  }
};

export const getCourseBadgeVariant = (status: CourseStatus) => {
  switch (status) {
    case "draft":
      return "draft";
    case "published":
      return "success";
    case "private":
      return "secondary";
    default:
      return "draft";
  }
};
