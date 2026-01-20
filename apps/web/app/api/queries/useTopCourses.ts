import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetTopCoursesResponse } from "../generated-api";
import type { SupportedLanguages } from "@repo/shared";

type TopCoursesParams = {
  limit?: number;
  days?: number;
  language: SupportedLanguages;
};

export const topCoursesQueryOptions = (params: TopCoursesParams) => ({
  queryKey: ["top-courses", params],
  queryFn: async () => {
    const response = await ApiClient.api.courseControllerGetTopCourses({
      limit: params.limit,
      days: params.days,
      language: params.language,
    });

    return response.data;
  },
  select: (data: GetTopCoursesResponse) => data.data,
});

export function useTopCourses(params: TopCoursesParams) {
  return useQuery(topCoursesQueryOptions(params));
}
