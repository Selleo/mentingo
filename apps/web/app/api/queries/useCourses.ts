import {
  COURSE_ARCHIVED_QUERY_VALUES,
  SUPPORTED_LANGUAGES,
  type CourseStatus,
  type SupportedLanguages,
} from "@repo/shared";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { match } from "ts-pattern";

import { ApiClient } from "../api-client";

import type { GetAllCoursesResponse } from "../generated-api";
import type { SortOption } from "~/types/sorting";

export type { CourseStatus };

export type CourseParams = {
  /** Filter by course title only */
  title?: string;
  /** Filter by course description only */
  description?: string;
  category?: string;
  state?: CourseStatus;
  sort?: SortOption;
  authorId?: string;
  isArchived?: boolean;
  includeArchived?: boolean;
  language?: SupportedLanguages;
};

type QueryOptions = {
  enabled?: boolean;
};

export const ALL_COURSES_QUERY_KEY = ["courses"];

export const allCoursesQueryOptions = (
  searchParams?: CourseParams,
  options: QueryOptions = { enabled: true },
) => ({
  queryKey: [...ALL_COURSES_QUERY_KEY, searchParams],
  queryFn: async () => {
    const isArchived = match(searchParams)
      .with({ includeArchived: true }, () => COURSE_ARCHIVED_QUERY_VALUES.ALL)
      .with({ isArchived: true }, () => COURSE_ARCHIVED_QUERY_VALUES.TRUE)
      .with({ isArchived: false }, () => COURSE_ARCHIVED_QUERY_VALUES.FALSE)
      .otherwise(() => undefined);

    const response = await ApiClient.api.courseControllerGetAllCourses({
      ...(searchParams?.title && { title: searchParams.title }),
      ...(searchParams?.description && { description: searchParams.description }),
      ...(searchParams?.category && { category: searchParams.category }),
      ...(searchParams?.authorId && { authorId: searchParams.authorId }),
      ...(searchParams?.state && { status: searchParams.state }),
      ...(searchParams?.sort && { sort: searchParams.sort }),
      ...(isArchived && { isArchived }),
      language: searchParams?.language ?? SUPPORTED_LANGUAGES.EN,
      page: 1,
      perPage: 100,
    });
    return response.data;
  },
  select: (data: GetAllCoursesResponse) => data.data,
  ...options,
});

export function useCourses(searchParams?: CourseParams, options?: QueryOptions) {
  return useQuery(allCoursesQueryOptions(searchParams, options));
}

export function useCoursesSuspense(searchParams?: CourseParams, options?: QueryOptions) {
  return useSuspenseQuery(allCoursesQueryOptions(searchParams, options));
}
