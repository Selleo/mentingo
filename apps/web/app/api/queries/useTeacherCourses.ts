import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetTeacherCoursesResponse } from "../generated-api";

type SearchParams = {
  scope?: "all" | "enrolled" | "available";
  excludeCourseId?: string;
};

export const teacherCoursesOptions = (
  authorId?: string,
  searchParams?: SearchParams,
  isTeacher?: boolean,
) => {
  return {
    enabled: !!authorId && isTeacher,
    queryKey: ["teacher-courses", authorId],
    queryFn: async () => {
      if (!authorId) {
        throw new Error("Author ID is required");
      }

      if (!isTeacher) {
        throw new Error("Author must be a teacher");
      }

      const response = await ApiClient.api.courseControllerGetTeacherCourses({
        authorId,
        ...(searchParams?.scope && { scope: searchParams.scope }),
        ...(searchParams?.excludeCourseId && { excludeCourseId: searchParams.excludeCourseId }),
      });

      return response.data;
    },
    select: (data: GetTeacherCoursesResponse) => data.data,
  };
};

export function useTeacherCourses(
  authorId?: string,
  searchParams?: SearchParams,
  isTeacher?: boolean,
) {
  return useQuery(teacherCoursesOptions(authorId, searchParams, isTeacher));
}
