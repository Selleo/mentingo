import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../../api-client";

export const COURSE_STATISTICS_FILTER_OPTIONS_QUERY_KEY = [
  "course-learning-time-statistics-filter-options",
  "admin",
];

interface CourseStatisticsOptions {
  id: string;
  enabled?: boolean;
}

export const courseStatisticsOptions = ({ id, enabled }: CourseStatisticsOptions) =>
  queryOptions({
    enabled,
    queryKey: [COURSE_STATISTICS_FILTER_OPTIONS_QUERY_KEY, { id }],
    queryFn: async () => {
      const response =
        await ApiClient.api.courseControllerGetCourseLearningStatisticsFilterOptions(id);

      return response.data;
    },
    select: (data) => data.data,
  });

export function useCourseStatisticsFilter({ id, enabled }: CourseStatisticsOptions) {
  return useQuery(courseStatisticsOptions({ id, enabled }));
}

export function useCourseStatisticsFilterSuspense({ id, enabled }: CourseStatisticsOptions) {
  return useSuspenseQuery(courseStatisticsOptions({ id, enabled }));
}
