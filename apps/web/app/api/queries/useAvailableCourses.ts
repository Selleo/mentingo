import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetAvailableCoursesResponse } from "../generated-api";
import type { UserRole } from "~/config/userRoles";
import type { SortOption } from "~/types/sorting";

type CourseParams = {
  title?: string;
  category?: string;
  sort?: SortOption;
  userId?: string;
  excludeCourseId?: string;
  userRole?: UserRole;
};

type QueryOptions = {
  enabled?: boolean;
};

export const availableCoursesQueryOptions = (
  searchParams?: CourseParams,
  options: QueryOptions = { enabled: true },
) => ({
  queryKey: ["available-courses", searchParams],
  queryFn: async () => {
    const response = await ApiClient.api.courseControllerGetAvailableCourses({
      page: 1,
      perPage: 100,
      ...(searchParams?.title && { title: searchParams.title }),
      ...(searchParams?.category && { category: searchParams.category }),
      ...(searchParams?.sort && { sort: searchParams.sort }),
      ...(searchParams?.userId && { userId: searchParams.userId }),
      ...(searchParams?.excludeCourseId && { excludeCourseId: searchParams.excludeCourseId }),
    });
    return response.data;
  },
  select: (data: GetAvailableCoursesResponse) => data.data,
  ...options,
});

export function useAvailableCourses(searchParams?: CourseParams) {
  return useQuery(availableCoursesQueryOptions(searchParams));
}

export function useAvailableCoursesSuspense(searchParams?: CourseParams) {
  return useSuspenseQuery(availableCoursesQueryOptions(searchParams));
}
