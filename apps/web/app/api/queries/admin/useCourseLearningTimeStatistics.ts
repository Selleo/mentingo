import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../../api-client";

import type { GetCourseLearningTimeStatisticsResponse } from "../../generated-api";

export const COURSE_LEARNING_TIME_STATISTICS_QUERY_KEY = [
  "course-learning-time-statistics",
  "admin",
];

export type LearningTimeStatistics = GetCourseLearningTimeStatisticsResponse["data"];

interface CourseLearningTimeStatisticsQueryOptions {
  id: string;
  enabled?: boolean;
}

export const courseLearningTimeStatisticsQueryOptions = ({
  id,
  enabled,
}: CourseLearningTimeStatisticsQueryOptions) =>
  queryOptions({
    enabled,
    queryKey: [COURSE_LEARNING_TIME_STATISTICS_QUERY_KEY, { id }],
    queryFn: async () => {
      const response = await ApiClient.api.courseControllerGetCourseLearningTimeStatistics(id);

      return response.data;
    },
    select: (data) => data.data,
  });

export function useCourseLearningTimeStatistics({
  id,
  enabled,
}: CourseLearningTimeStatisticsQueryOptions) {
  return useQuery(courseLearningTimeStatisticsQueryOptions({ id, enabled }));
}

export function useCourseLearningTimeStatisticsSuspense({
  id,
  enabled,
}: CourseLearningTimeStatisticsQueryOptions) {
  return useSuspenseQuery(courseLearningTimeStatisticsQueryOptions({ id, enabled }));
}
