import { useInfiniteQuery, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetStudentCoursesResponse } from "../generated-api";
import type { SupportedLanguages } from "@repo/shared";
import type { SortOption } from "~/types/sorting";

type CourseParams = {
  /** Filter by course title only */
  title?: string;
  /** Filter by course description only */
  description?: string;
  category?: string;
  sort?: SortOption;
  userId?: string;
  language?: SupportedLanguages;
};

type QueryOptions = {
  enabled?: boolean;
};

export const STUDENT_COURSES_QUERY_KEY = "get-student-courses";
export const STUDENT_COURSES_PAGE_SIZE = 5;

const getStudentCoursesRequestParams = (
  searchParams: CourseParams | undefined,
  page: number,
  perPage: number,
) => ({
  page,
  perPage,
  ...(searchParams?.title && { title: searchParams.title }),
  ...(searchParams?.description && { description: searchParams.description }),
  ...(searchParams?.category && { category: searchParams.category }),
  ...(searchParams?.sort && { sort: searchParams.sort }),
  ...(searchParams?.userId && { userId: searchParams.userId }),
  ...(searchParams?.language && { language: searchParams.language }),
});

export const studentCoursesQueryOptions = (
  searchParams?: CourseParams,
  options: QueryOptions = { enabled: true },
) => ({
  queryKey: [STUDENT_COURSES_QUERY_KEY, searchParams],
  queryFn: async () => {
    const response = await ApiClient.api.courseControllerGetStudentCourses(
      getStudentCoursesRequestParams(searchParams, 1, 100),
    );
    return response.data;
  },
  select: (data: GetStudentCoursesResponse) => data.data,
  ...options,
});

export const infiniteStudentCoursesQueryOptions = (
  searchParams?: CourseParams,
  perPage = STUDENT_COURSES_PAGE_SIZE,
  options: QueryOptions = { enabled: true },
) => ({
  queryKey: [STUDENT_COURSES_QUERY_KEY, "infinite", searchParams, perPage],
  queryFn: async ({ pageParam }: { pageParam: number }) => {
    const response = await ApiClient.api.courseControllerGetStudentCourses(
      getStudentCoursesRequestParams(searchParams, pageParam, perPage),
    );

    return response.data;
  },
  getNextPageParam: (lastPage: GetStudentCoursesResponse) => {
    const loadedItems = lastPage.pagination.page * lastPage.pagination.perPage;

    if (loadedItems >= lastPage.pagination.totalItems) return undefined;

    return lastPage.pagination.page + 1;
  },
  initialPageParam: 1,
  ...options,
});

export function useStudentCourses(searchParams?: CourseParams) {
  return useQuery(studentCoursesQueryOptions(searchParams));
}

export function useStudentCoursesSuspense(searchParams?: CourseParams) {
  return useSuspenseQuery(studentCoursesQueryOptions(searchParams));
}

export function useInfiniteStudentCourses(
  searchParams?: CourseParams,
  perPage = STUDENT_COURSES_PAGE_SIZE,
  options: QueryOptions = { enabled: true },
) {
  return useInfiniteQuery(infiniteStudentCoursesQueryOptions(searchParams, perPage, options));
}
