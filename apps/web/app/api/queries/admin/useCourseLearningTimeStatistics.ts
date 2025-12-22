import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../../api-client";

import type { GetCourseLearningTimeStatisticsResponse } from "../../generated-api";

export const COURSE_LEARNING_TIME_STATISTICS_QUERY_KEY = [
  "course-learning-time-statistics",
  "admin",
];

export type LearningTimeStatistics = GetCourseLearningTimeStatisticsResponse["data"];

export type CourseLearningTimeFilterQuery = {
  groupId?: string;
  search?: string;
  page?: number;
  perPage?: number;
  sort?: "studentName" | "totalSeconds" | "-studentName" | "-totalSeconds";
};

interface CourseLearningTimeStatisticsQueryOptions {
  id: string;
  enabled?: boolean;
  query: CourseLearningTimeFilterQuery;
}

export const courseLearningTimeStatisticsQueryOptions = ({
  id,
  enabled,
  query,
}: CourseLearningTimeStatisticsQueryOptions) =>
  queryOptions({
    enabled,
    queryKey: [COURSE_LEARNING_TIME_STATISTICS_QUERY_KEY, { id, query }],
    queryFn: async () => {
      const response = await ApiClient.api.courseControllerGetCourseLearningTimeStatistics(
        id,
        query,
      );

      return response.data;
    },
  });

export function useCourseLearningTimeStatistics({
  id,
  enabled,
  query,
}: CourseLearningTimeStatisticsQueryOptions) {
  return useQuery(courseLearningTimeStatisticsQueryOptions({ id, enabled, query }));
}

export function useCourseLearningTimeStatisticsSuspense({
  id,
  enabled,
  query,
}: CourseLearningTimeStatisticsQueryOptions) {
  return useSuspenseQuery(courseLearningTimeStatisticsQueryOptions({ id, enabled, query }));
}
