import {
  COURSE_ARCHIVED_QUERY_VALUES,
  type CourseStatus,
  type SupportedLanguages,
} from "@repo/shared";
import { useInfiniteQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import { ALL_COURSES_QUERY_KEY } from "./useCourses";

import type { GetAllCoursesResponse } from "../generated-api";

export const INFINITE_COURSES_PAGE_SIZE = 12;

type InfiniteCoursesParams = {
  language: SupportedLanguages;
  title?: string;
  state?: CourseStatus;
};

export const infiniteCoursesQueryOptions = (
  params: InfiniteCoursesParams,
  perPage = INFINITE_COURSES_PAGE_SIZE,
) => ({
  queryKey: [...ALL_COURSES_QUERY_KEY, "infinite", params, perPage],
  queryFn: async ({ pageParam }: { pageParam: number }) => {
    const response = await ApiClient.api.courseControllerGetAllCourses({
      ...(params.title && { title: params.title }),
      ...(params.state && { status: params.state }),
      isArchived: COURSE_ARCHIVED_QUERY_VALUES.FALSE,
      language: params.language,
      page: pageParam,
      perPage,
    });

    return response.data;
  },
  getNextPageParam: (lastPage: GetAllCoursesResponse) => {
    const loadedItems = lastPage.pagination.page * lastPage.pagination.perPage;

    if (loadedItems >= lastPage.pagination.totalItems) return undefined;

    return lastPage.pagination.page + 1;
  },
  initialPageParam: 1,
});

/** Manageable, non-archived courses loaded page by page. */
export function useInfiniteCourses(
  params: InfiniteCoursesParams,
  options: { enabled?: boolean } = {},
) {
  return useInfiniteQuery({ ...infiniteCoursesQueryOptions(params), ...options });
}
