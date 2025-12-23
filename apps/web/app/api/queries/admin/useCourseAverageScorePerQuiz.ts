import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../../api-client";

import type { GetAverageQuizScoresResponse } from "~/api/generated-api";
import type { CourseStatisticsParams } from "~/api/queries/admin/useCourseStatistics";

export const COURSE_AVERAGE_SCORE_PER_QUIZ_QUERY_KEY = ["course-average-score-per-quiz", "admin"];

interface CourseAverageScorePerQuizQueryOptions {
  id: string;
  enabled?: boolean;
  query: CourseStatisticsParams;
}

export const courseAverageScorePerQuizQueryOptions = ({
  id,
  enabled,
  query,
}: CourseAverageScorePerQuizQueryOptions) =>
  queryOptions({
    enabled,
    queryKey: [COURSE_AVERAGE_SCORE_PER_QUIZ_QUERY_KEY, { id, query }],
    queryFn: async () => {
      const response = await ApiClient.api.courseControllerGetAverageQuizScores(id, query);

      return response.data;
    },
    select: (data: GetAverageQuizScoresResponse) => data.data,
  });

export function useCourseAverageScorePerQuiz({
  id,
  enabled,
  query,
}: CourseAverageScorePerQuizQueryOptions) {
  return useQuery(courseAverageScorePerQuizQueryOptions({ id, enabled, query }));
}

export function useCourseAverageScorePerQuizSuspense({
  id,
  enabled,
  query,
}: CourseAverageScorePerQuizQueryOptions) {
  return useSuspenseQuery(courseAverageScorePerQuizQueryOptions({ id, enabled, query }));
}
