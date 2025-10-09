import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetStudentCoursesResponse } from "../generated-api";
import type { SortOption } from "~/types/sorting";

type CourseParams = {
  /** Filter by course title only */
  title?: string;
  /** Filter by course description only */
  description?: string;
  /** Search across both title AND description fields simultaneously */
  searchQuery?: string;
  category?: string;
  sort?: SortOption;
  userId?: string;
};

type QueryOptions = {
  enabled?: boolean;
};

export const studentCoursesQueryOptions = (
  searchParams?: CourseParams,
  options: QueryOptions = { enabled: true },
) => ({
  queryKey: ["get-student-courses", searchParams],
  queryFn: async () => {
    const response = await ApiClient.api.courseControllerGetStudentCourses({
      page: 1,
      perPage: 100,
      ...(searchParams?.title && { title: searchParams.title }),
      ...(searchParams?.description && { description: searchParams.description }),
      ...(searchParams?.searchQuery && { searchQuery: searchParams.searchQuery }),
      ...(searchParams?.category && { category: searchParams.category }),
      ...(searchParams?.sort && { sort: searchParams.sort }),
      ...(searchParams?.userId && { userId: searchParams.userId }),
    });
    return response.data;
  },
  select: (data: GetStudentCoursesResponse) => data.data,
  ...options,
});

export function useStudentCourses(searchParams?: CourseParams) {
  return useQuery(studentCoursesQueryOptions(searchParams));
}

export function useStudentCoursesSuspense(searchParams?: CourseParams) {
  return useSuspenseQuery(studentCoursesQueryOptions(searchParams));
}
