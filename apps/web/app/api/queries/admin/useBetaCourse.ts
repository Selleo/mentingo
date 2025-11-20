import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../../api-client";

import type { GetBetaCourseByIdResponse } from "../../generated-api";
import type { Languages } from "@repo/shared";

export const COURSE_QUERY_KEY = ["beta-course", "admin"];

export const courseQueryOptions = (id: string, language?: Languages) =>
  queryOptions({
    queryKey: [COURSE_QUERY_KEY, { id, language }],
    queryFn: async () => {
      const response = await ApiClient.api.courseControllerGetBetaCourseById({
        id,
        language,
      });
      return response.data;
    },
    select: (data: GetBetaCourseByIdResponse) => data.data,
  });

export function useBetaCourseById(id: string, language: Languages) {
  return useQuery(courseQueryOptions(id, language));
}

export function useBetaCourseByIdSuspense(id: string, language: Languages) {
  return useSuspenseQuery(courseQueryOptions(id, language));
}
