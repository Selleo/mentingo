import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetCourseResponse } from "../generated-api";

export const getCourseQueryKey = (id: string) => ["course", { id }];

export const courseQueryOptions = (id: string) =>
  queryOptions({
    queryKey: getCourseQueryKey(id),
    queryFn: async () => {
      const response = await ApiClient.api.courseControllerGetCourse({
        id: id ?? "",
      });
      return response.data;
    },
    select: (data: GetCourseResponse) => data.data,
  });

export function useCourse(id: string) {
  return useQuery(courseQueryOptions(id));
}

export function useCourseSuspense(id: string) {
  return useSuspenseQuery(courseQueryOptions(id));
}
