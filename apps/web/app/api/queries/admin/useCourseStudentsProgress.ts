import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../../api-client";

export const COURSE_STUDENTS_PROGRESS_QUERY_KEY = ["course-students-progress", "admin"];

export type CourseStudentsProgressQueryParams = Parameters<
  typeof ApiClient.api.courseControllerGetCourseStudentsProgress
>[1];

interface CourseStudentsProgressOptions {
  id: string;
  enabled?: boolean;
  query?: CourseStudentsProgressQueryParams;
}

export const courseStudentsProgressQueryOptions = ({
  id,
  enabled,
  query,
}: CourseStudentsProgressOptions) =>
  queryOptions({
    enabled,
    queryKey: [COURSE_STUDENTS_PROGRESS_QUERY_KEY, { id, query }],
    queryFn: async () => {
      const response = await ApiClient.api.courseControllerGetCourseStudentsProgress(id, query);

      return response.data;
    },
    placeholderData: (previousData) => previousData,
  });

export function useCourseStudentsProgress({ id, enabled, query }: CourseStudentsProgressOptions) {
  return useQuery(courseStudentsProgressQueryOptions({ id, enabled, query }));
}

export function useCourseStudentsProgressSuspense({
  id,
  enabled,
  query,
}: CourseStudentsProgressOptions) {
  return useSuspenseQuery(courseStudentsProgressQueryOptions({ id, enabled, query }));
}
