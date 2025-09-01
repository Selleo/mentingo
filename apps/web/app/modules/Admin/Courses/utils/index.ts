import type { CourseStatus } from "~/api/queries/useCourses";

export const getCourseStatus = (status: CourseStatus) => {
  switch (status) {
    case "draft":
      return "Draft";
    case "published":
      return "Published";
    case "private":
      return "Private";
    default:
      return "Draft";
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
