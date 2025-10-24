import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../../api-client";

import type { GetAverageQuizScoresResponse } from "~/api/generated-api";

export const COURSE_AVERAGE_SCORE_PER_QUIZ_QUERY_KEY = ["course-average-score-per-quiz", "admin"];

interface CourseAverageScorePerQuizQueryOptions {
  id: string;
  enabled?: boolean;
}

export const courseAverageScorePerQuizQueryOptions = ({
  id,
  enabled,
}: CourseAverageScorePerQuizQueryOptions) =>
  queryOptions({
    enabled,
    queryKey: [COURSE_AVERAGE_SCORE_PER_QUIZ_QUERY_KEY, { id }],
    queryFn: async () => {
      const response = await ApiClient.api.courseControllerGetAverageQuizScores(id);

      return response.data;
    },
    select: (data: GetAverageQuizScoresResponse) => data.data,
  });

export function useCourseAverageScorePerQuiz({
  id,
  enabled,
}: CourseAverageScorePerQuizQueryOptions) {
  return useQuery(courseAverageScorePerQuizQueryOptions({ id, enabled }));
}

export function useCourseAverageScorePerQuizSuspense({
  id,
  enabled,
}: CourseAverageScorePerQuizQueryOptions) {
  return useSuspenseQuery(courseAverageScorePerQuizQueryOptions({ id, enabled }));
}
