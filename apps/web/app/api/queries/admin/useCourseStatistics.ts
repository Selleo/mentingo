import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../../api-client";

import type { GetCourseStatisticsResponse } from "~/api/generated-api";

export const COURSE_STATISTICS_QUERY_KEY = ["course-statistics", "admin"];

interface CourseStatisticsQueryOptions {
  id: string;
  enabled?: boolean;
}

export const courseStatisticsQueryOptions = ({ id, enabled }: CourseStatisticsQueryOptions) =>
  queryOptions({
    enabled,
    queryKey: [COURSE_STATISTICS_QUERY_KEY, { id }],
    queryFn: async () => {
      const response = await ApiClient.api.courseControllerGetCourseStatistics(id);

      return response.data;
    },
    select: (data: GetCourseStatisticsResponse) => data.data,
  });

export function useCourseStatistics({ id, enabled }: CourseStatisticsQueryOptions) {
  return useQuery(courseStatisticsQueryOptions({ id, enabled }));
}

export function useCourseStatisticsSuspense({ id, enabled }: CourseStatisticsQueryOptions) {
  return useSuspenseQuery(courseStatisticsQueryOptions({ id, enabled }));
}
