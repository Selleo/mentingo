import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../../api-client";

import type { SupportedLanguages } from "@repo/shared";

export const COURSE_STATISTICS_FILTER_OPTIONS_QUERY_KEY = [
  "course-learning-time-statistics-filter-options",
  "admin",
];

interface CourseStatisticsOptions {
  id: string;
  enabled?: boolean;
  language?: SupportedLanguages;
}

export const courseStatisticsOptions = ({ id, enabled, language }: CourseStatisticsOptions) =>
  queryOptions({
    enabled,
    queryKey: [COURSE_STATISTICS_FILTER_OPTIONS_QUERY_KEY, { id, language }],
    queryFn: async () => {
      const response = await ApiClient.api.courseControllerGetCourseLearningStatisticsFilterOptions(
        id,
        {
          language,
        },
      );

      return response.data;
    },
    select: (data) => data.data,
  });

export function useCourseStatisticsFilter({ id, enabled, language }: CourseStatisticsOptions) {
  return useQuery(courseStatisticsOptions({ id, enabled, language }));
}

export function useCourseStatisticsFilterSuspense({
  id,
  enabled,
  language,
}: CourseStatisticsOptions) {
  return useSuspenseQuery(courseStatisticsOptions({ id, enabled, language }));
}
