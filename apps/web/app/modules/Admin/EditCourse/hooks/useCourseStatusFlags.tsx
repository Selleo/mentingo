import type { CourseStatus } from "~/api/queries/useCourses";

type CourseStatusFlags = {
  isPublished: boolean;
  isDraft: boolean;
  isPrivate: boolean;
};

export const useCourseStatusFlags = (status: CourseStatus): CourseStatusFlags => {
  const isPublished = status === "published";
  const isDraft = status === "draft";
  const isPrivate = status === "private";

  return { isPublished, isDraft, isPrivate };
};
