import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { FORUM_QUERY_KEY } from "./forumQueryKeys";
import { isMissingForumResourceError } from "./isMissingForumResourceError";

export const forumTopicQueryOptions = (topicId: string) =>
  queryOptions({
    queryKey: [...FORUM_QUERY_KEY, "topic", topicId],
    queryFn: async () => {
      try {
        const response = await ApiClient.api.forumControllerGetTopic(topicId);

        return response.data.data;
      } catch (error) {
        if (isMissingForumResourceError(error)) return null;

        throw error;
      }
    },
  });

export function useForumTopicSuspense(topicId: string) {
  return useSuspenseQuery(forumTopicQueryOptions(topicId));
}
