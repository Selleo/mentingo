import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../../api-client";

export const COURSE_STUDENTS_AI_MENTOR_RESULTS_QUERY_KEY = [
  "course-students-ai-mentor-results",
  "admin",
];

export type CourseStudentsAiMentorResultsQueryParams = {
  page?: number;
  perPage?: number;
  lessonId?: string;
  sort?:
    | "studentName"
    | "lessonName"
    | "score"
    | "lastSession"
    | "-studentName"
    | "-lessonName"
    | "-score"
    | "-lastSession";
};

interface CourseStudentsAiMentorResultsOptions {
  id: string;
  enabled?: boolean;
  query?: CourseStudentsAiMentorResultsQueryParams;
}

export const courseStudentsAiMentorResultsQueryOptions = ({
  id,
  enabled,
  query,
}: CourseStudentsAiMentorResultsOptions) =>
  queryOptions({
    enabled,
    placeholderData: (previousData) => previousData,
    queryKey: [COURSE_STUDENTS_AI_MENTOR_RESULTS_QUERY_KEY, { id, query }],
    queryFn: async () => {
      const response = await ApiClient.api.courseControllerGetCourseStudentsAiMentorResults(
        id,
        query,
      );

      return response.data;
    },
  });

export function useCourseStudentsAiMentorResults({
  id,
  enabled,
  query,
}: CourseStudentsAiMentorResultsOptions) {
  return useQuery(courseStudentsAiMentorResultsQueryOptions({ id, enabled, query }));
}

export function useCourseStudentsAiMentorResultsSuspense({
  id,
  enabled,
  query,
}: CourseStudentsAiMentorResultsOptions) {
  return useSuspenseQuery(courseStudentsAiMentorResultsQueryOptions({ id, enabled, query }));
}
