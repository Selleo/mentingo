import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export type CourseDiscussionSummary = {
  completedCount: number;
  activeStudentsCount: number | null;
  completedStudentAvatars: string[];
};

export const getCourseDiscussionSummaryQueryKey = (courseId: string) => [
  "course-discussion-summary",
  { courseId },
];

export const courseDiscussionSummaryQueryOptions = (courseId: string) =>
  queryOptions({
    queryKey: getCourseDiscussionSummaryQueryKey(courseId),
    queryFn: async () => {
      const response = await ApiClient.instance.get<{ data: CourseDiscussionSummary }>(
        `/api/course/${courseId}/discussion-summary`,
      );

      return response.data.data;
    },
    enabled: Boolean(courseId),
  });

export function useCourseDiscussionSummary(courseId: string) {
  return useQuery(courseDiscussionSummaryQueryOptions(courseId));
}
