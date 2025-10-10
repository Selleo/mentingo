import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetEnrolledLessonsResponse } from "../generated-api";

export type EnrolledLessonsParams = {
  /** Filter by course title only */
  title?: string;
  /** Filter by course description only */
  description?: string;
  /** Search across both title AND description fields simultaneously */
  searchQuery?: string;
  lessonCompleted?: boolean;
};

type QueryOptions = {
  enabled?: boolean;
};

export const studentLessonsQueryOptions = (
  searchParams?: EnrolledLessonsParams,
  options: QueryOptions = { enabled: true },
) =>
  queryOptions({
    queryKey: ["studentLessons", searchParams],
    queryFn: async () => {
      const response = await ApiClient.api.lessonControllerGetEnrolledLessons({
        title: searchParams?.title,
        description: searchParams?.description,
        searchQuery: searchParams?.searchQuery,
        ...(searchParams?.lessonCompleted !== undefined && {
          lessonCompleted: String(searchParams.lessonCompleted),
        }),
      });
      return response.data;
    },
    select: (data: GetEnrolledLessonsResponse) => data.data,
    ...options,
  });

export function useStudentLessons(searchParams?: EnrolledLessonsParams, options?: QueryOptions) {
  return useQuery(studentLessonsQueryOptions(searchParams, options));
}

export function useStudentLessonsSuspense(
  searchParams?: EnrolledLessonsParams,
  options?: QueryOptions,
) {
  return useSuspenseQuery(studentLessonsQueryOptions(searchParams, options));
}
