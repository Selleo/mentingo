import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetLessonsResponse } from "~/api/generated-api";

export type EnrolledLessonsParams = {
  title?: string;
  description?: string;
  searchQuery?: string;
  lessonCompleted?: boolean;
};

type QueryOptions = {
  enabled?: boolean;
};

export const lessonsQueryOptions = (
  searchParams?: EnrolledLessonsParams,
  options: QueryOptions = { enabled: true },
) =>
  queryOptions({
    queryKey: ["lessons", searchParams],
    queryFn: async () => {
      const response = await ApiClient.api.lessonControllerGetLessons({
        title: searchParams?.title,
        description: searchParams?.description,
        searchQuery: searchParams?.searchQuery,
        ...(searchParams?.lessonCompleted !== undefined && {
          lessonCompleted: String(searchParams.lessonCompleted),
        }),
      });
      return response.data;
    },
    select: (data: GetLessonsResponse) => data.data,
    ...options,
  });

export function useLessons(searchParams?: EnrolledLessonsParams, options?: QueryOptions) {
  return useQuery(lessonsQueryOptions(searchParams, options));
}

export function useLessonsSuspense(searchParams?: EnrolledLessonsParams, options?: QueryOptions) {
  return useSuspenseQuery(lessonsQueryOptions(searchParams, options));
}
