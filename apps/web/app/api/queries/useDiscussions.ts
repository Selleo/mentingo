import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { CourseDiscussionThread } from "~/api/types/discussion.types";

export const discussionsQueryOptions = (courseId: string) =>
  queryOptions({
    queryKey: ["discussions", courseId],
    queryFn: async () => {
      const response = await ApiClient.api.courseDiscussionsControllerList(courseId);
      return response.data.data as CourseDiscussionThread[];
    },
    enabled: Boolean(courseId),
  });

export function useDiscussions(courseId: string) {
  return useQuery(discussionsQueryOptions(courseId));
}
