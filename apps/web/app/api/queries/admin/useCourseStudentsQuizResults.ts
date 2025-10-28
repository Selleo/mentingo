import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../../api-client";

export const COURSE_STUDENTS_QUIZ_RESULTS_QUERY_KEY = ["course-students-quiz-results", "admin"];

export type CourseStudentsQuizResultsQueryParams = {
  page?: number;
  perPage?: number;
  quizId?: string;
  sort?:
    | "studentName"
    | "quizName"
    | "quizScore"
    | "attempts"
    | "lastAttempt"
    | "-studentName"
    | "-quizName"
    | "-quizScore"
    | "-attempts"
    | "-lastAttempt";
};

interface CourseStudentsQuizResultsOptions {
  id: string;
  enabled?: boolean;
  query?: CourseStudentsQuizResultsQueryParams;
}

export const courseStudentsQuizResultsQueryOptions = ({
  id,
  enabled,
  query,
}: CourseStudentsQuizResultsOptions) =>
  queryOptions({
    enabled,
    queryKey: [COURSE_STUDENTS_QUIZ_RESULTS_QUERY_KEY, { id, query }],
    queryFn: async () => {
      const response = await ApiClient.api.courseControllerGetCourseStudentsQuizResults(id, query);

      return response.data;
    },
  });

export function useCourseStudentsQuizResults({
  id,
  enabled,
  query,
}: CourseStudentsQuizResultsOptions) {
  return useQuery(courseStudentsQuizResultsQueryOptions({ id, enabled, query }));
}

export function useCourseStudentsQuizResultsSuspense({
  id,
  enabled,
  query,
}: CourseStudentsQuizResultsOptions) {
  return useSuspenseQuery(courseStudentsQuizResultsQueryOptions({ id, enabled, query }));
}
