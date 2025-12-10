import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetAvailableCoursesResponse } from "../generated-api";
import type { SupportedLanguages } from "@repo/shared";
import type { UserRole } from "~/config/userRoles";
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
  excludeCourseId?: string;
  userRole?: UserRole;
  language: SupportedLanguages;
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
      ...(searchParams?.description && { description: searchParams.description }),
      ...(searchParams?.searchQuery && { searchQuery: searchParams.searchQuery }),
      ...(searchParams?.category && { category: searchParams.category }),
      ...(searchParams?.sort && { sort: searchParams.sort }),
      ...(searchParams?.userId && { userId: searchParams.userId }),
      ...(searchParams?.excludeCourseId && { excludeCourseId: searchParams.excludeCourseId }),
      language: searchParams?.language,
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
