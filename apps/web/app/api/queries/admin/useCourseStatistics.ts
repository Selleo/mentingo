import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../../api-client";

import type { GetCourseStatisticsResponse } from "~/api/generated-api";

export const COURSE_STATISTICS_QUERY_KEY = ["course-statistics", "admin"];

export type CourseStatisticsParams = {
  groupId?: string;
};

interface CourseStatisticsQueryOptions {
  id: string;
  enabled?: boolean;
  query: CourseStatisticsParams;
}

export const courseStatisticsQueryOptions = ({
  id,
  enabled,
  query,
}: CourseStatisticsQueryOptions) =>
  queryOptions({
    enabled,
    queryKey: [COURSE_STATISTICS_QUERY_KEY, { id, query }],
    queryFn: async () => {
      const response = await ApiClient.api.courseControllerGetCourseStatistics(id, query);

      return response.data;
    },
    select: (data: GetCourseStatisticsResponse) => data.data,
  });

export function useCourseStatistics({ id, enabled, query }: CourseStatisticsQueryOptions) {
  return useQuery(courseStatisticsQueryOptions({ id, enabled, query }));
}

export function useCourseStatisticsSuspense({ id, enabled, query }: CourseStatisticsQueryOptions) {
  return useSuspenseQuery(courseStatisticsQueryOptions({ id, enabled, query }));
}
