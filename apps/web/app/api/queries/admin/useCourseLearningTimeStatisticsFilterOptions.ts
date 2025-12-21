import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../../api-client";

export const COURSE_LEARNING_TIME_STATISTICS_FILTER_QUERY_KEY = [
  "course-learning-time-statistics-filter-options",
  "admin",
];

interface CourseLearningTimeStatisticsQueryOptions {
  id: string;
  enabled?: boolean;
}

export const courseLearningTimeStatisticsFilterQueryOptions = ({
  id,
  enabled,
}: CourseLearningTimeStatisticsQueryOptions) =>
  queryOptions({
    enabled,
    queryKey: [COURSE_LEARNING_TIME_STATISTICS_FILTER_QUERY_KEY, { id }],
    queryFn: async () => {
      const response =
        await ApiClient.api.courseControllerGetCourseLearningStatisticsFilterOptions(id);

      return response.data;
    },
    select: (data) => data.data,
  });

export function useCourseLearningTimeStatisticsFilter({
  id,
  enabled,
}: CourseLearningTimeStatisticsQueryOptions) {
  return useQuery(courseLearningTimeStatisticsFilterQueryOptions({ id, enabled }));
}

export function useCourseLearningTimeStatisticsFilterSuspense({
  id,
  enabled,
}: CourseLearningTimeStatisticsQueryOptions) {
  return useSuspenseQuery(courseLearningTimeStatisticsFilterQueryOptions({ id, enabled }));
}
