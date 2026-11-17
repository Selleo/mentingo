import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { FORUM_QUERY_KEY } from "./forumQueryKeys";
import { isMissingForumResourceError } from "./isMissingForumResourceError";

import type { SupportedLanguages } from "@repo/shared";

export const forumCourseDiscussionQueryOptions = (courseId: string, language: SupportedLanguages) =>
  queryOptions({
    queryKey: [...FORUM_QUERY_KEY, "course-discussion", courseId, language],
    queryFn: async () => {
      try {
        const response = await ApiClient.api.forumControllerGetCourseDiscussion(courseId, {
          language,
        });

        return response.data.data;
      } catch (error) {
        if (isMissingForumResourceError(error)) return null;

        throw error;
      }
    },
  });

export function useForumCourseDiscussionSuspense(courseId: string, language: SupportedLanguages) {
  return useSuspenseQuery(forumCourseDiscussionQueryOptions(courseId, language));
}
