import { useInfiniteQuery, useQuery, useSuspenseQuery } from "@tanstack/react-query";

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
  notifyOnChangeProps?: Array<"data" | "isLoading" | "hasNextPage">;
};

export const AVAILABLE_COURSES_QUERY_KEY = "available-courses";
export const AVAILABLE_COURSES_PAGE_SIZE = 5;

const getAvailableCoursesRequestParams = (
  searchParams: CourseParams | undefined,
  page: number,
  perPage: number,
) => ({
  page,
  perPage,
  ...(searchParams?.title && { title: searchParams.title }),
  ...(searchParams?.description && { description: searchParams.description }),
  ...(searchParams?.searchQuery && { searchQuery: searchParams.searchQuery }),
  ...(searchParams?.category && { category: searchParams.category }),
  ...(searchParams?.sort && { sort: searchParams.sort }),
  ...(searchParams?.userId && { userId: searchParams.userId }),
  ...(searchParams?.excludeCourseId && { excludeCourseId: searchParams.excludeCourseId }),
  language: searchParams?.language,
});

export const availableCoursesQueryOptions = (
  searchParams?: CourseParams,
  options: QueryOptions = { enabled: true },
) => ({
  queryKey: [AVAILABLE_COURSES_QUERY_KEY, searchParams],
  queryFn: async () => {
    const response = await ApiClient.api.courseControllerGetAvailableCourses(
      getAvailableCoursesRequestParams(searchParams, 1, 100),
    );
    return response.data;
  },
  select: (data: GetAvailableCoursesResponse) => data.data,
  ...options,
});

export const infiniteAvailableCoursesQueryOptions = (
  searchParams?: CourseParams,
  perPage = AVAILABLE_COURSES_PAGE_SIZE,
  options: QueryOptions = { enabled: true },
) => ({
  queryKey: [AVAILABLE_COURSES_QUERY_KEY, "infinite", searchParams, perPage],
  queryFn: async ({ pageParam }: { pageParam: number }) => {
    const response = await ApiClient.api.courseControllerGetAvailableCourses(
      getAvailableCoursesRequestParams(searchParams, pageParam, perPage),
    );

    return response.data;
  },
  getNextPageParam: (lastPage: GetAvailableCoursesResponse) => {
    const loadedItems = lastPage.pagination.page * lastPage.pagination.perPage;

    if (loadedItems >= lastPage.pagination.totalItems) return undefined;

    return lastPage.pagination.page + 1;
  },
  initialPageParam: 1,
  ...options,
});

export function useAvailableCourses(searchParams?: CourseParams) {
  return useQuery(availableCoursesQueryOptions(searchParams));
}

export function useAvailableCoursesSuspense(searchParams?: CourseParams) {
  return useSuspenseQuery(availableCoursesQueryOptions(searchParams));
}

export function useInfiniteAvailableCourses(
  searchParams?: CourseParams,
  perPage = AVAILABLE_COURSES_PAGE_SIZE,
  options: QueryOptions = { enabled: true },
) {
  return useInfiniteQuery(infiniteAvailableCoursesQueryOptions(searchParams, perPage, options));
}
